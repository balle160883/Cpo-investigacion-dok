const db = require('../../db');

/**
 * Registrar un evento en la bitácora de auditoría
 * Esta función es Fire-and-Forget: nunca bloquea la respuesta al cliente
 * @param {Object} entry
 */
async function registrarAuditoria({
  usuario_id = null,
  usuario_nombre = 'Sistema',
  usuario_rol = 'sistema',
  accion,
  recurso = null,
  recurso_id = null,
  descripcion = null,
  ip_origen = null,
  user_agent = null,
  datos_anteriores = null,
  datos_nuevos = null,
  resultado = 'exito',
}) {
  try {
    await db.query(
      `INSERT INTO audit_log
        (usuario_id, usuario_nombre, usuario_rol, accion, recurso, recurso_id,
         descripcion, ip_origen, user_agent, datos_anteriores, datos_nuevos, resultado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        usuario_id, usuario_nombre, usuario_rol, accion, recurso, recurso_id,
        descripcion, ip_origen, user_agent,
        datos_anteriores ? JSON.stringify(datos_anteriores) : null,
        datos_nuevos ? JSON.stringify(datos_nuevos) : null,
        resultado,
      ]
    );
  } catch (err) {
    // El audit log nunca debe interrumpir la operación principal
    console.error('[AUDIT] Error registrando evento:', err.message);
  }
}

/**
 * @swagger
 * /api/audit:
 *   get:
 *     summary: Consultar bitácora de auditoría (solo Auditor / Superadmin)
 *     tags: [Auditoría]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *         description: Página de resultados (default 1)
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *         description: Registros por página (default 50, max 200)
 *       - in: query
 *         name: accion
 *         schema: { type: string }
 *         description: Filtrar por tipo de acción
 *       - in: query
 *         name: usuario_id
 *         schema: { type: integer }
 *         description: Filtrar por usuario
 *     responses:
 *       200:
 *         description: Lista paginada de eventos de auditoría
 *       403:
 *         description: Sin permiso (solo Auditor/Superadmin)
 */
async function getAuditLog(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const filters = [];
    const params = [];

    if (req.query.accion) {
      params.push(req.query.accion);
      filters.push(`accion = $${params.length}`);
    }
    if (req.query.usuario_id) {
      params.push(parseInt(req.query.usuario_id));
      filters.push(`usuario_id = $${params.length}`);
    }
    if (req.query.recurso) {
      params.push(req.query.recurso);
      filters.push(`recurso = $${params.length}`);
    }
    if (req.query.resultado) {
      params.push(req.query.resultado);
      filters.push(`resultado = $${params.length}`);
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    params.push(limit);
    params.push(offset);

    const { rows } = await db.query(
      `SELECT id, timestamp, usuario_id, usuario_nombre, usuario_rol,
              accion, recurso, recurso_id, descripcion, ip_origen,
              resultado, datos_anteriores, datos_nuevos
       FROM audit_log
       ${where}
       ORDER BY timestamp DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) as total FROM audit_log ${where}`,
      params.slice(0, -2)
    );

    res.json({
      page,
      limit,
      total: parseInt(countRows[0].total),
      pages: Math.ceil(parseInt(countRows[0].total) / limit),
      data: rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @swagger
 * /api/audit/acciones:
 *   get:
 *     summary: Listado de tipos de acciones registradas
 *     tags: [Auditoría]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tipos únicos de acciones en la bitácora
 */
async function getAcciones(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT accion, COUNT(*) as total
       FROM audit_log GROUP BY accion ORDER BY total DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { registrarAuditoria, getAuditLog, getAcciones };
