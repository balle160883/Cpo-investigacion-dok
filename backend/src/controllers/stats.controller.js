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

module.exports = {
  getStats,
  getProductividadInvestigadores,
};

