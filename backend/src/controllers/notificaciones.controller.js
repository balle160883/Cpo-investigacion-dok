const db = require('../../db');
const { registrarAuditoria } = require('./audit.controller');

// Obtener todas las notificaciones e historial interáreas de una solicitud
async function getNotificacionesBySolicitud(req, res, next) {
  try {
    const { solicitudId } = req.params;

    const { rows } = await db.query(
      `SELECT *,
        (fecha_envio + (plazo_limite_horas || ' hours')::INTERVAL) AS fecha_vencimiento,
        (NOW() > (fecha_envio + (plazo_limite_horas || ' hours')::INTERVAL) AND atendido = FALSE) AS vencido
       FROM notificaciones_interareas
       WHERE solicitud_id_sif = $1
       ORDER BY fecha_envio DESC`,
      [solicitudId]
    );

    const pendientesAtencion = rows.filter(n => n.tipo_notificacion === 'DEVOLUCION_DOCUMENTAL' && !n.atendido);
    const totalVencidos = rows.filter(n => n.vencido).length;

    res.json({
      solicitud_id_sif: solicitudId,
      total_notificaciones: rows.length,
      pendientes_atencion: pendientesAtencion.length,
      total_vencidos: totalVencidos,
      requiere_atencion_urgente: totalVencidos > 0,
      notificaciones: rows,
    });
  } catch (err) {
    next(err);
  }
}

// Enviar Notificación / Devolución Interáreas (Analista -> Sucursal / Operativa)
async function enviarNotificacion(req, res, next) {
  try {
    const { solicitudId, remitenteArea = 'ANALISIS', destinatarioArea = 'SUCURSAL', tipoNotificacion = 'DEVOLUCION_DOCUMENTAL', asunto, mensaje, documentoCodigo, plazoLimiteHoras = 24 } = req.body;

    if (!solicitudId || !asunto || !mensaje) {
      return res.status(400).json({ error: 'solicitudId, asunto y mensaje son requeridos' });
    }

    const { rows } = await db.query(
      `INSERT INTO notificaciones_interareas 
       (solicitud_id_sif, remitente_id, remitente_nombre, remitente_area, destinatario_area, tipo_notificacion, asunto, mensaje, documento_codigo, plazo_limite_horas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        solicitudId,
        req.user?.id || null,
        req.user?.nombre || 'Analista de Crédito',
        remitenteArea,
        destinatarioArea,
        tipoNotificacion,
        asunto,
        mensaje,
        documentoCodigo || null,
        plazoLimiteHoras,
      ]
    );

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'Analista',
      usuarioRol: req.user?.rol || 'analista',
      accion: 'ENVIAR_NOTIFICACION_INTERAREAS',
      recurso: 'notificaciones_interareas',
      recursoId: String(rows[0].id),
      descripcion: `Notificación [${tipoNotificacion}] enviada a ${destinatarioArea} para la solicitud ${solicitudId}`,
      datosNuevos: rows[0],
    });

    res.json({ mensaje: 'Notificación enviada correctamente', data: rows[0] });
  } catch (err) {
    next(err);
  }
}

// Registrar Acuse de Lectura Digital (Visto / Confirmación de Recepción)
async function registrarAcuseLectura(req, res, next) {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `UPDATE notificaciones_interareas
       SET leido = TRUE, fecha_lectura = NOW(), usuario_lectura = $1
       WHERE id = $2 RETURNING *`,
      [req.user?.nombre || 'Usuario Área Receptora', id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'Usuario',
      usuarioRol: req.user?.rol || 'operador',
      accion: 'ACUSE_LECTURA_NOTIFICACION',
      recurso: 'notificaciones_interareas',
      recursoId: String(id),
      descripcion: `Acuse de lectura confirmado por ${req.user?.nombre || 'Usuario'} en notificación #${id}`,
      datosNuevos: rows[0],
    });

    res.json({ mensaje: 'Acuse de lectura registrado', data: rows[0] });
  } catch (err) {
    next(err);
  }
}

// Marcar "Requerimiento Atendido" (Folio 009: Sucursal responde al Analista)
async function marcarRequerimientoAtendido(req, res, next) {
  try {
    const { id } = req.params;
    const { respuestaAtencion } = req.body;

    if (!respuestaAtencion || !respuestaAtencion.trim()) {
      return res.status(400).json({ error: 'La respuesta de atención es obligatoria' });
    }

    // 1. Actualizar notificación original a Atendida
    const { rows } = await db.query(
      `UPDATE notificaciones_interareas
       SET atendido = TRUE, fecha_atencion = NOW(), usuario_atencion = $1, respuesta_atencion = $2
       WHERE id = $3 RETURNING *`,
      [req.user?.nombre || 'Sucursal Operativa', respuestaAtencion, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    const notifOriginal = rows[0];

    // 2. Generar notificación automática de respuesta dirigida al Analista
    const { rows: respuestaNotif } = await db.query(
      `INSERT INTO notificaciones_interareas 
       (solicitud_id_sif, remitente_id, remitente_nombre, remitente_area, destinatario_area, tipo_notificacion, asunto, mensaje, documento_codigo)
       VALUES ($1, $2, $3, 'SUCURSAL', 'ANALISIS', 'REQUERIMIENTO_ATENDIDO', $4, $5, $6)
       RETURNING *`,
      [
        notifOriginal.solicitud_id_sif,
        req.user?.id || null,
        req.user?.nombre || 'Sucursal Operativa',
        `Requerimiento Atendido: ${notifOriginal.asunto}`,
        `La sucursal ha atendido las observaciones. Respuesta: ${respuestaAtencion}`,
        notifOriginal.documento_codigo,
      ]
    );

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'Sucursal',
      usuarioRol: req.user?.rol || 'operador',
      accion: 'MARCAR_REQUERIMIENTO_ATENDIDO',
      recurso: 'notificaciones_interareas',
      recursoId: String(id),
      descripcion: `Requerimiento #${id} marcado como ATENDIDO por Sucursal. Respuesta: ${respuestaAtencion}`,
      datosNuevos: { original: rows[0], notificacionGenerada: respuestaNotif[0] },
    });

    res.json({
      mensaje: 'Requerimiento marcado como atendido y notificación enviada al analista',
      notificacion_actualizada: rows[0],
      notificacion_analista: respuestaNotif[0],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNotificacionesBySolicitud,
  enviarNotificacion,
  registrarAcuseLectura,
  marcarRequerimientoAtendido,
};
