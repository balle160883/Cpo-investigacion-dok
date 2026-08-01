const jwt = require('jsonwebtoken');
const db = require('../../db');
const { JWT_SECRET } = require('../middlewares/auth.middleware');

async function getInvestigadores(req, res, next) {
  try {
    const { rows } = await db.query(
      'SELECT id, nombre, email, telefono, rol, activo, created_at FROM investigadores ORDER BY nombre ASC;'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function guardarUbicacion(req, res, next) {
  try {
    const { latitud, longitud, bateria_nivel, investigador_id: bodyInvId } = req.body;
    let investigador_id = bodyInvId;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.id) investigador_id = decoded.id;
      } catch (e) {}
    }

    if (!investigador_id) {
      return res.status(400).json({ error: 'investigador_id requerido' });
    }

    if (!latitud || !longitud) {
      return res.status(400).json({ error: 'Latitud y longitud requeridas' });
    }

    await db.query(
      `INSERT INTO ubicaciones_investigadores (investigador_id, latitud, longitud, bateria_nivel, updated_at)
       VALUES ($1, $2, $3, $4, NOW());`,
      [investigador_id, latitud, longitud, bateria_nivel || 100]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function getUbicaciones(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const role = (decoded?.rol || '').toLowerCase();
        const allowed = ['superadmin', 'asignador', 'validador', 'analista', 'admin'];
        if (role && !allowed.includes(role)) {
          return res.status(403).json({ error: 'Acceso denegado. Permiso solo para administradores' });
        }
      } catch (e) {}
    }

    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS ubicaciones_investigadores (
          id SERIAL PRIMARY KEY,
          investigador_id INT,
          latitud DOUBLE PRECISION,
          longitud DOUBLE PRECISION,
          bateria_nivel INT DEFAULT 100,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
    } catch (e) {}

    const { rows } = await db.query(`
      SELECT 
        i.id as investigador_id,
        i.nombre,
        i.email,
        i.telefono,
        COALESCE(u.latitud, ev.latitud_checkin) as latitud,
        COALESCE(u.longitud, ev.longitud_checkin) as longitud,
        COALESCE(u.bateria_nivel, 100) as bateria_nivel,
        COALESCE(u.updated_at, ev.created_at) as updated_at,
        CASE 
          WHEN u.updated_at IS NOT NULL AND u.updated_at >= NOW() - INTERVAL '12 hours' THEN true 
          WHEN ev.created_at IS NOT NULL AND ev.created_at >= NOW() - INTERVAL '12 hours' THEN true
          ELSE false 
        END as en_linea
      FROM investigadores i
      LEFT JOIN (
        SELECT DISTINCT ON (investigador_id) investigador_id, latitud, longitud, bateria_nivel, updated_at
        FROM ubicaciones_investigadores
        ORDER BY investigador_id, updated_at DESC
      ) u ON CAST(i.id AS TEXT) = CAST(u.investigador_id AS TEXT)
      LEFT JOIN (
        SELECT DISTINCT ON (inv.investigador_id) inv.investigador_id, ev.latitud_checkin, ev.longitud_checkin, ev.created_at
        FROM evidencias_visita ev
        JOIN investigaciones inv ON CAST(ev.investigacion_id_sif AS TEXT) = CAST(inv.id_sif_research AS TEXT)
        WHERE ev.latitud_checkin != 0 AND ev.longitud_checkin != 0
        ORDER BY inv.investigador_id, ev.created_at DESC
      ) ev ON CAST(i.id AS TEXT) = CAST(ev.investigador_id AS TEXT)
      WHERE COALESCE(i.activo, TRUE) = TRUE
      ORDER BY en_linea DESC, i.nombre ASC;
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInvestigadores,
  guardarUbicacion,
  getUbicaciones,
};
