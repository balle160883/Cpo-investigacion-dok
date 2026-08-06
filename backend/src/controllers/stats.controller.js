const db = require('../../db');
const { cacheGet, cacheSet } = require('../cache/redis.client');

const STATS_CACHE_KEY = 'cpo:stats:general';
const PROD_CACHE_KEY = 'cpo:stats:productividad';
const CACHE_TTL = 120; // 2 minutos

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Estadísticas globales del sistema CPO
 *     tags: [Estadísticas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contadores generales de investigaciones
 */
async function getStats(req, res, next) {
  try {
    // Intentar responder desde caché Redis (< 5ms)
    const cached = await cacheGet(STATS_CACHE_KEY);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Consulta optimizada en 1 solo viaje a la BD con agregación condicional
    const { rows } = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'COMPLETADA') as completadas,
        COUNT(*) FILTER (WHERE estado = 'EN_PROCESO') as en_proceso,
        COUNT(*) FILTER (WHERE estado IS NULL OR estado = 'PENDIENTE') as pendientes,
        (SELECT COUNT(*) FROM investigadores WHERE activo = TRUE) as investigadores_activos
      FROM investigaciones;
    `);

    const stats = rows[0] || {};
    const result = {
      total: parseInt(stats.total || 0),
      completadas: parseInt(stats.completadas || 0),
      en_proceso: parseInt(stats.en_proceso || 0),
      pendientes: parseInt(stats.pendientes || 0),
      investigadores_activos: parseInt(stats.investigadores_activos || 0),
    };

    // Guardar en caché Redis por 2 minutos
    await cacheSet(STATS_CACHE_KEY, result, CACHE_TTL);

    res.set('X-Cache', 'MISS');
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/stats/productividad:
 *   get:
 *     summary: Métricas de productividad y efectividad por investigador
 *     tags: [Estadísticas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de investigadores con porcentaje de efectividad
 */
async function getProductividadInvestigadores(req, res, next) {
  try {
    const cached = await cacheGet(PROD_CACHE_KEY);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    const { rows } = await db.query(`
      SELECT 
        i.id,
        i.nombre,
        i.email,
        i.telefono,
        i.rol,
        COUNT(inv.id_sif_research) as total_asignadas,
        COUNT(inv.id_sif_research) FILTER (WHERE inv.estado = 'COMPLETADA') as completadas,
        COUNT(inv.id_sif_research) FILTER (WHERE inv.estado = 'EN_PROCESO') as en_proceso,
        COUNT(inv.id_sif_research) FILTER (WHERE inv.estado IS NULL OR inv.estado = 'PENDIENTE') as pendientes
      FROM investigadores i
      LEFT JOIN investigaciones inv ON CAST(inv.investigador_id AS TEXT) = CAST(i.id AS TEXT)
      WHERE COALESCE(i.activo, TRUE) = TRUE
      GROUP BY i.id, i.nombre, i.email, i.telefono, i.rol
      ORDER BY completadas DESC, total_asignadas DESC;
    `);

    const result = rows.map((r) => {
      const total = parseInt(r.total_asignadas || 0);
      const completadas = parseInt(r.completadas || 0);
      const en_proceso = parseInt(r.en_proceso || 0);
      const pendientes = parseInt(r.pendientes || 0);
      const efectividad = total > 0 ? Math.round((completadas / total) * 100) : 0;

      return {
        id: r.id,
        nombre: r.nombre,
        email: r.email,
        telefono: r.telefono,
        rol: r.rol,
        total_asignadas: total,
        completadas,
        en_proceso,
        pendientes,
        efectividad,
      };
    });

    await cacheSet(PROD_CACHE_KEY, result, CACHE_TTL);

    res.set('X-Cache', 'MISS');
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getAuditoriaAnalistas(req, res, next) {
  try {
    const { fecha_inicio, fecha_fin, analista_id } = req.query;

    let whereClauses = [];
    let queryParams = [];

    if (fecha_inicio) {
      queryParams.push(fecha_inicio);
      whereClauses.push(`inv.fecha_revalidacion >= $${queryParams.length}::timestamp`);
    }

    if (fecha_fin) {
      queryParams.push(`${fecha_fin} 23:59:59`);
      whereClauses.push(`inv.fecha_revalidacion <= $${queryParams.length}::timestamp`);
    }

    if (analista_id && analista_id !== 'TODOS') {
      queryParams.push(analista_id);
      whereClauses.push(`CAST(inv.analista_id AS TEXT) = CAST($${queryParams.length} AS TEXT)`);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // 1. Resumen de Pendientes de Aprobar (Cola Actual de Analistas)
    const { rows: pendRes } = await db.query(`
      SELECT count(*) as total_pendientes
      FROM investigaciones
      WHERE estado_validacion = 'VALIDADA';
    `);

    // 2. Detalle de Revalidaciones por Analista dentro del Rango de Fechas
    const dataQuery = `
      SELECT 
        inv.id_sif_research,
        inv.solicitud_id_sif,
        inv.persona_id_sif,
        inv.estado,
        inv.estado_validacion,
        inv.fecha_revalidacion,
        inv.comentarios_revalidacion,
        inv.analista_id,
        an.nombre as analista_nombre,
        an.email as analista_email,
        p.nombre_completo as sujeto_nombre,
        s.folio as solicitud_folio,
        s.monto_solicitado,
        s.sucursal_id
      FROM investigaciones inv
      LEFT JOIN investigadores an ON inv.analista_id = an.id
      LEFT JOIN personas p ON CAST(inv.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
      LEFT JOIN solicitudes_credito s ON CAST(inv.solicitud_id_sif AS TEXT) = CAST(s.id_sif AS TEXT)
      ${whereSql ? whereSql + " AND inv.fecha_revalidacion IS NOT NULL" : "WHERE inv.fecha_revalidacion IS NOT NULL"}
      ORDER BY inv.fecha_revalidacion DESC;
    `;

    const { rows: historial } = await db.query(dataQuery, queryParams);

    // 3. Resumen por Analista Individual
    const { rows: resumenAnalistas } = await db.query(`
      SELECT 
        an.id,
        an.nombre,
        an.email,
        COUNT(inv.id_sif_research) FILTER (WHERE inv.estado = 'APROBADA_FINAL') as aprobadas_final,
        COUNT(inv.id_sif_research) FILTER (WHERE inv.estado = 'DEVUELTA_A_VALIDADOR') as devueltas_validador
      FROM investigadores an
      LEFT JOIN investigaciones inv ON inv.analista_id = an.id ${whereSql ? 'AND ' + whereClauses.join(' AND ') : ''}
      WHERE LOWER(an.rol) IN ('analista', 'admin', 'superadmin') OR inv.analista_id IS NOT NULL
      GROUP BY an.id, an.nombre, an.email
      ORDER BY aprobadas_final DESC;
    `, queryParams);

    res.json({
      pendientes_de_aprobar: parseInt(pendRes[0]?.total_pendientes || 0),
      historial,
      resumenAnalistas,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: Auditoría de Tiempos SLA & Cronómetro por Fases
 */
async function getSlaStats(req, res, next) {
  try {
    const { fecha_inicio, fecha_fin, sucursal_id, estado_sla } = req.query;

    const whereClauses = [];
    const queryParams = [];

    if (fecha_inicio) {
      queryParams.push(fecha_inicio);
      whereClauses.push(`inv.created_at >= $${queryParams.length}::timestamp`);
    }

    if (fecha_fin) {
      queryParams.push(`${fecha_fin} 23:59:59`);
      whereClauses.push(`inv.created_at <= $${queryParams.length}::timestamp`);
    }

    if (sucursal_id && sucursal_id !== 'TODAS') {
      queryParams.push(sucursal_id);
      whereClauses.push(`CAST(s.sucursal_id AS TEXT) = CAST($${queryParams.length} AS TEXT)`);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const dataQuery = `
      SELECT 
        inv.id_sif_research,
        inv.solicitud_id_sif,
        inv.persona_id_sif,
        inv.tipo_sujeto,
        inv.estado,
        inv.estado_validacion,
        inv.created_at as fecha_creacion_sif,
        inv.fecha_asignacion,
        inv.fecha_cumplimiento,
        inv.fecha_validacion,
        inv.fecha_revalidacion,
        inv.investigador_id,
        inv_usr.nombre as investigador_nombre,
        inv.validador_id,
        val_usr.nombre as validador_nombre,
        inv.analista_id,
        an_usr.nombre as analista_nombre,
        p.nombre_completo as sujeto_nombre,
        s.folio as solicitud_folio,
        s.monto_solicitado,
        s.sucursal_id,
        -- CÁLCULO DE DURACIONES EN HORAS
        ROUND(EXTRACT(EPOCH FROM (COALESCE(inv.fecha_asignacion, NOW()) - inv.created_at))/3600, 2) as hrs_fase1_asignacion,
        ROUND(EXTRACT(EPOCH FROM (COALESCE(inv.fecha_cumplimiento, NOW()) - COALESCE(inv.fecha_asignacion, inv.created_at)))/3600, 2) as hrs_fase2_campo,
        ROUND(EXTRACT(EPOCH FROM (COALESCE(inv.fecha_validacion, NOW()) - COALESCE(inv.fecha_cumplimiento, inv.fecha_asignacion, inv.created_at)))/3600, 2) as hrs_fase3_credito,
        ROUND(EXTRACT(EPOCH FROM (COALESCE(inv.fecha_revalidacion, NOW()) - COALESCE(inv.fecha_validacion, inv.fecha_cumplimiento, inv.created_at)))/3600, 2) as hrs_fase4_analista,
        -- TIEMPO TOTAL TRANSCURRIDO EN HORAS
        ROUND(EXTRACT(EPOCH FROM (COALESCE(inv.fecha_revalidacion, NOW()) - inv.created_at))/3600, 2) as hrs_totales_transcurridas
      FROM investigaciones inv
      LEFT JOIN personas p ON CAST(inv.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
      LEFT JOIN solicitudes_credito s ON CAST(inv.solicitud_id_sif AS TEXT) = CAST(s.id_sif AS TEXT)
      LEFT JOIN investigadores inv_usr ON inv.investigador_id = inv_usr.id
      LEFT JOIN investigadores val_usr ON inv.validador_id = val_usr.id
      LEFT JOIN investigadores an_usr ON inv.analista_id = an_usr.id
      ${whereSql}
      ORDER BY inv.created_at DESC;
    `;

    const { rows } = await db.query(dataQuery, queryParams);

    // Mapeo y categorización de SLA
    let items = rows.map(r => {
      const hrs = parseFloat(r.hrs_totales_transcurridas || 0);
      let estadoSla = 'OPTIMO'; // < 24 hrs
      if (hrs >= 24 && hrs < 48) estadoSla = 'ADVERTENCIA';
      else if (hrs >= 48) estadoSla = 'EXCEDIDO';

      return {
        ...r,
        hrs_totales: hrs,
        estado_sla: estadoSla,
        finalizado: !!r.fecha_revalidacion,
      };
    });

    // Filtrar por estado SLA si fue solicitado
    if (estado_sla && estado_sla !== 'TODOS') {
      items = items.filter(i => i.estado_sla === estado_sla);
    }

    // Calcular estadísticas globales KPI
    const totalCreditos = items.length;
    const optimos = items.filter(i => i.estado_sla === 'OPTIMO').length;
    const advertencias = items.filter(i => i.estado_sla === 'ADVERTENCIA').length;
    const excedidos = items.filter(i => i.estado_sla === 'EXCEDIDO').length;

    const sumaHoras = items.reduce((acc, curr) => acc + curr.hrs_totales, 0);
    const promedioHorasGlobal = totalCreditos > 0 ? (sumaHoras / totalCreditos).toFixed(1) : 0;
    const porcentajeSla = totalCreditos > 0 ? ((optimos / totalCreditos) * 100).toFixed(1) : 100;

    res.json({
      resumenKpi: {
        totalCreditos,
        optimos,
        advertencias,
        excedidos,
        promedioHorasGlobal,
        porcentajeSla,
      },
      creditos: items,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStats,
  getProductividadInvestigadores,
  getAuditoriaAnalistas,
  getSlaStats,
};

