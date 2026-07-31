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

async function getProductividadInvestigadores(req, res, next) {
  try {
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

    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStats,
  getProductividadInvestigadores,
};
