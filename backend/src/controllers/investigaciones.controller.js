const db = require('../../db');
const { registrarAuditoria } = require('./audit.controller');

/**
 * Evalúa las inconsistencias y calidad de datos de la tabla personas y direcciones en PostgreSQL
 * para advertir al asignador antes de enviar la investigación a campo.
 */
function evaluarInconsistenciasPersona(row) {
  const inconsistencias = [];
  let nivel = 'NINGUNA'; // 'NINGUNA' | 'MEDIA' | 'ALTA'

  // 1. Teléfonos / Contacto
  const tieneTel = Boolean(
    (row.telefono_principal && String(row.telefono_principal).trim()) ||
    (row.celular && String(row.celular).trim()) ||
    (row.telefono_secundario && String(row.telefono_secundario).trim()) ||
    (row.telefono && String(row.telefono).trim())
  );
  
  const semaforoContacto = row.estado_contacto_semaforo
    ? String(row.estado_contacto_semaforo).toUpperCase()
    : (tieneTel ? 'AMARILLO' : 'ROJO');

  if (!tieneTel || semaforoContacto === 'ROJO') {
    inconsistencias.push('Sin teléfono de contacto registrado o en estatus ROJO');
    nivel = 'ALTA';
  } else if (semaforoContacto === 'AMARILLO') {
    inconsistencias.push('Contacto telefónico no verificado (Semáforo Amarillo)');
    if (nivel !== 'ALTA') nivel = 'MEDIA';
  }

  // 2. Domicilio
  if (!row.domicilio_validado_sucursal) {
    inconsistencias.push('Domicilio no prevalidado por la sucursal');
    if (nivel === 'NINGUNA') nivel = 'MEDIA';
  }

  const calle = row.calle ? String(row.calle).trim() : '';
  if (!calle || calle.toLowerCase().includes('desconocid')) {
    inconsistencias.push('Calle de domicilio no especificada o desconocida');
    nivel = 'ALTA';
  }

  const numExt = row.numero_exterior ? String(row.numero_exterior).trim() : '';
  if (!numExt || numExt.toUpperCase() === 'S/N') {
    inconsistencias.push('Número exterior no especificado o marcado S/N');
    if (nivel === 'NINGUNA') nivel = 'MEDIA';
  }

  const colonia = row.colonia ? String(row.colonia).trim() : '';
  if (!colonia || colonia.toLowerCase().includes('desconocid')) {
    inconsistencias.push('Colonia no especificada');
    if (nivel === 'NINGUNA') nivel = 'MEDIA';
  }

  // 3. Documentos de Identidad (CURP, RFC, Clave de Elector)
  const curp = row.curp ? String(row.curp).trim() : '';
  if (!curp || curp.length < 18) {
    inconsistencias.push('CURP ausente o con formato incompleto');
    if (nivel === 'NINGUNA') nivel = 'MEDIA';
  }

  const rfc = row.rfc ? String(row.rfc).trim() : '';
  if (!rfc || rfc.length < 10) {
    inconsistencias.push('RFC ausente o incompleto');
    if (nivel === 'NINGUNA') nivel = 'MEDIA';
  }

  return {
    tiene_inconsistencias: inconsistencias.length > 0,
    nivel_inconsistencia: nivel, // 'ALTA', 'MEDIA', 'NINGUNA'
    inconsistencias,
    estado_contacto_semaforo: semaforoContacto,
  };
}

async function getInvestigaciones(req, res, next) {
  try {
    const { estado, buscar, investigador_id, colonia, sucursal, paquete_completo } = req.query;

    let whereClauses = [];
    let queryParams = [];

    let targetInvestigadorId = investigador_id;
    if (
      targetInvestigadorId === 'undefined' ||
      targetInvestigadorId === 'null' ||
      targetInvestigadorId === '0' ||
      targetInvestigadorId === ''
    ) {
      targetInvestigadorId = null;
    }

    // Filtros de Rol por Usuario autenticado
    const userName = req.user ? (req.user.nombre || '').toLowerCase() : '';
    const userEmail = req.user ? (req.user.email || '').toLowerCase() : '';
    const isNormaBermejo =
      userName.includes('norma') ||
      userName.includes('bermejo') ||
      userEmail.includes('norma') ||
      userEmail.includes('bermejo');

    let esSoloAnalista = false;

    if (req.user) {
      const userRol = (req.user.rol || '').toLowerCase();
      const rolesArray = userRol.split(',').map((r) => r.trim());
      const esAdminOAsignador =
        rolesArray.some((r) =>
          ['admin', 'superadmin', 'asignador', 'supervisor', 'coordinadora_analistas', 'coordinador_analistas', 'gerente_analistas'].includes(r)
        ) || isNormaBermejo;
      const esSoloValidador = rolesArray.includes('validador') && !esAdminOAsignador;
      esSoloAnalista = rolesArray.includes('analista') && !esAdminOAsignador && !isNormaBermejo;
      const esInvestigadorCampo =
        rolesArray.some((r) => ['investigador', 'investigador_campo'].includes(r)) &&
        !esAdminOAsignador &&
        !rolesArray.includes('validador');

      // Solo si es un investigador de campo puro se fuerza a filtrar por sus propias asignaciones
      if (req.user.id && !targetInvestigadorId) {
        if (esInvestigadorCampo) {
          targetInvestigadorId = req.user.id;
        }
      }

      // VALIDADOR PURO (sin rol asignador ni admin): Solo ve cuando todas las visitas del crédito están completadas o con visita reagendada
      if (esSoloValidador) {
        whereClauses.push(`NOT EXISTS (
          SELECT 1 
          FROM investigaciones inv_sub 
          WHERE inv_sub.solicitud_id_sif = inv.solicitud_id_sif
            AND (inv_sub.estado IS NULL OR inv_sub.estado NOT IN ('COMPLETADA', 'REAGENDADA', 'VALIDADA', 'APROBADA_FINAL'))
        )`);
      }

      // ANALISTA PURO (excepto Norma Bermejo / supervisores): solo puede ver investigaciones con estado_validacion = 'VALIDADA'
      // que hayan sido expresamente asignadas a él por su supervisora (Norma Bermejo)
      if (esSoloAnalista) {
        queryParams.push(req.user.id);
        whereClauses.push(`inv.estado_validacion = 'VALIDADA'`);
        whereClauses.push(`CAST(inv.analista_id AS TEXT) = CAST($${queryParams.length} AS TEXT)`);
      }
    }

    const page = Math.max(1, parseInt(req.query.page || '1'));
    // Calcular límite considerando el targetInvestigadorId inferido por el token JWT
    const limit = Math.max(1, parseInt(req.query.limit || (targetInvestigadorId ? '500' : '50')));
    const offset = (page - 1) * limit;

    if (estado) {
      if (estado === 'PENDIENTE') {
        whereClauses.push(`(inv.estado IS NULL OR inv.estado = 'PENDIENTE' OR inv.estado = 'EN_PROCESO' OR inv.estado = 'REAGENDADA')`);
      } else if (estado === 'TODAS') {
        // Muestra todas las investigaciones históricas sin canceladas
        whereClauses.push(`(inv.estado IS NULL OR inv.estado != 'CANCELADA')`);
      } else if (estado === 'CANCELADA') {
        whereClauses.push(`inv.estado = 'CANCELADA'`);
      } else {
        queryParams.push(estado);
        whereClauses.push(`inv.estado = $${queryParams.length}`);
      }
    } else {
      // Por defecto (cola activa sin filtro explícito), ocultar investigaciones ya validadas, aprobadas o canceladas
      // NOTA: Para Norma Bermejo o Analistas, se permiten ver las validadas asignadas a ellos (excluyendo solo canceladas)
      if (!isNormaBermejo && !esSoloAnalista) {
        whereClauses.push(`(inv.estado IS NULL OR inv.estado NOT IN ('VALIDADA', 'APROBADA_FINAL', 'CANCELADA'))`);
      } else {
        whereClauses.push(`(inv.estado IS NULL OR inv.estado != 'CANCELADA')`);
      }
    }

    if (targetInvestigadorId) {
      queryParams.push(targetInvestigadorId);
      whereClauses.push(`inv.investigador_id = $${queryParams.length}`);
    }

    if (sucursal) {
      const sucursalStr = String(sucursal).trim();
      const sucursalParts = sucursalStr.split(',').map((s) => s.trim()).filter(Boolean);
      const allNumbers = sucursalParts.length > 0 && sucursalParts.every((s) => !isNaN(parseInt(s, 10)));

      if (allNumbers) {
        if (sucursalParts.length === 1) {
          queryParams.push(parseInt(sucursalParts[0], 10));
          whereClauses.push(`s.sucursal_id = $${queryParams.length}`);
        } else {
          const nums = sucursalParts.map((s) => parseInt(s, 10));
          queryParams.push(nums);
          whereClauses.push(`s.sucursal_id = ANY($${queryParams.length}::int[])`);
        }
      } else {
        queryParams.push(`%${sucursalStr}%`);
        whereClauses.push(`s.sucursal_nombre ILIKE $${queryParams.length}`);
      }
    }

    if (colonia) {
      queryParams.push(colonia.trim());
      whereClauses.push(`TRIM(d.colonia) = $${queryParams.length}`);
    }

    if (buscar) {
      queryParams.push(`%${buscar}%`);
      whereClauses.push(`(
        p.nombre_completo ILIKE $${queryParams.length} OR 
        s.folio ILIKE $${queryParams.length} OR 
        CAST(inv.id_sif_research AS TEXT) ILIKE $${queryParams.length} OR
        d.colonia ILIKE $${queryParams.length}
      )`);
    }

    // Filtro por Estado de Paquete (Multivisitas Solicitante + Avales)
    if (paquete_completo) {
      if (paquete_completo === 'COMPLETO' || paquete_completo === 'true' || paquete_completo === '1') {
        // Paquetes multivisita (> 1) donde todas las investigaciones del crédito están completadas en campo
        whereClauses.push(`(
          SELECT COUNT(*) 
          FROM investigaciones i2 
          WHERE i2.solicitud_id_sif = inv.solicitud_id_sif 
            AND (i2.estado IS NULL OR i2.estado != 'CANCELADA')
        ) > 1`);
        whereClauses.push(`NOT EXISTS (
          SELECT 1 
          FROM investigaciones inv_sub 
          WHERE inv_sub.solicitud_id_sif = inv.solicitud_id_sif
            AND (inv_sub.estado IS NULL OR inv_sub.estado NOT IN ('COMPLETADA', 'VALIDADA', 'APROBADA_FINAL'))
            AND (inv_sub.estado_validacion IS NULL OR inv_sub.estado_validacion != 'VALIDADA')
            AND (inv_sub.estado IS NULL OR inv_sub.estado != 'CANCELADA')
        )`);
      } else if (paquete_completo === 'INCOMPLETO') {
        // Paquetes multivisita (> 1) donde aún faltan visitas por completar
        whereClauses.push(`(
          SELECT COUNT(*) 
          FROM investigaciones i2 
          WHERE i2.solicitud_id_sif = inv.solicitud_id_sif 
            AND (i2.estado IS NULL OR i2.estado != 'CANCELADA')
        ) > 1`);
        whereClauses.push(`EXISTS (
          SELECT 1 
          FROM investigaciones inv_sub 
          WHERE inv_sub.solicitud_id_sif = inv.solicitud_id_sif
            AND (inv_sub.estado IS NULL OR inv_sub.estado NOT IN ('COMPLETADA', 'VALIDADA', 'APROBADA_FINAL'))
            AND (inv_sub.estado_validacion IS NULL OR inv_sub.estado_validacion != 'VALIDADA')
            AND (inv_sub.estado IS NULL OR inv_sub.estado != 'CANCELADA')
        )`);
      } else if (paquete_completo === 'TODAS_LISTAS') {
        // Cualquier crédito (individual o multivisita) donde el 100% de visitas fueron completadas
        whereClauses.push(`NOT EXISTS (
          SELECT 1 
          FROM investigaciones inv_sub 
          WHERE inv_sub.solicitud_id_sif = inv.solicitud_id_sif
            AND (inv_sub.estado IS NULL OR inv_sub.estado NOT IN ('COMPLETADA', 'VALIDADA', 'APROBADA_FINAL'))
            AND (inv_sub.estado_validacion IS NULL OR inv_sub.estado_validacion != 'VALIDADA')
            AND (inv_sub.estado IS NULL OR inv_sub.estado != 'CANCELADA')
        )`);
      }
    }

    // Regla de 90 días: En la cola activa y filtros de operación diaria,
    // ocultar investigaciones de más de 90 días para mantener la cola limpia y ágil.
    // Solo si se solicita explícitamente ver 'TODAS' (histórico) o si se busca un término concreto (buscar)
    // se permite consultar más allá de 90 días.
    const esHistoricoOBusqueda = (estado === 'TODAS' || estado === 'CANCELADA' || Boolean(buscar));
    if (!esHistoricoOBusqueda) {
      whereClauses.push(`inv.created_at >= NOW() - INTERVAL '90 days'`);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const necesitaDireccionEnCount = Boolean(colonia || buscar);

    const countQuery = `
      SELECT count(*)
      FROM investigaciones inv
      LEFT JOIN personas p ON inv.persona_id_sif = p.id_sif
      LEFT JOIN solicitudes_credito s ON inv.solicitud_id_sif = s.id_sif
      ${necesitaDireccionEnCount ? `
      LEFT JOIN LATERAL (
        SELECT d.colonia
        FROM direcciones d
        WHERE d.persona_id_sif = p.id_sif
        ORDER BY 
          CASE WHEN s.direccion_id_sif IS NOT NULL AND d.id_sif = s.direccion_id_sif THEN 1 ELSE 0 END DESC,
          COALESCE(d.es_principal, FALSE) DESC,
          COALESCE(d.activa, TRUE) DESC,
          COALESCE(d.updated_at, '1970-01-01'::timestamp) DESC,
          d.id_sif DESC
        LIMIT 1
      ) d ON TRUE` : ''}
      ${whereSql};
    `;

    const countParams = [...queryParams];

    queryParams.push(limit);
    const limitIndex = queryParams.length;
    queryParams.push(offset);
    const offsetIndex = queryParams.length;

    let orderClause = '';
    let outerOrderClause = '';

    if (estado && ['COMPLETADA', 'VALIDADA', 'APROBADA_FINAL', 'HISTORICO'].includes(estado.toUpperCase())) {
      orderClause = 'ORDER BY COALESCE(inv.fecha_cumplimiento, inv.fecha_asignacion, inv.created_at) DESC, inv.id_sif_research DESC';
      outerOrderClause = 'ORDER BY COALESCE(pag.fecha_cumplimiento, pag.fecha_asignacion, pag.created_at) DESC, pag.id_sif_research DESC;';
    } else {
      // Cola activa o pendientes: De las más nuevas hacia abajo (DESC), priorizando pendientes sobre completadas
      orderClause = `ORDER BY 
        CASE WHEN inv.estado IN ('COMPLETADA', 'VALIDADA', 'APROBADA_FINAL') THEN 1 ELSE 0 END ASC,
        COALESCE(inv.created_at, inv.fecha_asignacion) DESC, 
        inv.id_sif_research DESC`;
      outerOrderClause = `ORDER BY 
        CASE WHEN pag.estado IN ('COMPLETADA', 'VALIDADA', 'APROBADA_FINAL') THEN 1 ELSE 0 END ASC,
        COALESCE(pag.created_at, pag.fecha_asignacion) DESC, 
        pag.id_sif_research DESC;`;
    }

    const dataQuery = `
      WITH paginated AS (
        SELECT 
          inv.id_sif_research,
          inv.solicitud_id_sif,
          inv.persona_id_sif,
          inv.tipo_sujeto,
          inv.investigador_id,
          inv.fecha_asignacion,
          inv.fecha_cumplimiento,
          inv.created_at,
          COALESCE(inv.estado, 'PENDIENTE') as estado,
          inv.observaciones_sif,
          inv.estado_validacion,
          inv.validador_id,
          inv.fecha_validacion,
          inv.comentarios_validacion,
          inv.analista_id,
          inv.fecha_asignacion_analista,
          inv.fecha_revalidacion,
          inv.comentarios_revalidacion,
          p.nombre_completo as sujeto_nombre,
          CASE 
            WHEN s.cliente_id_sif IS NOT NULL AND CAST(inv.persona_id_sif AS TEXT) = CAST(s.cliente_id_sif AS TEXT) THEN 'SOLICITANTE'
            WHEN s.cliente_id_sif IS NOT NULL AND CAST(inv.persona_id_sif AS TEXT) != CAST(s.cliente_id_sif AS TEXT) THEN 'AVAL'
            ELSE COALESCE(inv.tipo_sujeto, 'SOLICITANTE')
          END as tipo_sujeto,
          CASE 
            WHEN s.cliente_id_sif IS NOT NULL AND CAST(inv.persona_id_sif AS TEXT) = CAST(s.cliente_id_sif AS TEXT) THEN FALSE
            WHEN s.cliente_id_sif IS NOT NULL AND CAST(inv.persona_id_sif AS TEXT) != CAST(s.cliente_id_sif AS TEXT) THEN TRUE
            ELSE COALESCE(p.es_aval, FALSE)
          END as es_aval,
          p.estado_contacto_semaforo,
          COALESCE(p.telefono_principal, p.celular, p.telefono) as telefono_principal,
          p.celular,
          p.telefono,
          p.telefono_secundario,
          p.curp,
          p.rfc,
          p.clave_elector,
          p.nivel_riesgo,
          s.folio as solicitud_folio,
          s.monto_solicitado,
          s.sucursal_id,
          s.sucursal_nombre,
          s.cliente_id_sif,
          p_sol.nombre_completo as solicitante_nombre,
          d.calle,
          d.numero_exterior,
          d.codigo_postal,
          d.colonia,
          d.municipio,
          d.estado_provincia,
          d.latitud,
          d.longitud,
          d.domicilio_validado_sucursal,
          inv_usr.nombre as investigador_nombre,
          val_usr.nombre as validador_nombre,
          an_usr.nombre as analista_nombre
        FROM investigaciones inv
        LEFT JOIN personas p ON inv.persona_id_sif = p.id_sif
        LEFT JOIN solicitudes_credito s ON inv.solicitud_id_sif = s.id_sif
        LEFT JOIN personas p_sol ON s.cliente_id_sif = p_sol.id_sif
        LEFT JOIN LATERAL (
          SELECT 
            d.calle,
            d.numero_exterior,
            d.codigo_postal,
            d.colonia,
            d.municipio,
            d.estado_provincia,
            d.latitud,
            d.longitud,
            d.domicilio_validado_sucursal
          FROM direcciones d
          WHERE d.persona_id_sif = p.id_sif
          ORDER BY 
            CASE WHEN s.direccion_id_sif IS NOT NULL AND d.id_sif = s.direccion_id_sif THEN 1 ELSE 0 END DESC,
            COALESCE(d.es_principal, FALSE) DESC,
            COALESCE(d.activa, TRUE) DESC,
            COALESCE(d.updated_at, '1970-01-01'::timestamp) DESC,
            d.id_sif DESC
          LIMIT 1
        ) d ON TRUE
        LEFT JOIN investigadores inv_usr ON inv.investigador_id = inv_usr.id
        LEFT JOIN investigadores val_usr ON inv.validador_id = val_usr.id
        LEFT JOIN investigadores an_usr ON inv.analista_id = an_usr.id
        ${whereSql}
        ${orderClause}
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      )
      SELECT 
        pag.*,
        -- PROGRESO DEL PAQUETE DEL CRÉDITO (Solicitante + Avales)
        COALESCE(paq.paquete_total, 1) as paquete_total,
        COALESCE(paq.paquete_completadas, 0) as paquete_completadas,
        COALESCE(paq.paquete_validadas, 0) as paquete_validadas,
        COALESCE(paq.paquete_todo_validado, false) as paquete_todo_validado,
        (COALESCE(paq.paquete_total, 1) = COALESCE(paq.paquete_completadas, 0)) as paquete_completo,
        -- VIGENCIA 90 DÍAS
        vigencia.visita_previa_id,
        vigencia.visita_realizada_en,
        vigencia.visita_vigente_hasta,
        (vigencia.visita_vigente_hasta IS NOT NULL AND vigencia.visita_vigente_hasta > NOW()) AS visita_vigente
      FROM paginated pag
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*) as paquete_total,
          COUNT(*) FILTER (WHERE inv_p.estado IN ('COMPLETADA', 'VALIDADA', 'APROBADA_FINAL') OR inv_p.estado_validacion = 'VALIDADA') as paquete_completadas,
          COUNT(*) FILTER (WHERE inv_p.estado_validacion = 'VALIDADA') as paquete_validadas,
          (COUNT(*) > 0 AND COUNT(*) = COUNT(*) FILTER (WHERE inv_p.estado_validacion = 'VALIDADA')) as paquete_todo_validado
        FROM investigaciones inv_p
        WHERE inv_p.solicitud_id_sif = pag.solicitud_id_sif
          AND (inv_p.estado IS NULL OR inv_p.estado != 'CANCELADA')
      ) paq ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          inv2.id_sif_research AS visita_previa_id,
          ev2.created_at AS visita_realizada_en,
          (ev2.created_at + INTERVAL '90 days') AS visita_vigente_hasta
        FROM evidencias_visita ev2
        JOIN investigaciones inv2 ON ev2.investigacion_id_sif = inv2.id_sif_research
        WHERE inv2.persona_id_sif = pag.persona_id_sif
          AND ev2.created_at >= NOW() - INTERVAL '90 days'
          AND inv2.id_sif_research != pag.id_sif_research
        ORDER BY ev2.created_at DESC
        LIMIT 1
      ) vigencia ON TRUE
      ${outerOrderClause}
    `;

    const totalRes = await db.query(countQuery, countParams);
    const { rows } = await db.query(dataQuery, queryParams);

    const total = parseInt(totalRes.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // Enriquecer cada fila con la evaluación de consistencia de la persona
    const enrichedRows = rows.map((row) => {
      const inconsistenciasInfo = evaluarInconsistenciasPersona(row);
      return {
        ...row,
        ...inconsistenciasInfo,
      };
    });

    res.json({
      total,
      page,
      limit,
      totalPages,
      data: enrichedRows,
    });
  } catch (err) {
    next(err);
  }
}

async function getInvestigacionDetalle(req, res, next) {
  try {
    const id = req.params.id;

    // 1. Investigacion principal
    const invRes = await db.query(`
      SELECT 
        inv.id_sif_research,
        inv.solicitud_id_sif,
        inv.persona_id_sif,
        CASE 
          WHEN s.cliente_id_sif IS NOT NULL AND CAST(inv.persona_id_sif AS TEXT) = CAST(s.cliente_id_sif AS TEXT) THEN 'SOLICITANTE'
          WHEN s.cliente_id_sif IS NOT NULL AND CAST(inv.persona_id_sif AS TEXT) != CAST(s.cliente_id_sif AS TEXT) THEN 'AVAL'
          ELSE COALESCE(inv.tipo_sujeto, 'SOLICITANTE')
        END as tipo_sujeto,
        inv.investigador_id,
        inv.fecha_asignacion,
        inv.fecha_cumplimiento,
        inv.created_at,
        COALESCE(inv.estado, 'PENDIENTE') as estado,
        inv.observaciones_sif,
        inv.folio_solventado,
        inv.justificacion_folio,
        inv.comprobante_folio_url,
        p.nombre_completo as sujeto_nombre,
        p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido,
        p.genero,
        CASE 
          WHEN s.cliente_id_sif IS NOT NULL AND CAST(inv.persona_id_sif AS TEXT) = CAST(s.cliente_id_sif AS TEXT) THEN FALSE
          WHEN s.cliente_id_sif IS NOT NULL AND CAST(inv.persona_id_sif AS TEXT) != CAST(s.cliente_id_sif AS TEXT) THEN TRUE
          ELSE COALESCE(p.es_aval, FALSE)
        END as es_aval,
        p.estado_contacto_semaforo,
        COALESCE(p.telefono_principal, p.celular, p.telefono) as telefono_principal,
        p.celular,
        p.telefono,
        p.telefono_secundario,
        p.curp,
        p.rfc,
        p.clave_elector,
        p.nivel_riesgo,
        s.folio as solicitud_folio,
        s.monto_solicitado,
        s.monto_aprobado,
        s.sucursal_id,
        s.sucursal_nombre,
        s.cliente_id_sif,
        p_sol.nombre_completo as solicitante_nombre,
        p_sol.curp as solicitante_curp,
        p_sol.rfc as solicitante_rfc,
        COALESCE(p_sol.telefono_principal, p_sol.celular, p_sol.telefono) as solicitante_telefono,
        d_sol.calle as solicitante_calle,
        d_sol.numero_exterior as solicitante_numero_exterior,
        d_sol.numero_interior as solicitante_numero_interior,
        d_sol.codigo_postal as solicitante_codigo_postal,
        d_sol.colonia as solicitante_colonia,
        d_sol.municipio as solicitante_municipio,
        d_sol.estado_provincia as solicitante_estado_provincia,
        d.calle, d.numero_exterior, d.numero_interior, d.codigo_postal, d.colonia, d.municipio, d.estado_provincia, d.referencias, d.latitud, d.longitud,
        d.domicilio_validado_sucursal,
        inv_usr.nombre as investigador_nombre,
        inv_usr.telefono as investigador_telefono,
        inv.estado_validacion,
        inv.fecha_validacion,
        inv.comentarios_validacion,
        val_usr.nombre as validador_nombre,
        inv.analista_id,
        inv.fecha_asignacion_analista,
        an_usr.nombre as analista_nombre,
        inv.fecha_revalidacion,
        inv.comentarios_revalidacion
      FROM investigaciones inv
      LEFT JOIN personas p ON CAST(inv.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
      LEFT JOIN solicitudes_credito s ON CAST(inv.solicitud_id_sif AS TEXT) = CAST(s.id_sif AS TEXT)
      LEFT JOIN personas p_sol ON CAST(s.cliente_id_sif AS TEXT) = CAST(p_sol.id_sif AS TEXT)
      LEFT JOIN LATERAL (
        SELECT 
          d.calle, d.numero_exterior, d.numero_interior, d.codigo_postal, d.colonia, d.municipio, d.estado_provincia
        FROM direcciones d
        WHERE d.persona_id_sif = p_sol.id_sif
        ORDER BY 
          CASE WHEN s.direccion_id_sif IS NOT NULL AND d.id_sif = s.direccion_id_sif THEN 1 ELSE 0 END DESC,
          COALESCE(d.es_principal, FALSE) DESC,
          COALESCE(d.activa, TRUE) DESC,
          COALESCE(d.updated_at, '1970-01-01'::timestamp) DESC,
          d.id_sif DESC
        LIMIT 1
      ) d_sol ON TRUE
      LEFT JOIN LATERAL (
        SELECT 
          d.calle, d.numero_exterior, d.numero_interior, d.codigo_postal, d.colonia, d.municipio, d.estado_provincia, d.referencias, d.latitud, d.longitud,
          d.domicilio_validado_sucursal
        FROM direcciones d
        WHERE d.persona_id_sif = p.id_sif
        ORDER BY 
          CASE WHEN s.direccion_id_sif IS NOT NULL AND d.id_sif = s.direccion_id_sif THEN 1 ELSE 0 END DESC,
          COALESCE(d.es_principal, FALSE) DESC,
          COALESCE(d.activa, TRUE) DESC,
          COALESCE(d.updated_at, '1970-01-01'::timestamp) DESC,
          d.id_sif DESC
        LIMIT 1
      ) d ON TRUE
      LEFT JOIN investigadores inv_usr ON inv.investigador_id = inv_usr.id
      LEFT JOIN investigadores val_usr ON inv.validador_id = val_usr.id
      LEFT JOIN investigadores an_usr ON inv.analista_id = an_usr.id
      WHERE CAST(inv.id_sif_research AS TEXT) = CAST($1 AS TEXT)
      LIMIT 1;
    `, [id]);

    if (invRes.rows.length === 0) {
      return res.status(404).json({ error: 'Investigación no encontrada' });
    }

    // Validación de seguridad para analistas: solo pueden consultar si les fue asignada por supervisión
    const userNameDet = req.user ? (req.user.nombre || '').toLowerCase() : '';
    const userEmailDet = req.user ? (req.user.email || '').toLowerCase() : '';
    const isNormaBermejoDet =
      userNameDet.includes('norma') ||
      userNameDet.includes('bermejo') ||
      userEmailDet.includes('norma') ||
      userEmailDet.includes('bermejo');
    const userRolDet = (req.user?.rol || '').toLowerCase();
    const rolesArrayDet = userRolDet.split(',').map((r) => r.trim());
    const esAdminOAsignadorDet =
      rolesArrayDet.some((r) =>
        ['admin', 'superadmin', 'asignador', 'supervisor', 'coordinadora_analistas', 'coordinador_analistas', 'gerente_analistas'].includes(r)
      ) || isNormaBermejoDet;
    const esSoloAnalistaDet = rolesArrayDet.includes('analista') && !esAdminOAsignadorDet && !isNormaBermejoDet;

    if (esSoloAnalistaDet) {
      if (!invRes.rows[0].analista_id || String(invRes.rows[0].analista_id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'No tienes permiso para consultar esta investigación porque no ha sido asignada a tu usuario.' });
      }
    }

    const inconsistenciasDetalle = evaluarInconsistenciasPersona(invRes.rows[0]);
    const investigacion = {
      ...invRes.rows[0],
      ...inconsistenciasDetalle,
    };

    // 2. Avales e Investigaciones vinculadas al mismo Crédito
    let avales = [];
    let paqueteInvestigaciones = [];
    if (investigacion.solicitud_id_sif) {
      const avalesRes = await db.query(`
        SELECT DISTINCT ON (sub.aval_id_sif)
          sub.aval_id_sif,
          sub.nombre_completo,
          COALESCE(sub.telefono_principal, sub.celular, sub.telefono) as telefono,
          sub.celular,
          sub.telefono as telefono_fijo,
          d.calle, d.numero_exterior, d.codigo_postal
        FROM (
          SELECT 
            sa.aval_id_sif,
            p.nombre_completo,
            p.telefono_principal,
            p.celular,
            p.telefono
          FROM solicitud_avales sa
          JOIN personas p ON CAST(sa.aval_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
          WHERE CAST(sa.solicitud_id_sif AS TEXT) = CAST($1 AS TEXT)
            AND CAST(sa.aval_id_sif AS TEXT) != CAST(COALESCE($2, '') AS TEXT)
          
          UNION ALL
          
          SELECT 
            inv_a.persona_id_sif as aval_id_sif,
            p.nombre_completo,
            p.telefono_principal,
            p.celular,
            p.telefono
          FROM investigaciones inv_a
          JOIN personas p ON CAST(inv_a.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
          WHERE CAST(inv_a.solicitud_id_sif AS TEXT) = CAST($1 AS TEXT)
            AND CAST(inv_a.persona_id_sif AS TEXT) != CAST(COALESCE($2, '') AS TEXT)
        ) sub
        LEFT JOIN LATERAL (
          SELECT d.calle, d.numero_exterior, d.codigo_postal
          FROM direcciones d
          WHERE d.persona_id_sif = sub.aval_id_sif
          ORDER BY 
            COALESCE(d.es_principal, FALSE) DESC,
            COALESCE(d.activa, TRUE) DESC,
            COALESCE(d.updated_at, '1970-01-01'::timestamp) DESC,
            d.id_sif DESC
          LIMIT 1
        ) d ON TRUE;
      `, [investigacion.solicitud_id_sif, investigacion.cliente_id_sif]);
      avales = avalesRes.rows;

      const paqueteRes = await db.query(`
        SELECT 
          inv_p.id_sif_research,
          inv_p.persona_id_sif,
          CASE 
            WHEN s_p.cliente_id_sif IS NOT NULL AND CAST(inv_p.persona_id_sif AS TEXT) = CAST(s_p.cliente_id_sif AS TEXT) THEN 'SOLICITANTE'
            ELSE 'AVAL'
          END as tipo_sujeto,
          CASE 
            WHEN s_p.cliente_id_sif IS NOT NULL AND CAST(inv_p.persona_id_sif AS TEXT) = CAST(s_p.cliente_id_sif AS TEXT) THEN FALSE
            ELSE TRUE
          END as es_aval,
          COALESCE(inv_p.estado, 'PENDIENTE') as estado,
          inv_p.estado_validacion,
          p.nombre_completo as sujeto_nombre
        FROM investigaciones inv_p
        LEFT JOIN solicitudes_credito s_p ON CAST(inv_p.solicitud_id_sif AS TEXT) = CAST(s_p.id_sif AS TEXT)
        LEFT JOIN personas p ON CAST(inv_p.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
        WHERE CAST(inv_p.solicitud_id_sif AS TEXT) = CAST($1 AS TEXT)
          AND (inv_p.estado IS NULL OR inv_p.estado != 'CANCELADA')
        ORDER BY 
          CASE WHEN s_p.cliente_id_sif IS NOT NULL AND CAST(inv_p.persona_id_sif AS TEXT) = CAST(s_p.cliente_id_sif AS TEXT) THEN 0 ELSE 1 END ASC,
          inv_p.id_sif_research ASC;
      `, [investigacion.solicitud_id_sif]);
      paqueteInvestigaciones = paqueteRes.rows;
    }

    // 3. Evidencia realizada (con consolidación de fotos y firmas)
    const evRes = await db.query(
      'SELECT * FROM evidencias_visita WHERE CAST(investigacion_id_sif AS TEXT) = CAST($1 AS TEXT) ORDER BY COALESCE(solventado_en, created_at) DESC, id DESC;',
      [id]
    );

    let evidencia = null;
    if (evRes.rows.length > 0) {
      evidencia = { ...evRes.rows[0] };
      // Consolidar fotos
      if (!Array.isArray(evidencia.fotos_urls) || evidencia.fotos_urls.length === 0) {
        const conFotos = evRes.rows.find(r => Array.isArray(r.fotos_urls) && r.fotos_urls.length > 0);
        if (conFotos) {
          evidencia.fotos_urls = conFotos.fotos_urls;
        }
      }
      // Consolidar firmas
      if (!evidencia.firma_url) {
        const conFirma = evRes.rows.find(r => r.firma_url);
        if (conFirma) evidencia.firma_url = conFirma.firma_url;
      }
      if (!evidencia.firma_investigador_url) {
        const conFirmaInv = evRes.rows.find(r => r.firma_investigador_url);
        if (conFirmaInv) evidencia.firma_investigador_url = conFirmaInv.firma_investigador_url;
      }
      // Consolidar campos del estudio socioeconómico (preservando los valores más recientes de la edición, incluyendo 0 y strings vacíos)
      let mergedEstudio = typeof evidencia.estudio_socioeconomico === 'object' && evidencia.estudio_socioeconomico ? { ...evidencia.estudio_socioeconomico } : {};
      for (const row of evRes.rows.slice(1)) {
        if (row.estudio_socioeconomico && typeof row.estudio_socioeconomico === 'object') {
          for (const [key, val] of Object.entries(row.estudio_socioeconomico)) {
            if ((mergedEstudio[key] === undefined || mergedEstudio[key] === null) && (val !== null && val !== undefined)) {
              mergedEstudio[key] = val;
            }
          }
        }
      }
      evidencia.estudio_socioeconomico = mergedEstudio;
    }

    // 4. Vigencia 90 días: ¿Esta persona tiene una visita anterior válida en otra investigación?
    let vigenciaPrevia = null;
    if (investigacion.persona_id_sif) {
      const vigenciaRes = await db.query(`
        SELECT
          inv2.id_sif_research AS visita_previa_id,
          inv2.tipo_sujeto AS tipo_previo,
          ev2.created_at AS visita_realizada_en,
          (ev2.created_at + INTERVAL '90 days') AS visita_vigente_hasta,
          ((ev2.created_at + INTERVAL '90 days') > NOW()) AS visita_vigente
        FROM evidencias_visita ev2
        JOIN investigaciones inv2 ON CAST(ev2.investigacion_id_sif AS TEXT) = CAST(inv2.id_sif_research AS TEXT)
        WHERE CAST(inv2.persona_id_sif AS TEXT) = CAST($1 AS TEXT)
          AND ev2.created_at >= NOW() - INTERVAL '90 days'
          AND CAST(inv2.id_sif_research AS TEXT) != CAST($2 AS TEXT)
        ORDER BY ev2.created_at DESC
        LIMIT 1;
      `, [investigacion.persona_id_sif, id]);

      if (vigenciaRes.rows.length > 0) {
        vigenciaPrevia = vigenciaRes.rows[0];
      }
    }

    const solicitante = {
      nombre_completo: investigacion.solicitante_nombre || null,
      curp: investigacion.solicitante_curp || null,
      rfc: investigacion.solicitante_rfc || null,
      telefono: investigacion.solicitante_telefono || null,
      calle: investigacion.solicitante_calle || null,
      numero_exterior: investigacion.solicitante_numero_exterior || null,
      numero_interior: investigacion.solicitante_numero_interior || null,
      codigo_postal: investigacion.solicitante_codigo_postal || null,
      colonia: investigacion.solicitante_colonia || null,
      municipio: investigacion.solicitante_municipio || null,
      estado_provincia: investigacion.solicitante_estado_provincia || null,
    };

    res.json({
      investigacion,
      solicitante,
      avales,
      paqueteInvestigaciones,
      evidencia,
      vigenciaPrevia,
    });
  } catch (err) {
    next(err);
  }
}

async function asignarInvestigador(req, res, next) {
  try {
    const userName = req.user ? (req.user.nombre || '').toLowerCase() : '';
    const userEmail = req.user ? (req.user.email || '').toLowerCase() : '';
    const isNormaBermejo = userName.includes('norma') || userName.includes('bermejo') || userEmail.includes('norma') || userEmail.includes('bermejo');
    const userRol = req.user ? (req.user.rol || '').toLowerCase() : '';

    if (isNormaBermejo || userRol === 'analista') {
      return res.status(403).json({ error: 'Acceso denegado: El usuario no tiene permisos para asignar investigaciones.' });
    }

    const id = req.params.id;
    const { investigador_id } = req.body;

    if (!investigador_id) {
      return res.status(400).json({ error: 'ID de investigador requerido' });
    }

    // Obtener el estado anterior para el audit log
    const { rows: prev } = await db.query(
      `SELECT investigador_id, estado FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT)`,
      [id]
    );

    await db.query(`
      UPDATE investigaciones 
      SET investigador_id = $1, origen_asignacion = 'PLATAFORMA_CPO', asignacion_manual = TRUE, fecha_asignacion = NOW(), estado = 'EN_PROCESO', updated_at = NOW()
      WHERE CAST(id_sif_research AS TEXT) = CAST($2 AS TEXT);
    `, [investigador_id, id]);

    // Registrar en bitácora de auditoría (fire-and-forget)
    registrarAuditoria({
      usuario_id: req.user?.id || null,
      usuario_nombre: req.user?.nombre || req.user?.email || 'Sistema',
      usuario_rol: req.user?.rol || 'sistema',
      accion: 'ASIGNAR_INVESTIGADOR',
      recurso: 'investigaciones',
      recurso_id: String(id),
      descripcion: `Asignación del investigador ID ${investigador_id} a la investigación SIF ${id}`,
      ip_origen: req.ip || req.headers['x-forwarded-for'],
      user_agent: req.headers['user-agent'],
      datos_anteriores: prev[0] || null,
      datos_nuevos: { investigador_id, estado: 'EN_PROCESO' },
    });

    res.json({ success: true, message: 'Investigador asignado correctamente' });
  } catch (err) {
    next(err);
  }
}

async function asignarInvestigadorLote(req, res, next) {
  try {
    const userName = req.user ? (req.user.nombre || '').toLowerCase() : '';
    const userEmail = req.user ? (req.user.email || '').toLowerCase() : '';
    const isNormaBermejo = userName.includes('norma') || userName.includes('bermejo') || userEmail.includes('norma') || userEmail.includes('bermejo');
    const userRol = req.user ? (req.user.rol || '').toLowerCase() : '';

    if (isNormaBermejo || userRol === 'analista') {
      return res.status(403).json({ error: 'Acceso denegado: El usuario no tiene permisos para asignar investigaciones.' });
    }

    const { investigacion_ids, investigador_id } = req.body;

    if (!Array.isArray(investigacion_ids) || investigacion_ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere una lista de IDs de investigaciones (investigacion_ids).' });
    }

    if (!investigador_id) {
      return res.status(400).json({ error: 'ID de investigador requerido (investigador_id).' });
    }

    // Convertir todos los IDs a string para evitar problemas de tipos
    const idsClean = investigacion_ids.map((id) => String(id));

    const result = await db.query(
      `UPDATE investigaciones
       SET investigador_id = $1,
           origen_asignacion = 'PLATAFORMA_CPO',
           asignacion_manual = TRUE,
           fecha_asignacion = NOW(),
           estado = 'EN_PROCESO',
           updated_at = NOW()
       WHERE CAST(id_sif_research AS TEXT) = ANY($2::text[])
       RETURNING id_sif_research;`,
      [investigador_id, idsClean]
    );

    const actualizados = result.rows.map((r) => r.id_sif_research);

    // Emitir actualización vía WebSockets
    const io = req.app.get('io');
    if (io) {
      io.emit('investigaciones_actualizadas', {
        tipo: 'ASIGNACION_LOTE',
        investigador_id,
        investigacion_ids: actualizados,
        total: actualizados.length,
      });
    }

    // Registrar en auditoría
    registrarAuditoria({
      usuario_id: req.user?.id || null,
      usuario_nombre: req.user?.nombre || req.user?.email || 'Sistema',
      usuario_rol: req.user?.rol || 'sistema',
      accion: 'ASIGNAR_INVESTIGADOR_LOTE',
      recurso: 'investigaciones',
      recurso_id: actualizados.join(','),
      descripcion: `Asignación en lote de ${actualizados.length} investigaciones al investigador ID ${investigador_id}`,
      datos_nuevos: { investigador_id, total: actualizados.length },
    });

    res.json({
      success: true,
      message: `Se asignaron exitosamente ${actualizados.length} investigaciones al investigador.`,
      asignadas: actualizados,
    });
  } catch (err) {
    next(err);
  }
}

async function guardarEvidencia(req, res, next) {
  try {
    const id = req.params.id;
    const {
      estudio_socioeconomico,
      fotos_urls,
      firma_url,
      firma_investigador_url,
      latitud_checkin,
      longitud_checkin,
      notas_investigador,
      dictamen,
      supuesto
    } = req.body;

    const supuestoValor = supuesto || estudio_socioeconomico?.supuesto || '';
    const dictamenInfo = dictamen ? `Dictamen: ${dictamen}${supuestoValor ? ` [Supuesto: ${supuestoValor}]` : ''}` : '';

    let fotosFinales = Array.isArray(fotos_urls) ? fotos_urls : [];
    let firmaFinal = firma_url || null;
    let firmaInvFinal = firma_investigador_url || null;

    // Si la nueva petición no incluye fotos o firmas, verificar si ya existen en una evidencia previa para conservarlas
    if (fotosFinales.length === 0 || !firmaFinal || !firmaInvFinal) {
      const prevEv = await db.query(
        `SELECT fotos_urls, firma_url, firma_investigador_url 
         FROM evidencias_visita 
         WHERE CAST(investigacion_id_sif AS TEXT) = CAST($1 AS TEXT) 
         ORDER BY created_at DESC 
         LIMIT 1;`,
        [id]
      );
      if (prevEv.rows.length > 0) {
        if (fotosFinales.length === 0 && Array.isArray(prevEv.rows[0].fotos_urls) && prevEv.rows[0].fotos_urls.length > 0) {
          fotosFinales = prevEv.rows[0].fotos_urls;
        }
        if (!firmaFinal && prevEv.rows[0].firma_url) {
          firmaFinal = prevEv.rows[0].firma_url;
        }
        if (!firmaInvFinal && prevEv.rows[0].firma_investigador_url) {
          firmaInvFinal = prevEv.rows[0].firma_investigador_url;
        }
      }
    }

    const latCheckinNum = (latitud_checkin !== undefined && latitud_checkin !== null && !isNaN(Number(latitud_checkin)))
      ? Number(latitud_checkin)
      : null;
    const lngCheckinNum = (longitud_checkin !== undefined && longitud_checkin !== null && !isNaN(Number(longitud_checkin)))
      ? Number(longitud_checkin)
      : null;

    // Detectar si son coordenadas reales válidas (evitando 0,0 y el punto falso histórico 20.6597, -103.3496)
    const esGpsRealValido = latCheckinNum !== null && lngCheckinNum !== null &&
      latCheckinNum !== 0 && lngCheckinNum !== 0 &&
      !(Math.abs(latCheckinNum - 20.6597) < 0.0001 && Math.abs(lngCheckinNum - (-103.3496)) < 0.0001);

    await db.query(`ALTER TABLE evidencias_visita ADD COLUMN IF NOT EXISTS firma_investigador_url TEXT;`);

    await db.query(`
      INSERT INTO evidencias_visita (
        investigacion_id_sif,
        latitud_checkin,
        longitud_checkin,
        fecha_checkin,
        estudio_socioeconomico,
        fotos_urls,
        firma_url,
        firma_investigador_url,
        notas_investigador,
        sincronizado_a_sif,
        created_at
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, TRUE, NOW());
    `, [
      id,
      latCheckinNum,
      lngCheckinNum,
      JSON.stringify(estudio_socioeconomico || {}),
      JSON.stringify(fotosFinales),
      firmaFinal,
      firmaInvFinal,
      notas_investigador || dictamenInfo
    ]);

    // Si se capturaron coordenadas reales válidas en campo, sincronizar la georreferenciación del domicilio en direcciones
    if (esGpsRealValido) {
      try {
        const invInfo = await db.query(
          `SELECT persona_id_sif, solicitud_id_sif FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT) OR CAST(id AS TEXT) = CAST($1 AS TEXT) LIMIT 1;`,
          [id]
        );
        if (invInfo.rows.length > 0 && invInfo.rows[0].persona_id_sif) {
          const personaId = invInfo.rows[0].persona_id_sif;
          if (estudio_socioeconomico?.tiene_direccion_diferente && estudio_socioeconomico?.calle_real) {
            await db.query(`
              UPDATE direcciones
              SET calle = COALESCE($1, calle),
                  colonia = COALESCE($2, colonia),
                  referencias = COALESCE($3, referencias),
                  latitud = $4,
                  longitud = $5,
                  updated_at = NOW()
              WHERE CAST(persona_id_sif AS TEXT) = CAST($6 AS TEXT) AND (es_principal = TRUE OR activa = TRUE);
            `, [
              estudio_socioeconomico.calle_real,
              estudio_socioeconomico.colonia_real || null,
              estudio_socioeconomico.referencias_domicilio || null,
              latCheckinNum,
              lngCheckinNum,
              personaId
            ]);
          } else {
            await db.query(`
              UPDATE direcciones
              SET latitud = $1,
                  longitud = $2,
                  updated_at = NOW()
              WHERE CAST(persona_id_sif AS TEXT) = CAST($3 AS TEXT) AND (latitud IS NULL OR latitud = 0 OR es_principal = TRUE);
            `, [latCheckinNum, lngCheckinNum, personaId]);
          }
        }
      } catch (errDir) {
        console.error('Aviso: No se pudo actualizar georreferenciación en tabla direcciones:', errDir.message);
      }
    }

    // Detección de visita con cita o folio
    const esCitaOFolio = 
      (supuestoValor && /con\s*(folio|cita)/i.test(supuestoValor.trim())) ||
      (dictamen && /pendiente/i.test(dictamen) && /folio|cita/i.test(supuestoValor || ''));

    if (esCitaOFolio) {
      // 1. NO se marca como COMPLETADA.
      // 2. Se pasa a estado 'REAGENDADA' y se desasigna el investigador (investigador_id = NULL)
      //    para que pase directamente a la bandeja del Asignador como pendiente de asignación (Opción A).
      // 3. Se guarda el ticket/supuesto en observaciones_sif para informar tanto al asignador como al validador.
      const obsReagenda = notas_investigador
        ? `${notas_investigador} [REAGENDADA: Visita de campo registrada ${supuestoValor ? `con ${supuestoValor}` : ''} - Turnada a reasignación]`
        : `Visita de campo registrada ${supuestoValor ? `con ${supuestoValor}` : ''}. Turnada al asignador para reagenda y reasignación de fecha.`;

      await db.query(`
        UPDATE investigaciones
        SET estado = 'REAGENDADA',
            investigador_id = NULL,
            fecha_cumplimiento = NULL,
            observaciones_sif = $1,
            origen_asignacion = 'PLATAFORMA_CPO',
            asignacion_manual = TRUE,
            updated_at = NOW()
        WHERE CAST(id_sif_research AS TEXT) = CAST($2 AS TEXT);
      `, [obsReagenda, id]);

      // Registrar auditoría
      registrarAuditoria({
        usuario_id: req.user?.id || null,
        usuario_nombre: req.user?.nombre || req.user?.email || 'Investigador Móvil',
        usuario_rol: req.user?.rol || 'investigador',
        accion: 'VISITA_REAGENDADA_CITA_FOLIO',
        recurso: 'investigaciones',
        recurso_id: String(id),
        descripcion: `Investigación #${id} turnada a reasignación por visita con ${supuestoValor || 'Cita/Folio'}`,
        datos_nuevos: {
          estado: 'REAGENDADA',
          investigador_id: null,
          supuesto: supuestoValor,
          latitud_checkin: latCheckinNum,
          longitud_checkin: lngCheckinNum,
        },
      });

      // Emitir evento WebSocket para actualizar en tiempo real el panel web
      const io = req.app.get('io');
      if (io) {
        io.emit('investigaciones_actualizadas', {
          tipo: 'VISITA_REAGENDADA',
          investigacion_id: id,
          supuesto: supuestoValor,
        });
      }
    } else {
      await db.query(`
        UPDATE investigaciones
        SET estado = 'COMPLETADA', fecha_cumplimiento = NOW(), observaciones_sif = $1, origen_asignacion = 'PLATAFORMA_CPO', asignacion_manual = TRUE, updated_at = NOW()
        WHERE CAST(id_sif_research AS TEXT) = CAST($2 AS TEXT);
      `, [notas_investigador ? `${notas_investigador}${supuestoValor ? ` (Supuesto: ${supuestoValor})` : ''}` : (dictamenInfo || 'Completada desde App Móvil'), id]);

      // Registrar auditoría inalterable de finalización con coordenadas de check-in
      registrarAuditoria({
        usuario_id: req.user?.id || null,
        usuario_nombre: req.user?.nombre || req.user?.email || 'Investigador Móvil',
        usuario_rol: req.user?.rol || 'investigador',
        accion: 'INVESTIGACION_COMPLETADA_MOVIL',
        recurso: 'investigaciones',
        recurso_id: String(id),
        descripcion: `Investigación #${id} completada en campo con dictamen '${dictamen || 'DOMICILIO CONFIRMADO'}'`,
        datos_nuevos: {
          estado: 'COMPLETADA',
          dictamen: dictamen,
          latitud_checkin: latCheckinNum,
          longitud_checkin: lngCheckinNum,
          gps_valido: esGpsRealValido,
          fecha_cumplimiento: new Date(),
        },
      });

      const io = req.app.get('io');
      if (io) {
        io.emit('investigaciones_actualizadas', {
          tipo: 'INVESTIGACION_COMPLETADA',
          investigacion_id: id,
          dictamen: dictamen,
        });
      }
    }

    // Si se capturó o confirmó un teléfono durante la visita, actualizar la tabla personas
    if (estudio_socioeconomico?.telefono_visitado && String(estudio_socioeconomico.telefono_visitado).trim()) {
      const telVisitadoLimpio = String(estudio_socioeconomico.telefono_visitado).trim();
      try {
        await db.query(`
          UPDATE personas
          SET telefono_principal = $1,
              telefono = $1,
              estado_contacto_semaforo = 'VERDE',
              fuente_datos_contacto = 'VISITA_INVESTIGADOR',
              fecha_validacion_contacto = NOW(),
              usuario_validacion_contacto = $2,
              updated_at = NOW()
          WHERE CAST(id_sif AS TEXT) = (
            SELECT CAST(persona_id_sif AS TEXT) 
            FROM investigaciones 
            WHERE CAST(id_sif_research AS TEXT) = CAST($3 AS TEXT) OR CAST(id AS TEXT) = CAST($3 AS TEXT) 
            LIMIT 1
          );
        `, [telVisitadoLimpio, req.user?.nombre || 'Investigador Móvil', id]);
      } catch (errTel) {
        console.error('Aviso: No se pudo actualizar teléfono en tabla personas al guardar visita:', errTel.message);
      }
    }

    res.json({
      success: true,
      reagendada: esCitaOFolio,
      latitud_checkin: latCheckinNum,
      longitud_checkin: lngCheckinNum,
      message: esCitaOFolio
        ? 'Visita con folio/cita registrada correctamente. La investigación ha sido turnada al asignador para su reagenda.'
        : 'Estudio e investigación guardados correctamente',
    });
  } catch (err) {
    next(err);
  }
}

async function validarInvestigacion(req, res, next) {
  try {
    const id = req.params.id;
    const { accion, comentarios } = req.body; // accion: 'VALIDAR' | 'RECHAZAR'

    if (!accion || !['VALIDAR', 'RECHAZAR'].includes(accion)) {
      return res.status(400).json({ error: 'Acción de validación inválida. Debe ser VALIDAR o RECHAZAR.' });
    }

    const nuevoEstado = accion === 'VALIDAR' ? 'VALIDADA' : 'RECHAZADA';
    const validadorId = req.user?.id || null;

    // Asegurar que existan las columnas
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS estado_validacion TEXT;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS validador_id INTEGER;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS fecha_validacion TIMESTAMP;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS comentarios_validacion TEXT;`);

    // Obtener datos anteriores para audit log y verificación de paquete
    const { rows: prev } = await db.query(
      `SELECT estado, observaciones_sif, solicitud_id_sif FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT)`,
      [id]
    );

    if (prev.length === 0) {
      return res.status(404).json({ error: 'Investigación no encontrada' });
    }

    // Si la acción es VALIDAR, verificar que todas las investigaciones del crédito (solicitante y avales) estén completadas
    if (accion === 'VALIDAR' && prev[0].solicitud_id_sif) {
      const { rows: incompletas } = await db.query(`
        SELECT id_sif_research, estado
        FROM investigaciones
        WHERE CAST(solicitud_id_sif AS TEXT) = CAST($1 AS TEXT)
          AND (estado IS NULL OR estado NOT IN ('COMPLETADA', 'VALIDADA', 'APROBADA_FINAL'))
      `, [prev[0].solicitud_id_sif]);

      if (incompletas.length > 0) {
        const tieneReagendada = incompletas.some(r => r.estado === 'REAGENDADA');
        const mensajeError = tieneReagendada
          ? 'No se puede validar esta investigación porque el crédito cuenta con visitas en estado REAGENDADA (con cita o folio) que deben ser cumplimentadas en campo antes de emitir dictamen final.'
          : `No se puede validar esta investigación porque el paquete del crédito aún tiene ${incompletas.length} investigación(es) pendiente(s) de completar en campo (solicitante/avales).`;
        return res.status(422).json({ error: mensajeError });
      }
    }

    await db.query(`
      UPDATE investigaciones
      SET estado = $1,
          estado_validacion = $2,
          validador_id = $3,
          fecha_validacion = NOW(),
          comentarios_validacion = $4,
          updated_at = NOW()
      WHERE CAST(id_sif_research AS TEXT) = CAST($5 AS TEXT);
    `, [nuevoEstado, nuevoEstado, validadorId, comentarios || '', id]);

    // Registrar en Audit Log
    const accionAuditoria = accion === 'VALIDAR' ? 'VALIDAR_INVESTIGACION' : 'RECHAZAR_INVESTIGACION';
    await registrarAuditoria(req, {
      accion: accionAuditoria,
      entidad: 'investigaciones',
      entidad_id: id,
      datos_anteriores: { estado: prev[0].estado },
      datos_nuevos: { estado: nuevoEstado, comentarios_validacion: comentarios },
    });

    // Disparar Notificación por Correo a Analistas si está habilitado el disparador
    if (accion === 'VALIDAR') {
      (async () => {
        try {
          const { rows: trRows } = await db.query("SELECT valor FROM configuracion_sistema WHERE clave = 'email_triggers';");
          const triggers = trRows.length > 0 ? trRows[0].valor : {};
          if (triggers.notificar_analista_al_validar) {
            const { sendCreditoValidadoEmail } = require('../utils/mailer.service');

            // Obtener información del crédito y socio
            const { rows: infoRows } = await db.query(`
              SELECT 
                inv.id_sif_research,
                s.folio as solicitud_folio,
                s.monto_solicitado,
                s.sucursal_nombre,
                p.nombre_completo as cliente_nombre
              FROM investigaciones inv
              LEFT JOIN solicitudes_credito s ON CAST(inv.solicitud_id_sif AS TEXT) = CAST(s.id_sif AS TEXT)
              LEFT JOIN personas p ON CAST(inv.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
              WHERE CAST(inv.id_sif_research AS TEXT) = CAST($1 AS TEXT)
              LIMIT 1;
            `, [id]);

            // Obtener correos de los analistas activos
            const { rows: analistasRows } = await db.query(`
              SELECT email FROM investigadores 
              WHERE (rol ILIKE '%analista%' OR rol ILIKE '%superadmin%') 
                AND activo = TRUE 
                AND email IS NOT NULL 
                AND email != '';
            `);

            const dataCr = infoRows[0] || {};
            const emails = analistasRows.map(r => r.email).filter(Boolean);

            for (const emailTo of emails) {
              await sendCreditoValidadoEmail({
                to: emailTo,
                solicitudFolio: dataCr.solicitud_folio,
                clienteNombre: dataCr.cliente_nombre,
                sucursalNombre: dataCr.sucursal_nombre,
                montoSolicitado: dataCr.monto_solicitado,
                validadorNombre: req.user?.nombre || 'Validador de Crédito',
                comentariosValidador: comentarios || 'Visto bueno otorgado.',
                investigacionId: id,
              });
            }
          }
        } catch (errEmail) {
          console.error('[EMAIL ERROR] Error enviando alerta a analistas tras validación:', errEmail.message);
        }
      })();
    }

    res.json({
      success: true,
      message: `Investigación marcada como ${nuevoEstado} correctamente`,
      estado: nuevoEstado,
    });
  } catch (err) {
    next(err);
  }
}

async function revalidarInvestigacion(req, res, next) {
  try {
    const id = req.params.id;
    // accion: 'APROBAR_FINAL' | 'DEVOLVER_VALIDADOR'
    const { accion, comentarios } = req.body;

    if (!accion || !['APROBAR_FINAL', 'DEVOLVER_VALIDADOR'].includes(accion)) {
      return res.status(400).json({ error: 'Acción de revalidación inválida. Debe ser APROBAR_FINAL o DEVOLVER_VALIDADOR.' });
    }

    // Verificar que la investigación exista y esté VALIDADA (solo se puede revalidar tras el validador)
    const { rows: prev } = await db.query(
      `SELECT estado, estado_validacion FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT)`,
      [id]
    );

    if (prev.length === 0) {
      return res.status(404).json({ error: 'Investigación no encontrada' });
    }

    const estadoActual = prev[0].estado_validacion || prev[0].estado;
    const nuevoEstado = accion === 'APROBAR_FINAL' ? 'APROBADA_FINAL' : 'DEVUELTA_A_VALIDADOR';
    const analistaId = req.user?.id || null;

    // Garantizar columnas de revalidacion
    try {
      await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS analista_id INTEGER;`);
      await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS fecha_revalidacion TIMESTAMP;`);
      await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS comentarios_revalidacion TEXT;`);
    } catch (e) {}

    await db.query(`
      UPDATE investigaciones
      SET estado = $1,
          estado_validacion = $2,
          analista_id = $3,
          fecha_revalidacion = NOW(),
          comentarios_revalidacion = $4,
          updated_at = NOW()
      WHERE CAST(id_sif_research AS TEXT) = CAST($5 AS TEXT);
    `, [nuevoEstado, nuevoEstado, analistaId, comentarios || '', id]);

    // Registrar en Audit Log
    const accionAuditoria = accion === 'APROBAR_FINAL' ? 'APROBAR_INVESTIGACION_FINAL' : 'DEVOLVER_A_VALIDADOR';
    await registrarAuditoria(req, {
      accion: accionAuditoria,
      entidad: 'investigaciones',
      entidad_id: id,
      datos_anteriores: { estado: estadoActual },
      datos_nuevos: { estado: nuevoEstado, comentarios_revalidacion: comentarios },
    });

    res.json({
      success: true,
      message: accion === 'APROBAR_FINAL'
        ? `✅ Investigación aprobada definitivamente (APROBADA_FINAL).`
        : `🔄 Investigación devuelta al Validador para revisión.`,
      estado: nuevoEstado,
    });
  } catch (err) {
    next(err);
  }
}

// Devuelve las colonias únicas con investigaciones activas, con conteo de total y sin asignar
async function getColoniasActivas(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT
        TRIM(d.colonia) AS colonia,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE inv.investigador_id IS NULL OR inv.estado = 'PENDIENTE' OR inv.estado = 'REAGENDADA') AS sin_asignar
      FROM investigaciones inv
      JOIN personas p ON inv.persona_id_sif = p.id_sif
      LEFT JOIN solicitudes_credito s ON inv.solicitud_id_sif = s.id_sif
      LEFT JOIN LATERAL (
        SELECT d.colonia
        FROM direcciones d
        WHERE d.persona_id_sif = p.id_sif
        ORDER BY 
          CASE WHEN s.direccion_id_sif IS NOT NULL AND d.id_sif = s.direccion_id_sif THEN 1 ELSE 0 END DESC,
          COALESCE(d.es_principal, FALSE) DESC,
          COALESCE(d.activa, TRUE) DESC,
          COALESCE(d.updated_at, '1970-01-01'::timestamp) DESC,
          d.id_sif DESC
        LIMIT 1
      ) d ON TRUE
      WHERE d.colonia IS NOT NULL
        AND d.colonia != ''
        AND (inv.estado IS NULL OR inv.estado NOT IN ('VALIDADA', 'APROBADA_FINAL', 'RECHAZADA'))
      GROUP BY TRIM(d.colonia)
      ORDER BY COUNT(*) DESC, TRIM(d.colonia) ASC
      LIMIT 100;
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// Devuelve las sucursales únicas con investigaciones activas, con conteo de total, sin asignar e investigaciones listas para analista
async function getSucursalesActivas(req, res, next) {
  try {
    const { rows } = await db.query(`
      WITH creditos_analista AS (
        SELECT 
          s.sucursal_id,
          inv.solicitud_id_sif,
          MAX(inv.analista_id) AS analista_id,
          BOOL_AND(COALESCE(inv.estado_validacion, '') = 'VALIDADA') AS todo_validado
        FROM investigaciones inv
        JOIN solicitudes_credito s ON inv.solicitud_id_sif = s.id_sif
        WHERE s.sucursal_id IS NOT NULL
        GROUP BY s.sucursal_id, inv.solicitud_id_sif
      ),
      conteo_analista AS (
        SELECT
          sucursal_id,
          COUNT(*) FILTER (WHERE todo_validado = TRUE) AS total_validados,
          COUNT(*) FILTER (WHERE todo_validado = TRUE AND analista_id IS NULL) AS listas_analista
        FROM creditos_analista
        GROUP BY sucursal_id
      ),
      sucursales_base AS (
        SELECT
          s.sucursal_id,
          COALESCE(MAX(s.sucursal_nombre), '') AS sucursal_nombre,
          COUNT(inv.id_sif_research) FILTER (WHERE inv.estado IS NULL OR inv.estado NOT IN ('VALIDADA', 'APROBADA_FINAL', 'RECHAZADA')) AS total,
          COUNT(inv.id_sif_research) FILTER (WHERE (inv.investigador_id IS NULL OR inv.estado = 'PENDIENTE' OR inv.estado = 'REAGENDADA') AND (inv.estado IS NULL OR inv.estado NOT IN ('VALIDADA', 'APROBADA_FINAL', 'RECHAZADA'))) AS sin_asignar
        FROM investigaciones inv
        JOIN solicitudes_credito s ON inv.solicitud_id_sif = s.id_sif
        WHERE s.sucursal_id IS NOT NULL
        GROUP BY s.sucursal_id
      )
      SELECT 
        sb.sucursal_id,
        sb.sucursal_nombre,
        COALESCE(sb.total, 0) AS total,
        COALESCE(sb.sin_asignar, 0) AS sin_asignar,
        COALESCE(ca.listas_analista, 0) AS listas_analista,
        COALESCE(ca.total_validados, 0) AS total_validados
      FROM sucursales_base sb
      LEFT JOIN conteo_analista ca ON sb.sucursal_id = ca.sucursal_id
      ORDER BY sb.sucursal_id ASC;
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// Guardar o actualizar comentarios/observaciones del validador de crédito
async function guardarComentariosValidador(req, res, next) {
  try {
    const id = req.params.id;
    const { comentarios } = req.body;
    const validadorId = req.user?.id || null;

    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS comentarios_validacion TEXT;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS validador_id INTEGER;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS fecha_validacion TIMESTAMP;`);

    const { rows: prev } = await db.query(
      `SELECT estado, comentarios_validacion, validador_id FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT)`,
      [id]
    );

    if (prev.length === 0) {
      return res.status(404).json({ error: 'Investigación no encontrada' });
    }

    await db.query(`
      UPDATE investigaciones
      SET comentarios_validacion = $1,
          validador_id = COALESCE(validador_id, $2),
          updated_at = NOW()
      WHERE CAST(id_sif_research AS TEXT) = CAST($3 AS TEXT);
    `, [comentarios || '', validadorId, id]);

    await registrarAuditoria(req, {
      accion: 'ACTUALIZAR_COMENTARIOS_VALIDADOR',
      entidad: 'investigaciones',
      entidad_id: id,
      datos_anteriores: { comentarios_validacion: prev[0].comentarios_validacion },
      datos_nuevos: { comentarios_validacion: comentarios },
    });

    res.json({
      success: true,
      message: 'Comentarios del validador actualizados correctamente',
      comentarios_validacion: comentarios,
    });
  } catch (err) {
    next(err);
  }
}

async function actualizarTelefonoInvestigacion(req, res, next) {
  try {
    const id = req.params.id;
    const { telefono, telefonoSecundario } = req.body;

    if (!telefono || !String(telefono).trim()) {
      return res.status(400).json({ error: 'El número de teléfono es requerido.' });
    }

    const telLimpio = String(telefono).trim();
    const telSec = telefonoSecundario ? String(telefonoSecundario).trim() : null;

    // 1. Obtener la persona vinculada a la investigación
    const { rows: invRows } = await db.query(
      `SELECT persona_id_sif FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT) OR CAST(id AS TEXT) = CAST($1 AS TEXT) LIMIT 1;`,
      [id]
    );

    if (invRows.length === 0) {
      return res.status(404).json({ error: 'Investigación no encontrada' });
    }

    const personaId = invRows[0].persona_id_sif;

    // 2. Actualizar personas
    if (personaId) {
      await db.query(
        `UPDATE personas
         SET telefono_principal = $1,
             telefono = $1,
             telefono_secundario = COALESCE($2, telefono_secundario),
             estado_contacto_semaforo = 'VERDE',
             fuente_datos_contacto = 'INVESTIGADOR_MOVIL',
             fecha_validacion_contacto = NOW(),
             usuario_validacion_contacto = $3,
             updated_at = NOW()
         WHERE CAST(id_sif AS TEXT) = CAST($4 AS TEXT);`,
        [telLimpio, telSec, req.user?.nombre || 'Investigador Móvil', personaId]
      );
    }

    // 3. Actualizar evidencias_visita si ya existe registro
    try {
      await db.query(
        `UPDATE evidencias_visita
         SET estudio_socioeconomico = jsonb_set(COALESCE(estudio_socioeconomico, '{}'::jsonb), '{telefono_visitado}', to_jsonb($1::text))
         WHERE CAST(investigacion_id_sif AS TEXT) = CAST($2 AS TEXT);`,
        [telLimpio, id]
      );
    } catch (e) {
      console.log('Aviso al actualizar teléfono en evidencia:', e.message);
    }

    res.json({
      success: true,
      message: 'Teléfono actualizado correctamente en la base de datos',
      telefono_principal: telLimpio,
      telefono_secundario: telSec,
    });
  } catch (err) {
    next(err);
  }
}

// Solventar Folio y Editar Formato por el Validador de Crédito
async function solventarFolioInvestigacion(req, res, next) {
  try {
    const id = req.params.id;
    const {
      estudio_socioeconomico,
      dictamen = 'DOMICILIO CONFIRMADO',
      notas_investigador,
      justificacion_folio,
      comprobante_url,
      validar_inmediato = false,
      comentarios_validacion,
    } = req.body;

    const validadorId = req.user?.id || null;
    const validadorNombre = req.user?.nombre || req.user?.email || 'Validador / Asignador';
    const validadorRol = req.user?.rol || 'validador';

    const justificacionLimpia = (justificacion_folio && justificacion_folio.trim())
      ? justificacion_folio.trim()
      : 'Actualización y corrección de datos del formato socioeconómico en gabinete';

    // 1. Verificar existencia de la investigación
    const { rows: invRows } = await db.query(
      `SELECT * FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT)`,
      [id]
    );

    if (invRows.length === 0) {
      return res.status(404).json({ error: 'Investigación no encontrada' });
    }

    const investigacion = invRows[0];

    // Asegurar columnas auxiliares
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS justificacion_folio TEXT;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS comprobante_folio_url TEXT;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS folio_solventado BOOLEAN DEFAULT FALSE;`);
    await db.query(`ALTER TABLE evidencias_visita ADD COLUMN IF NOT EXISTS justificacion_folio TEXT;`);
    await db.query(`ALTER TABLE evidencias_visita ADD COLUMN IF NOT EXISTS comprobante_folio_url TEXT;`);
    await db.query(`ALTER TABLE evidencias_visita ADD COLUMN IF NOT EXISTS solventado_por_usuario_id INT;`);
    await db.query(`ALTER TABLE evidencias_visita ADD COLUMN IF NOT EXISTS solventado_en TIMESTAMP WITH TIME ZONE;`);

    // 2. Obtener evidencia previa para auditoría e inmutabilidad estricta de imágenes de campo
    const { rows: evRows } = await db.query(
      `SELECT * FROM evidencias_visita WHERE CAST(investigacion_id_sif AS TEXT) = CAST($1 AS TEXT) ORDER BY id DESC LIMIT 1`,
      [id]
    );

    const prevEvidencia = evRows[0] || {};
    // CRÍTICO: Las fotografías de campo son INMUTABLES (no se pueden alterar ni borrar)
    const fotosOriginales = prevEvidencia.fotos_urls || [];
    const firmaOriginal = prevEvidencia.firma_url || '';
    const firmaInvOriginal = prevEvidencia.firma_investigador_url || '';

    // Consolidar estudio socioeconómico editado
    const estudioFinal = {
      ...(typeof prevEvidencia.estudio_socioeconomico === 'object' ? prevEvidencia.estudio_socioeconomico : {}),
      ...(typeof estudio_socioeconomico === 'object' ? estudio_socioeconomico : {}),
      dictamen: dictamen,
      supuesto: dictamen === 'DOMICILIO CONFIRMADO' ? 'FOLIO_SOLVENTADO' : (estudio_socioeconomico?.supuesto || 'Con Folio'),
      folio_solventado: true,
      solventado_por: validadorNombre,
      justificacion_folio: justificacionLimpia,
      comprobante_url: comprobante_url || prevEvidencia.comprobante_folio_url || null,
      fecha_solventado: new Date().toISOString(),
    };

    // 3. Actualizar evidencias_visita preservando fotos y firmas de campo intactas
    if (evRows.length > 0) {
      await db.query(`
        UPDATE evidencias_visita
        SET estudio_socioeconomico = $1,
            notas_investigador = COALESCE($2, notas_investigador),
            justificacion_folio = $3,
            comprobante_folio_url = COALESCE($4, comprobante_folio_url),
            solventado_por_usuario_id = $5,
            solventado_en = NOW()
        WHERE id = $6;
      `, [
        JSON.stringify(estudioFinal),
        notas_investigador || prevEvidencia.notas_investigador,
        justificacionLimpia,
        comprobante_url || null,
        validadorId,
        prevEvidencia.id
      ]);
    } else {
      await db.query(`
        INSERT INTO evidencias_visita (
          investigacion_id_sif,
          estudio_socioeconomico,
          fotos_urls,
          notas_investigador,
          justificacion_folio,
          comprobante_folio_url,
          solventado_por_usuario_id,
          solventado_en,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW());
      `, [
        id,
        JSON.stringify(estudioFinal),
        JSON.stringify([]),
        notas_investigador || '',
        justificacionLimpia,
        comprobante_url || null,
        validadorId
      ]);
    }

    // 3.1 Sincronizar teléfono si fue modificado en el formulario
    if (estudio_socioeconomico?.telefono_visitado && String(estudio_socioeconomico.telefono_visitado).trim()) {
      const telVisitadoLimpio = String(estudio_socioeconomico.telefono_visitado).trim();
      await db.query(`
        UPDATE personas
        SET telefono_principal = COALESCE(NULLIF($1, ''), telefono_principal),
            telefono = COALESCE(NULLIF($1, ''), telefono)
        WHERE CAST(id_sif AS TEXT) = (SELECT CAST(persona_id_sif AS TEXT) FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = CAST($2 AS TEXT) LIMIT 1);
      `, [telVisitadoLimpio, id]);
    }

    // 3.2 Sincronizar dirección corregida si aplica
    if (estudio_socioeconomico?.tiene_direccion_diferente && estudio_socioeconomico?.calle_real) {
      const personaId = investigacion.persona_id_sif;
      if (personaId) {
        await db.query(`
          INSERT INTO direcciones (
            persona_id_sif,
            calle,
            colonia,
            referencias,
            es_principal,
            domicilio_validado_sucursal,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, TRUE, TRUE, NOW(), NOW())
          ON CONFLICT DO NOTHING;
        `, [
          personaId,
          estudio_socioeconomico.calle_real,
          estudio_socioeconomico.colonia_real || null,
          estudio_socioeconomico.referencias_domicilio || null,
        ]);
      }
    }

    // 4. Actualizar estado de la investigación respetando estados avanzados
    let nuevoEstado = investigacion.estado;
    if (investigacion.estado === 'REAGENDADA' || investigacion.estado === 'PENDIENTE') {
      nuevoEstado = 'COMPLETADA';
    }
    let nuevoEstadoValidacion = investigacion.estado_validacion;
    let fechaValidacion = investigacion.fecha_validacion;
    let comValidacion = investigacion.comentarios_validacion;

    if (validar_inmediato) {
      nuevoEstado = 'VALIDADA';
      nuevoEstadoValidacion = 'VALIDADA';
      fechaValidacion = new Date();
      comValidacion = comentarios_validacion || `Validado tras solventación/edición de formato: ${justificacionLimpia}`;
    }

    const obsSif = `[DATOS DE FORMATO ACTUALIZADOS]: ${justificacionLimpia}`;

    await db.query(`
      UPDATE investigaciones
      SET estado = $1,
          estado_validacion = $2,
          validador_id = COALESCE($3, validador_id),
          fecha_validacion = COALESCE($4, fecha_validacion),
          fecha_cumplimiento = COALESCE(fecha_cumplimiento, NOW()),
          observaciones_sif = $5,
          justificacion_folio = $6,
          comprobante_folio_url = COALESCE($7, comprobante_folio_url),
          folio_solventado = TRUE,
          comentarios_validacion = COALESCE($8, comentarios_validacion),
          updated_at = NOW()
      WHERE CAST(id_sif_research AS TEXT) = CAST($9 AS TEXT);
    `, [
      nuevoEstado,
      nuevoEstadoValidacion,
      validadorId,
      fechaValidacion,
      obsSif,
      justificacionLimpia,
      comprobante_url || null,
      comValidacion,
      id
    ]);

    // 5. Registrar en Bitácora de Auditoría
    await registrarAuditoria({
      usuario_id: validadorId,
      usuario_nombre: validadorNombre,
      usuario_rol: validadorRol,
      accion: 'SOLVENTAR_FOLIO_VALIDADOR',
      recurso: 'investigaciones',
      recurso_id: id,
      descripcion: `Formato socioeconómico actualizado/solventado por ${validadorNombre}`,
      datos_anteriores: {
        estado: investigacion.estado,
        estudio_socioeconomico: prevEvidencia.estudio_socioeconomico,
        notas_investigador: prevEvidencia.notas_investigador,
      },
      datos_nuevos: {
        estado: nuevoEstado,
        dictamen: dictamen,
        justificacion_folio: justificacionLimpia,
        comprobante_url: comprobante_url || null,
        validado_inmediato: Boolean(validar_inmediato),
      },
    });

    // 6. Notificar por correo a Analistas si se validó de inmediato
    if (validar_inmediato) {
      try {
        const { rows: trRows } = await db.query("SELECT valor FROM configuracion_sistema WHERE clave = 'email_triggers';");
        const triggers = trRows.length > 0 ? trRows[0].valor : {};
        if (triggers.notificar_analista_al_validar) {
          const { sendCreditoValidadoEmail } = require('../utils/mailer.service');
          const { rows: infoRows } = await db.query(`
            SELECT i.id_sif_research, i.solicitud_id_sif, i.solicitud_folio, i.sujeto_nombre, i.tipo_sujeto,
                   i.monto_solicitado, i.sucursal_nombre, u.nombre as validador_nombre
            FROM investigaciones i
            LEFT JOIN usuarios u ON u.id = i.validador_id
            WHERE CAST(i.id_sif_research AS TEXT) = CAST($1 AS TEXT);
          `, [id]);
          if (infoRows.length > 0) {
            sendCreditoValidadoEmail(infoRows[0], comValidacion).catch(err => {
              console.error('Error enviando notificación email tras solventar y validar:', err.message);
            });
          }
        }
      } catch (errEmail) {
        console.error('Error procesando triggers de email:', errEmail.message);
      }
    }

    // 7. Notificar por WebSocket a clientes conectados
    const io = req.app.get('io');
    if (io) {
      io.emit('investigaciones_actualizadas', {
        tipo: 'FOLIO_SOLVENTADO',
        investigacion_id: id,
        nuevo_estado: nuevoEstado,
      });
    }

    res.json({
      success: true,
      message: validar_inmediato
        ? 'Folio solventado y validado exitosamente. Turnado a bandeja de Analista.'
        : 'Formato actualizado y folio solventado. La investigación está lista para validación formal.',
      estado: nuevoEstado,
      estudio_socioeconomico: estudioFinal,
    });
  } catch (err) {
    next(err);
  }
}

// Subir Comprobante de Solventación de Folio (PDF o Imagen)
async function subirComprobanteFolio(req, res, next) {
  try {
    const id = req.params.id;
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const archivoUrl = `/uploads/${req.file.filename}`;

    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS comprobante_folio_url TEXT;`);
    await db.query(`
      UPDATE investigaciones
      SET comprobante_folio_url = $1,
          updated_at = NOW()
      WHERE CAST(id_sif_research AS TEXT) = CAST($2 AS TEXT);
    `, [archivoUrl, id]);

    res.json({
      success: true,
      archivo_url: archivoUrl,
      nombre_archivo: req.file.originalname,
    });
  } catch (err) {
    next(err);
  }
}

async function asignarAnalista(req, res, next) {
  try {
    // REGLA ESTRICTA DE NEGOCIO: Únicamente Norma Lizette Bermejo Palos (o superadmin) puede asignar analistas
    const userName = (req.user?.nombre || '').toLowerCase();
    const userEmail = (req.user?.email || '').toLowerCase();
    const isNormaBermejo =
      userName.includes('norma') ||
      userName.includes('bermejo') ||
      userEmail.includes('norma') ||
      userEmail.includes('bermejo');
    const isSuperadmin = (req.user?.rol || '').toLowerCase() === 'superadmin';

    if (!isNormaBermejo && !isSuperadmin) {
      return res.status(403).json({
        error: 'Acceso denegado: Únicamente Norma Lizette Bermejo Palos tiene facultades para asignar investigaciones a los analistas.'
      });
    }

    const { solicitud_id_sif, investigacion_id, analista_id } = req.body;

    if (!analista_id) {
      return res.status(400).json({ error: 'Debes seleccionar un analista.' });
    }

    if (!solicitud_id_sif && !investigacion_id) {
      return res.status(400).json({ error: 'Se requiere solicitud_id_sif o investigacion_id.' });
    }

    // Resolver solicitud_id_sif si solo se envió investigacion_id
    let targetSolicitudId = solicitud_id_sif;
    if (!targetSolicitudId && investigacion_id) {
      const invRow = await db.query(
        `SELECT solicitud_id_sif FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT) LIMIT 1;`,
        [investigacion_id]
      );
      if (invRow.rows.length > 0) {
        targetSolicitudId = invRow.rows[0].solicitud_id_sif;
      }
    }

    if (!targetSolicitudId) {
      return res.status(400).json({ error: 'No se encontró la solicitud de crédito correspondiente.' });
    }

    // 1. Obtener todas las investigaciones asociadas a este crédito
    const { rows: invsCredito } = await db.query(
      `SELECT inv.id_sif_research, inv.persona_id_sif, inv.tipo_sujeto, inv.estado, inv.estado_validacion, inv.analista_id,
              p.nombre_completo as sujeto_nombre
       FROM investigaciones inv
       LEFT JOIN personas p ON inv.persona_id_sif = p.id_sif
       WHERE inv.solicitud_id_sif = $1;`,
      [targetSolicitudId]
    );

    if (invsCredito.length === 0) {
      return res.status(404).json({ error: 'No se encontraron investigaciones para esta solicitud de crédito.' });
    }

    // 2. REGLA DE NEGOCIO CRÍTICA:
    // Solo se puede asignar analista si el 100% de las investigaciones ya fueron validadas por el Validador
    const noValidadas = invsCredito.filter(
      (inv) => !inv.estado_validacion || inv.estado_validacion.toUpperCase() !== 'VALIDADA'
    );

    if (noValidadas.length > 0) {
      return res.status(400).json({
        error: `No se puede asignar analista: aún hay ${noValidadas.length} de ${invsCredito.length} investigación(es) del crédito sin visto bueno del Validador.`,
        total: invsCredito.length,
        validadas: invsCredito.length - noValidadas.length,
        pendientes: noValidadas.map((i) => ({
          id_sif_research: i.id_sif_research,
          sujeto: i.sujeto_nombre || i.tipo_sujeto,
          tipo_sujeto: i.tipo_sujeto,
          estado: i.estado,
          estado_validacion: i.estado_validacion || 'PENDIENTE',
        })),
      });
    }

    // 3. Obtener el analista para asegurar que existe y está activo
    const analistaRes = await db.query(
      `SELECT id, nombre, email, rol FROM investigadores WHERE id = $1 AND activo = TRUE;`,
      [analista_id]
    );

    if (analistaRes.rows.length === 0) {
      return res.status(404).json({ error: 'El analista seleccionado no existe o está inactivo.' });
    }
    const analista = analistaRes.rows[0];

    // Asegurar columna fecha_asignacion_analista
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS fecha_asignacion_analista TIMESTAMP;`);

    // 4. Asignar el analista a todas las investigaciones de la solicitud
    await db.query(
      `UPDATE investigaciones
       SET analista_id = $1,
           fecha_asignacion_analista = NOW(),
           updated_at = NOW()
       WHERE solicitud_id_sif = $2;`,
      [analista_id, targetSolicitudId]
    );

    // 5. Registrar en bitácora de auditoría
    registrarAuditoria({
      usuario_id: req.user?.id || null,
      usuario_nombre: req.user?.nombre || req.user?.email || 'Sistema',
      usuario_rol: req.user?.rol || 'coordinacion_analistas',
      accion: 'ASIGNAR_ANALISTA_PRESTAMO',
      recurso: 'solicitudes_credito',
      recurso_id: String(targetSolicitudId),
      descripcion: `Asignación del analista ${analista.nombre} (ID: ${analista.id}) a la solicitud de crédito ${targetSolicitudId} (${invsCredito.length} investigaciones validadas).`,
      ip_origen: req.ip || req.headers['x-forwarded-for'],
      user_agent: req.headers['user-agent'],
      datos_anteriores: {
        investigaciones_count: invsCredito.length,
        analistas_previos: invsCredito.map((i) => i.analista_id),
      },
      datos_nuevos: {
        analista_id: analista.id,
        analista_nombre: analista.nombre,
      },
    });

    res.json({
      success: true,
      message: `Analista ${analista.nombre} asignado correctamente a las ${invsCredito.length} investigaciones de este crédito.`,
      analista: {
        id: analista.id,
        nombre: analista.nombre,
      },
      solicitud_id_sif: targetSolicitudId,
    });
  } catch (err) {
    next(err);
  }
}

async function asignarAnalistaLote(req, res, next) {
  try {
    // REGLA ESTRICTA DE NEGOCIO: Únicamente Norma Lizette Bermejo Palos (o superadmin) puede asignar analistas
    const userName = (req.user?.nombre || '').toLowerCase();
    const userEmail = (req.user?.email || '').toLowerCase();
    const isNormaBermejo =
      userName.includes('norma') ||
      userName.includes('bermejo') ||
      userEmail.includes('norma') ||
      userEmail.includes('bermejo');
    const isSuperadmin = (req.user?.rol || '').toLowerCase() === 'superadmin';

    if (!isNormaBermejo && !isSuperadmin) {
      return res.status(403).json({
        error: 'Acceso denegado: Únicamente Norma Lizette Bermejo Palos tiene facultades para asignar investigaciones a los analistas.'
      });
    }

    const { solicitud_ids, investigacion_ids, analista_id } = req.body;

    if (!analista_id) {
      return res.status(400).json({ error: 'Debes seleccionar un analista.' });
    }

    // 1. Obtener el analista para asegurar que existe y está activo
    const analistaRes = await db.query(
      `SELECT id, nombre, email, rol FROM investigadores WHERE id = $1 AND activo = TRUE;`,
      [analista_id]
    );

    if (analistaRes.rows.length === 0) {
      return res.status(404).json({ error: 'El analista seleccionado no existe o está inactivo.' });
    }
    const analista = analistaRes.rows[0];

    // 2. Recolectar solicitudes únicas a partir de solicitud_ids o investigacion_ids
    const targetSolicitudesSet = new Set();
    if (Array.isArray(solicitud_ids)) {
      solicitud_ids.forEach((s) => s && targetSolicitudesSet.add(String(s)));
    }

    if (Array.isArray(investigacion_ids) && investigacion_ids.length > 0) {
      const invNumIds = investigacion_ids.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n));
      const invStrIds = investigacion_ids.map(String);

      const invRows = await db.query(
        `SELECT DISTINCT solicitud_id_sif FROM investigaciones 
         WHERE id_sif_research = ANY($1::int[]) OR CAST(id_sif_research AS TEXT) = ANY($2::text[]);`,
        [invNumIds, invStrIds]
      );
      invRows.rows.forEach((r) => r.solicitud_id_sif && targetSolicitudesSet.add(String(r.solicitud_id_sif)));
    }

    const listaSolicitudes = Array.from(targetSolicitudesSet);
    if (listaSolicitudes.length === 0) {
      return res.status(400).json({
        error: 'No se encontraron solicitudes de crédito válidas para asignar.',
      });
    }

    // Asegurar columna fecha_asignacion_analista
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS fecha_asignacion_analista TIMESTAMP;`);

    // 3. Consultar todas las investigaciones de estas solicitudes
    const { rows: invsRows } = await db.query(
      `SELECT inv.id_sif_research, inv.solicitud_id_sif, inv.solicitud_folio, inv.tipo_sujeto,
              inv.estado, inv.estado_validacion, inv.analista_id,
              p.nombre_completo as sujeto_nombre
       FROM investigaciones inv
       LEFT JOIN personas p ON inv.persona_id_sif = p.id_sif
       WHERE CAST(inv.solicitud_id_sif AS TEXT) = ANY($1::text[]);`,
      [listaSolicitudes]
    );

    const porSolicitud = {};
    for (const inv of invsRows) {
      const sKey = String(inv.solicitud_id_sif);
      if (!porSolicitud[sKey]) porSolicitud[sKey] = [];
      porSolicitud[sKey].push(inv);
    }

    const asignadas = [];
    const omitidas = [];

    for (const solId of listaSolicitudes) {
      const invs = porSolicitud[solId] || [];
      if (invs.length === 0) continue;

      // Regla de negocio: solo se asigna analista si el 100% de las investigaciones están validadas
      const noValidadas = invs.filter(
        (i) => !i.estado_validacion || i.estado_validacion.toUpperCase() !== 'VALIDADA'
      );

      const titular = invs.find((i) => (i.tipo_sujeto || '').toUpperCase() === 'SOLICITANTE');
      const sujetoPrincipal = titular?.sujeto_nombre || invs[0]?.sujeto_nombre || 'Socio';
      const folio = invs[0]?.solicitud_folio || solId;

      if (noValidadas.length > 0) {
        omitidas.push({
          solicitud_id_sif: solId,
          solicitud_folio: folio,
          sujeto: sujetoPrincipal,
          total_investigaciones: invs.length,
          validadas: invs.length - noValidadas.length,
          motivo: `Faltan ${noValidadas.length} de ${invs.length} investigaciones validadas.`,
        });
      } else {
        await db.query(
          `UPDATE investigaciones
           SET analista_id = $1,
               fecha_asignacion_analista = NOW(),
               updated_at = NOW()
           WHERE CAST(solicitud_id_sif AS TEXT) = $2;`,
          [analista_id, solId]
        );

        asignadas.push({
          solicitud_id_sif: solId,
          solicitud_folio: folio,
          sujeto: sujetoPrincipal,
          investigaciones_count: invs.length,
        });

        registrarAuditoria({
          usuario_id: req.user?.id || null,
          usuario_nombre: req.user?.nombre || req.user?.email || 'Sistema',
          usuario_rol: req.user?.rol || 'coordinacion_analistas',
          accion: 'ASIGNAR_ANALISTA_LOTE',
          recurso: 'solicitudes_credito',
          recurso_id: String(solId),
          descripcion: `Asignación en lote de analista ${analista.nombre} (ID: ${analista.id}) a crédito ${solId}.`,
          ip_origen: req.ip || req.headers['x-forwarded-for'],
          user_agent: req.headers['user-agent'],
          datos_anteriores: {
            investigaciones_count: invs.length,
            analistas_previos: invs.map((i) => i.analista_id),
          },
          datos_nuevos: {
            analista_id: analista.id,
            analista_nombre: analista.nombre,
          },
        });
      }
    }

    if (asignadas.length === 0) {
      return res.status(400).json({
        error: `No se pudo asignar ningún crédito: todos los seleccionados tienen investigaciones pendientes de visto bueno.`,
        omitidas,
      });
    }

    let message = `Analista ${analista.nombre} asignado con éxito a ${asignadas.length} crédito(s).`;
    if (omitidas.length > 0) {
      message += ` (Se omitieron ${omitidas.length} créditos que aún no están validados al 100%).`;
    }

    res.json({
      success: true,
      message,
      analista: {
        id: analista.id,
        nombre: analista.nombre,
      },
      total_solicitudes: listaSolicitudes.length,
      asignadas_count: asignadas.length,
      omitidas_count: omitidas.length,
      asignadas,
      omitidas,
    });
  } catch (err) {
    next(err);
  }
}

async function asignarAnalistaPorSucursales(req, res, next) {
  try {
    // REGLA ESTRICTA DE NEGOCIO: Únicamente Norma Lizette Bermejo Palos (o superadmin) puede asignar analistas
    const userName = (req.user?.nombre || '').toLowerCase();
    const userEmail = (req.user?.email || '').toLowerCase();
    const isNormaBermejo =
      userName.includes('norma') ||
      userName.includes('bermejo') ||
      userEmail.includes('norma') ||
      userEmail.includes('bermejo');
    const isSuperadmin = (req.user?.rol || '').toLowerCase() === 'superadmin';

    if (!isNormaBermejo && !isSuperadmin) {
      return res.status(403).json({
        error: 'Acceso denegado: Únicamente Norma Lizette Bermejo Palos tiene facultades para asignar investigaciones a los analistas.'
      });
    }

    const { sucursal_ids, analista_id, reasignar_existentes = false } = req.body;

    if (!analista_id) {
      return res.status(400).json({ error: 'Debes seleccionar un analista.' });
    }

    if (!Array.isArray(sucursal_ids) || sucursal_ids.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos una sucursal.' });
    }

    // 1. Verificar analista activo
    const analistaRes = await db.query(
      `SELECT id, nombre, email, rol FROM investigadores WHERE id = $1 AND activo = TRUE;`,
      [analista_id]
    );

    if (analistaRes.rows.length === 0) {
      return res.status(404).json({ error: 'El analista seleccionado no existe o está inactivo.' });
    }
    const analista = analistaRes.rows[0];

    // Asegurar columna fecha_asignacion_analista
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS fecha_asignacion_analista TIMESTAMP;`);

    // 2. Obtener todas las investigaciones de las sucursales seleccionadas
    const { rows: invsRows } = await db.query(
      `SELECT inv.id_sif_research, inv.solicitud_id_sif, inv.solicitud_folio, inv.tipo_sujeto,
              inv.estado, inv.estado_validacion, inv.analista_id,
              s.sucursal_id, COALESCE(s.sucursal_nombre, '') as sucursal_nombre,
              p.nombre_completo as sujeto_nombre
       FROM investigaciones inv
       JOIN solicitudes_credito s ON inv.solicitud_id_sif = s.id_sif
       LEFT JOIN personas p ON inv.persona_id_sif = p.id_sif
       WHERE CAST(s.sucursal_id AS TEXT) = ANY($1::text[]);`,
      [sucursal_ids.map(String)]
    );

    if (invsRows.length === 0) {
      return res.status(400).json({ error: 'No se encontraron solicitudes de crédito para las sucursales seleccionadas.' });
    }

    // Agrupar por solicitud
    const porSolicitud = {};
    for (const inv of invsRows) {
      const sKey = String(inv.solicitud_id_sif);
      if (!porSolicitud[sKey]) {
        porSolicitud[sKey] = {
          solicitud_id_sif: inv.solicitud_id_sif,
          solicitud_folio: inv.solicitud_folio,
          sucursal_id: inv.sucursal_id,
          sucursal_nombre: inv.sucursal_nombre,
          investigaciones: [],
        };
      }
      porSolicitud[sKey].investigaciones.push(inv);
    }

    const asignadas = [];
    const omitidas = [];
    const porSucursalResumen = {};

    for (const solKey of Object.keys(porSolicitud)) {
      const sol = porSolicitud[solKey];
      const invs = sol.investigaciones;

      // Comprobar si todas las investigaciones de la solicitud están validadas
      const noValidadas = invs.filter(
        (i) => !i.estado_validacion || i.estado_validacion.toUpperCase() !== 'VALIDADA'
      );

      const titular = invs.find((i) => (i.tipo_sujeto || '').toUpperCase() === 'SOLICITANTE');
      const sujetoPrincipal = titular?.sujeto_nombre || invs[0]?.sujeto_nombre || 'Socio';
      const yaTieneAnalista = invs.some((i) => i.analista_id);

      if (noValidadas.length > 0) {
        omitidas.push({
          solicitud_id_sif: sol.solicitud_id_sif,
          solicitud_folio: sol.solicitud_folio,
          sucursal_id: sol.sucursal_id,
          sujeto: sujetoPrincipal,
          motivo: `Faltan ${noValidadas.length} de ${invs.length} investigaciones validadas.`,
        });
      } else if (yaTieneAnalista && !reasignar_existentes) {
        omitidas.push({
          solicitud_id_sif: sol.solicitud_id_sif,
          solicitud_folio: sol.solicitud_folio,
          sucursal_id: sol.sucursal_id,
          sujeto: sujetoPrincipal,
          motivo: 'El crédito ya cuenta con analista asignado (reasignar_existentes = false).',
        });
      } else {
        // Asignar analista al crédito
        await db.query(
          `UPDATE investigaciones
           SET analista_id = $1,
               fecha_asignacion_analista = NOW(),
               updated_at = NOW()
           WHERE CAST(solicitud_id_sif AS TEXT) = $2;`,
          [analista_id, sol.solicitud_id_sif]
        );

        asignadas.push({
          solicitud_id_sif: sol.solicitud_id_sif,
          solicitud_folio: sol.solicitud_folio,
          sucursal_id: sol.sucursal_id,
          sucursal_nombre: sol.sucursal_nombre,
          sujeto: sujetoPrincipal,
          investigaciones_count: invs.length,
        });

        // Contabilizar por sucursal
        const sucKey = String(sol.sucursal_id);
        if (!porSucursalResumen[sucKey]) {
          porSucursalResumen[sucKey] = {
            sucursal_id: sol.sucursal_id,
            sucursal_nombre: sol.sucursal_nombre,
            creditos_asignados: 0,
          };
        }
        porSucursalResumen[sucKey].creditos_asignados++;

        registrarAuditoria({
          usuario_id: req.user?.id || null,
          usuario_nombre: req.user?.nombre || req.user?.email || 'Sistema',
          usuario_rol: req.user?.rol || 'coordinacion_analistas',
          accion: 'ASIGNAR_ANALISTA_SUCURSAL',
          recurso: 'solicitudes_credito',
          recurso_id: String(sol.solicitud_id_sif),
          descripcion: `Asignación de analista ${analista.nombre} (ID: ${analista.id}) por sucursal ${sol.sucursal_nombre || sol.sucursal_id} a crédito ${sol.solicitud_id_sif}.`,
          ip_origen: req.ip || req.headers['x-forwarded-for'],
          user_agent: req.headers['user-agent'],
          datos_anteriores: { analistas_previos: invs.map((i) => i.analista_id) },
          datos_nuevos: { analista_id: analista.id, analista_nombre: analista.nombre },
        });
      }
    }

    if (asignadas.length === 0) {
      return res.status(400).json({
        error: `No se asignó ningún crédito en las sucursales seleccionadas: no hay créditos 100% validados pendientes de analista.`,
        omitidas,
      });
    }

    res.json({
      success: true,
      message: `Se asignaron ${asignadas.length} crédito(s) de ${Object.keys(porSucursalResumen).length} sucursal(es) al analista ${analista.nombre}.`,
      analista: {
        id: analista.id,
        nombre: analista.nombre,
      },
      total_asignados: asignadas.length,
      total_omitidos: omitidas.length,
      resumen_sucursales: Object.values(porSucursalResumen),
      asignadas,
      omitidas,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Soft Delete / Cancelación de Investigación (Exclusivo para Validador)
 * Cambia el estado a 'CANCELADA' para no romper histórico ni llaves foráneas
 */
async function eliminarInvestigacion(req, res, next) {
  try {
    const { id } = req.params;
    const { motivo } = req.body || {};
    const usuarioId = req.user?.id;
    const usuarioNombre = req.user?.nombre || 'Validador';
    const usuarioRol = req.user?.rol || 'validador';

    // 1. Verificar existencia
    const { rows } = await db.query(
      `SELECT id_sif_research, solicitud_id_sif, persona_id_sif, tipo_sujeto, estado, estado_validacion
       FROM investigaciones
       WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT)`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: `La investigación #${id} no existe.` });
    }

    const inv = rows[0];

    // 2. Realizar soft delete
    await db.query(
      `UPDATE investigaciones
       SET estado = 'CANCELADA',
           updated_at = NOW()
       WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT)`,
      [id]
    );

    // 3. Registrar en bitácora de auditoría
    registrarAuditoria({
      usuario_id: usuarioId,
      usuario_nombre: usuarioNombre,
      usuario_rol: usuarioRol,
      accion: 'ELIMINAR_INVESTIGACION',
      recurso: 'investigaciones',
      recurso_id: String(id),
      descripcion: `Investigación #${id} marcada como CANCELADA por ${usuarioNombre}. Motivo: ${motivo || 'Sin motivo especificado'}`,
      ip_origen: req.ip || req.connection?.remoteAddress,
      user_agent: req.headers['user-agent'],
      datos_anteriores: {
        estado: inv.estado,
        estado_validacion: inv.estado_validacion,
        solicitud_id_sif: inv.solicitud_id_sif,
        persona_id_sif: inv.persona_id_sif,
        tipo_sujeto: inv.tipo_sujeto,
      },
      datos_nuevos: {
        estado: 'CANCELADA',
        motivo: motivo || 'Cancelada por validador',
      },
      resultado: 'exito',
    });

    res.json({
      success: true,
      message: `Investigación #${id} eliminada/cancelada exitosamente.`,
      id_sif_research: id,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInvestigaciones,
  getInvestigacionDetalle,
  getColoniasActivas,
  getSucursalesActivas,
  asignarInvestigador,
  asignarInvestigadorLote,
  asignarAnalista,
  asignarAnalistaLote,
  asignarAnalistaPorSucursales,
  guardarEvidencia,
  validarInvestigacion,
  revalidarInvestigacion,
  guardarComentariosValidador,
  actualizarTelefonoInvestigacion,
  solventarFolioInvestigacion,
  subirComprobanteFolio,
  eliminarInvestigacion,
};

