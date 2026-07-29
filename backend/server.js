const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');
const initDb = require('./init_db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'cpo-investigaciones-secret-2026';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize DB schema on startup
initDb();

// ----------------------------------------------------
// AUTHENTICATION
// ----------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const searchTerm = email.toString().toLowerCase().trim();

    // Query matching email OR nombre for flexible login (e.g. jbb16)
    const { rows } = await db.query(
      `SELECT * FROM investigadores 
       WHERE (LOWER(email) = $1 OR LOWER(nombre) = $1) AND activo = TRUE;`,
      [searchTerm]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    const user = rows[0];
    if (user.password !== password) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        telefono: user.telefono,
        rol: user.rol,
      },
    });
  } catch (err) {
    console.error('Error detallado en /api/auth/login:', err);
    res.status(500).json({ error: `Error de base de datos: ${err.message}` });
  }
});

// Middleware de Autenticación JWT
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

app.get('/api/auth/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// ----------------------------------------------------
// DASHBOARD STATS
// ----------------------------------------------------
app.get('/api/stats', async (req, res) => {
  try {
    const totalRes = await db.query('SELECT count(*) FROM investigaciones;');
    const compRes = await db.query("SELECT count(*) FROM investigaciones WHERE estado = 'COMPLETADA';");
    const procRes = await db.query("SELECT count(*) FROM investigaciones WHERE estado = 'EN_PROCESO';");
    const pendRes = await db.query("SELECT count(*) FROM investigaciones WHERE estado IS NULL OR estado = 'PENDIENTE';");
    const investRes = await db.query('SELECT count(*) FROM investigadores WHERE activo = TRUE;');

    res.json({
      total: parseInt(totalRes.rows[0].count),
      completadas: parseInt(compRes.rows[0].count),
      en_proceso: parseInt(procRes.rows[0].count),
      pendientes: parseInt(pendRes.rows[0].count),
      investigadores_activos: parseInt(investRes.rows[0].count),
    });
  } catch (err) {
    console.error('Error en /api/stats:', err);
    res.status(500).json({ error: 'Error obteniendo estadísticas: ' + err.message });
  }
});

// ----------------------------------------------------
// INVESTIGADORES
// ----------------------------------------------------
app.get('/api/investigadores', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, nombre, email, telefono, rol, activo, created_at FROM investigadores ORDER BY nombre ASC;'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error obteniendo investigadores:', err);
    res.status(500).json({ error: 'Error del servidor: ' + err.message });
  }
});

app.post('/api/investigadores/ubicacion', authenticate, async (req, res) => {
  try {
    const { latitud, longitud, bateria_nivel } = req.body;
    const investigador_id = req.user.id;
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
    console.error('Error guardando ubicación:', err);
    res.status(500).json({ error: 'Error guardando ubicación: ' + err.message });
  }
});

app.get('/api/investigadores/ubicaciones', async (req, res) => {
  try {
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
        COALESCE(u.latitud, ev.latitud_checkin, 20.6597) as latitud,
        COALESCE(u.longitud, ev.longitud_checkin, -103.3496) as longitud,
        COALESCE(u.bateria_nivel, 100) as bateria_nivel,
        COALESCE(u.updated_at, ev.created_at, NOW()) as updated_at,
        CASE WHEN u.updated_at IS NOT NULL OR ev.created_at IS NOT NULL THEN true ELSE false END as tiene_gps
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
      ORDER BY i.id;
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error obteniendo ubicaciones:', err);
    res.status(500).json({ error: 'Error del servidor: ' + err.message });
  }
});

// ----------------------------------------------------
// INVESTIGACIONES LIST & FILTER
// ----------------------------------------------------
app.get('/api/investigaciones', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '50');
    const offset = (page - 1) * limit;
    const { estado, buscar, investigador_id } = req.query;

    let whereClauses = [];
    let queryParams = [];

    if (estado) {
      if (estado === 'PENDIENTE') {
        whereClauses.push(`(inv.estado IS NULL OR inv.estado = 'PENDIENTE')`);
      } else {
        queryParams.push(estado);
        whereClauses.push(`inv.estado = $${queryParams.length}`);
      }
    }

    if (investigador_id) {
      queryParams.push(investigador_id);
      whereClauses.push(`inv.investigador_id = $${queryParams.length}`);
    }

    if (buscar) {
      queryParams.push(`%${buscar}%`);
      whereClauses.push(`(
        p.nombre_completo ILIKE $${queryParams.length} OR 
        s.folio ILIKE $${queryParams.length} OR 
        CAST(inv.id_sif_research AS TEXT) ILIKE $${queryParams.length}
      )`);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const countQuery = `
      SELECT count(*)
      FROM investigaciones inv
      LEFT JOIN personas p ON CAST(inv.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
      LEFT JOIN solicitudes_credito s ON CAST(inv.solicitud_id_sif AS TEXT) = CAST(s.id_sif AS TEXT)
      ${whereSql};
    `;

    const countParams = [...queryParams];

    queryParams.push(limit);
    const limitIndex = queryParams.length;
    queryParams.push(offset);
    const offsetIndex = queryParams.length;

    const dataQuery = `
      SELECT 
        inv.id_sif_research,
        inv.solicitud_id_sif,
        inv.persona_id_sif,
        inv.tipo_sujeto,
        inv.investigador_id,
        inv.fecha_asignacion,
        inv.fecha_cumplimiento,
        COALESCE(inv.estado, 'PENDIENTE') as estado,
        inv.observaciones_sif,
        p.nombre_completo as sujeto_nombre,
        p.es_aval,
        s.folio as solicitud_folio,
        s.monto_solicitado,
        s.sucursal_id,
        d.calle,
        d.numero_exterior,
        d.codigo_postal,
        d.colonia,
        d.municipio,
        d.estado_provincia,
        inv_usr.nombre as investigador_nombre
      FROM investigaciones inv
      LEFT JOIN personas p ON CAST(inv.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
      LEFT JOIN solicitudes_credito s ON CAST(inv.solicitud_id_sif AS TEXT) = CAST(s.id_sif AS TEXT)
      LEFT JOIN direcciones d ON CAST(p.id_sif AS TEXT) = CAST(d.persona_id_sif AS TEXT)
      LEFT JOIN investigadores inv_usr ON inv.investigador_id = inv_usr.id
      ${whereSql}
      ORDER BY inv.id_sif_research DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;

    const totalRes = await db.query(countQuery, countParams);
    const { rows } = await db.query(dataQuery, queryParams);

    res.json({
      total: parseInt(totalRes.rows[0].count),
      page,
      limit,
      data: rows,
    });
  } catch (err) {
    console.error('Error en GET /api/investigaciones:', err);
    res.status(500).json({ error: 'Error del servidor: ' + err.message });
  }
});

// ----------------------------------------------------
// DETALLE DE INVESTIGACIÓN (Para Visualización e Impresión)
// ----------------------------------------------------
app.get('/api/investigaciones/:id', async (req, res) => {
  try {
    const id = req.params.id;

    // 1. Investigacion principal
    const invRes = await db.query(`
      SELECT 
        inv.id_sif_research,
        inv.solicitud_id_sif,
        inv.persona_id_sif,
        inv.tipo_sujeto,
        inv.investigador_id,
        inv.fecha_asignacion,
        inv.fecha_cumplimiento,
        COALESCE(inv.estado, 'PENDIENTE') as estado,
        inv.observaciones_sif,
        p.nombre_completo as sujeto_nombre,
        p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido,
        p.genero, p.es_aval,
        s.folio as solicitud_folio,
        s.monto_solicitado,
        s.monto_aprobado,
        s.sucursal_id,
        s.cliente_id_sif,
        d.calle, d.numero_exterior, d.numero_interior, d.codigo_postal, d.colonia, d.municipio, d.estado_provincia, d.referencias, d.latitud, d.longitud,
        inv_usr.nombre as investigador_nombre,
        inv_usr.telefono as investigador_telefono
      FROM investigaciones inv
      LEFT JOIN personas p ON CAST(inv.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
      LEFT JOIN solicitudes_credito s ON CAST(inv.solicitud_id_sif AS TEXT) = CAST(s.id_sif AS TEXT)
      LEFT JOIN direcciones d ON CAST(p.id_sif AS TEXT) = CAST(d.persona_id_sif AS TEXT)
      LEFT JOIN investigadores inv_usr ON inv.investigador_id = inv_usr.id
      WHERE CAST(inv.id_sif_research AS TEXT) = CAST($1 AS TEXT)
      LIMIT 1;
    `, [id]);

    if (invRes.rows.length === 0) {
      return res.status(404).json({ error: 'Investigación no encontrada' });
    }

    const investigacion = invRes.rows[0];

    // 2. Buscar si hay avales vinculados a esta solicitud
    let avales = [];
    if (investigacion.solicitud_id_sif) {
      const avalesRes = await db.query(`
        SELECT sa.aval_id_sif, p.nombre_completo, d.calle, d.numero_exterior, d.codigo_postal
        FROM solicitud_avales sa
        JOIN personas p ON CAST(sa.aval_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
        LEFT JOIN direcciones d ON CAST(p.id_sif AS TEXT) = CAST(d.persona_id_sif AS TEXT)
        WHERE CAST(sa.solicitud_id_sif AS TEXT) = CAST($1 AS TEXT);
      `, [investigacion.solicitud_id_sif]);
      avales = avalesRes.rows;
    }

    // 3. Evidencia y captura socioeconómica realizada
    const evRes = await db.query(
      'SELECT * FROM evidencias_visita WHERE CAST(investigacion_id_sif AS TEXT) = CAST($1 AS TEXT) ORDER BY created_at DESC LIMIT 1;',
      [id]
    );

    const evidencia = evRes.rows.length > 0 ? evRes.rows[0] : null;

    res.json({
      investigacion,
      avales,
      evidencia,
    });
  } catch (err) {
    console.error('Error en GET /api/investigaciones/:id:', err);
    res.status(500).json({ error: 'Error del servidor: ' + err.message });
  }
});

// ----------------------------------------------------
// ASIGNAR INVESTIGADOR
// ----------------------------------------------------
app.post('/api/investigaciones/:id/asignar', async (req, res) => {
  try {
    const id = req.params.id;
    const { investigador_id } = req.body;

    if (!investigador_id) {
      return res.status(400).json({ error: 'ID de investigador requerido' });
    }

    await db.query(`
      UPDATE investigaciones 
      SET investigador_id = $1, fecha_asignacion = NOW(), estado = 'EN_PROCESO', updated_at = NOW()
      WHERE id_sif_research = $2;
    `, [investigador_id, id]);

    res.json({ success: true, message: 'Investigador asignado correctamente' });
  } catch (err) {
    console.error('Error asignando investigador:', err);
    res.status(500).json({ error: 'Error del servidor: ' + err.message });
  }
});

// ----------------------------------------------------
// CAPTURA DE EVIDENCIA Y ESTUDIO SOCIOECONÓMICO (App Móvil)
// ----------------------------------------------------
app.post('/api/investigaciones/:id/evidencia', async (req, res) => {
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
      dictamen
    } = req.body;

    // Asegurar columna firma_investigador_url en evidencias_visita
    await db.query(`ALTER TABLE evidencias_visita ADD COLUMN IF NOT EXISTS firma_investigador_url TEXT;`);

    // 1. Insertar evidencia en evidencias_visita
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
      latitud_checkin || 0,
      longitud_checkin || 0,
      JSON.stringify(estudio_socioeconomico || {}),
      JSON.stringify(fotos_urls || []),
      firma_url || null,
      firma_investigador_url || null,
      notas_investigador || (dictamen ? `Dictamen: ${dictamen}` : '')
    ]);

    // 2. Actualizar estado de la investigación a COMPLETADA
    await db.query(`
      UPDATE investigaciones
      SET estado = 'COMPLETADA', fecha_cumplimiento = NOW(), observaciones_sif = $1, updated_at = NOW()
      WHERE id_sif_research = $2;
    `, [notas_investigador || (dictamen ? `Dictamen: ${dictamen}` : 'Completada desde App Móvil'), id]);

    res.json({ success: true, message: 'Estudio e investigación guardados correctamente' });
  } catch (err) {
    console.error('Error guardando evidencia:', err);
    res.status(500).json({ error: 'Error del servidor: ' + err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Backend corriendo en puerto ${PORT}`);
});
