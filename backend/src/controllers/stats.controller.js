const db = require('../../db');

async function getStats(req, res, next) {
  try {
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

    res.json({
      total: parseInt(stats.total || 0),
      completadas: parseInt(stats.completadas || 0),
      en_proceso: parseInt(stats.en_proceso || 0),
      pendientes: parseInt(stats.pendientes || 0),
      investigadores_activos: parseInt(stats.investigadores_activos || 0),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStats,
};
