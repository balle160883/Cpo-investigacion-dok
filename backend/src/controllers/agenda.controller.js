const db = require('../../db');
const { registrarAuditoria } = require('./audit.controller');

// Obtener listado de agenda dinámica con filtros y cálculo de vencimientos (Folio 005)
async function getAgenda(req, res, next) {
  try {
    const { tipoGestion, estadoAgenda, investigadorId, zona, categoriaProducto, buscar } = req.query;

    // Actualizar automáticamente visitas vencidas (programadas en el pasado sin atenerse)
    await db.query(
      `UPDATE agenda_visitas
       SET estado_agenda = 'VENCIDA'
       WHERE estado_agenda = 'PROGRAMADA' AND fecha_programada < NOW() - INTERVAL '2 hours'`
    );

    let whereClauses = [];
    let queryParams = [];

    if (tipoGestion) {
      queryParams.push(tipoGestion);
      whereClauses.push(`a.tipo_gestion = $${queryParams.length}`);
    }

    if (estadoAgenda) {
      queryParams.push(estadoAgenda);
      whereClauses.push(`a.estado_agenda = $${queryParams.length}`);
    }

    if (investigadorId) {
      queryParams.push(investigadorId);
      whereClauses.push(`CAST(a.investigador_id AS TEXT) = CAST($${queryParams.length} AS TEXT)`);
    }

    if (zona) {
      queryParams.push(zona);
      whereClauses.push(`a.zona_geografica = $${queryParams.length}`);
    }

    if (categoriaProducto) {
      queryParams.push(categoriaProducto);
      whereClauses.push(`a.categoria_producto = $${queryParams.length}`);
    }

    if (buscar) {
      queryParams.push(`%${buscar}%`);
      whereClauses.push(`(
        p.nombre_completo ILIKE $${queryParams.length} OR 
        s.folio ILIKE $${queryParams.length} OR 
        CAST(a.investigacion_id_sif AS TEXT) ILIKE $${queryParams.length}
      )`);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const query = `
      SELECT 
        a.*,
        p.nombre_completo as sujeto_nombre,
        s.folio as solicitud_folio,
        s.monto_solicitado,
        inv_usr.nombre as investigador_nombre,
        d.calle, d.numero_exterior, d.colonia, d.municipio
      FROM agenda_visitas a
      LEFT JOIN investigaciones inv ON CAST(a.investigacion_id_sif AS TEXT) = CAST(inv.id_sif_research AS TEXT)
      LEFT JOIN personas p ON CAST(inv.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
      LEFT JOIN solicitudes_credito s ON CAST(inv.solicitud_id_sif AS TEXT) = CAST(s.id_sif AS TEXT)
      LEFT JOIN direcciones d ON CAST(p.id_sif AS TEXT) = CAST(d.persona_id_sif AS TEXT)
      LEFT JOIN investigadores inv_usr ON a.investigador_id = inv_usr.id
      ${whereSql}
      ORDER BY a.prioridad DESC, a.fecha_programada ASC;
    `;

    const { rows } = await db.query(query, queryParams);

    // Métricas de agenda
    const totalProgramadas = rows.filter(r => r.estado_agenda === 'PROGRAMADA').length;
    const totalReagendadas = rows.filter(r => r.estado_agenda === 'REAGENDADA').length;
    const totalVencidas = rows.filter(r => r.estado_agenda === 'VENCIDA').length;
    const totalCompletadas = rows.filter(r => r.estado_agenda === 'COMPLETADA').length;

    // Calcular promedio de duración de entrevistas completadas
    const completadasConDuracion = rows.filter(r => r.duracion_minutos > 0);
    const promedioDuracion = completadasConDuracion.length > 0
      ? Math.round(completadasConDuracion.reduce((acc, curr) => acc + curr.duracion_minutos, 0) / completadasConDuracion.length)
      : 0;

    res.json({
      total: rows.length,
      metricas: {
        programadas: totalProgramadas,
        reagendadas: totalReagendadas,
        vencidas: totalVencidas,
        completadas: totalCompletadas,
        promedio_duracion_minutos: promedioDuracion,
      },
      data: rows,
    });
  } catch (err) {
    next(err);
  }
}

// Programar o Reagendar Visita Domiciliaria con motivo auditado (Folios 001 y 005)
async function programarOReagendarVisita(req, res, next) {
  try {
    const { investigacionId, fechaProgramada, motivoReagenda, investigadorId, tipoGestion = 'INVESTIGACION', categoriaProducto = 'CONSUMO', zonaGeografica = 'ZONA_CENTRO', prioridad = 1 } = req.body;

    if (!investigacionId || !fechaProgramada) {
      return res.status(400).json({ error: 'investigacionId y fechaProgramada son requeridos' });
    }

    // Verificar si ya existe agenda para esta investigación
    const { rows: existing } = await db.query(
      `SELECT * FROM agenda_visitas WHERE investigacion_id_sif = $1 AND estado_agenda != 'COMPLETADA'`,
      [investigacionId]
    );

    let resultItem;
    if (existing.length > 0) {
      // Reagenda
      if (!motivoReagenda || !motivoReagenda.trim()) {
        return res.status(400).json({ error: 'El motivo de reagenda es obligatorio' });
      }

      const { rows } = await db.query(
        `UPDATE agenda_visitas
         SET fecha_programada = $1, estado_agenda = 'REAGENDADA', motivo_reagenda = $2, usuario_reagenda = $3, investigador_id = COALESCE($4, investigador_id), tipo_gestion = $5, categoria_producto = $6, zona_geografica = $7, prioridad = $8, updated_at = NOW()
         WHERE id = $9 RETURNING *`,
        [fechaProgramada, motivoReagenda, req.user?.nombre || 'Operador', investigadorId || null, tipoGestion, categoriaProducto, zonaGeografica, prioridad, existing[0].id]
      );
      resultItem = rows[0];
    } else {
      // Programación Inicial
      const { rows } = await db.query(
        `INSERT INTO agenda_visitas (investigacion_id_sif, fecha_programada, estado_agenda, investigador_id, tipo_gestion, categoria_producto, zona_geografica, prioridad)
         VALUES ($1, $2, 'PROGRAMADA', $3, $4, $5, $6, $7) RETURNING *`,
        [investigacionId, fechaProgramada, investigadorId || null, tipoGestion, categoriaProducto, zonaGeografica, prioridad]
      );
      resultItem = rows[0];
    }

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'Operador',
      usuarioRol: req.user?.rol || 'operador',
      accion: existing.length > 0 ? 'REAGENDAR_VISITA' : 'PROGRAMAR_VISITA',
      recurso: 'agenda_visitas',
      recursoId: String(resultItem.id),
      descripcion: existing.length > 0 
        ? `Visita #${investigacionId} reagendada para ${fechaProgramada}. Motivo: ${motivoReagenda}`
        : `Visita #${investigacionId} programada para ${fechaProgramada}`,
      datosNuevos: resultItem,
    });

    res.json({ mensaje: existing.length > 0 ? 'Visita reagendada con éxito' : 'Visita programada con éxito', data: resultItem });
  } catch (err) {
    next(err);
  }
}

// Registro de Check-in en Campo (Captura Hora Inicio y Coordenadas GPS)
async function checkinVisita(req, res, next) {
  try {
    const { agendaId, latitud, longitud } = req.body;

    if (!agendaId) {
      return res.status(400).json({ error: 'agendaId es requerido' });
    }

    const { rows } = await db.query(
      `UPDATE agenda_visitas
       SET hora_inicio = NOW(), latitud_inicio = $1, longitud_inicio = $2, estado_agenda = 'EN_CAMPO', updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [latitud || null, longitud || null, agendaId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Registro de agenda no encontrado' });
    }

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'Investigador',
      usuarioRol: req.user?.rol || 'investigador',
      accion: 'CHECKIN_VISITA_CAMPO',
      recurso: 'agenda_visitas',
      recursoId: String(agendaId),
      descripcion: `Check-in realizado para visita #${agendaId} a las ${new Date().toLocaleTimeString()}`,
      datosNuevos: rows[0],
    });

    res.json({ mensaje: 'Check-in registrado. Entrevista iniciada.', data: rows[0] });
  } catch (err) {
    next(err);
  }
}

// Registro de Check-out en Campo (Captura Hora Fin, Duración Real y Reporte Obligatorio - Folio 007)
async function checkoutVisita(req, res, next) {
  try {
    const { agendaId, latitud, longitud, resultadoVisita } = req.body;

    if (!agendaId || !resultadoVisita || !resultadoVisita.trim()) {
      return res.status(400).json({ error: 'agendaId y resultadoVisita (reporte obligatorio) son requeridos' });
    }

    const { rows: existing } = await db.query(`SELECT * FROM agenda_visitas WHERE id = $1`, [agendaId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Registro de agenda no encontrado' });
    }

    const horaInicio = existing[0].hora_inicio ? new Date(existing[0].hora_inicio) : new Date();
    const horaFin = new Date();
    const duracionMinutos = Math.max(1, Math.round((horaFin.getTime() - horaInicio.getTime()) / 60000));

    const { rows } = await db.query(
      `UPDATE agenda_visitas
       SET hora_fin = $1, latitud_fin = $2, longitud_fin = $3, duracion_minutos = $4, resultado_visita = $5, estado_agenda = 'COMPLETADA', evidencias_completas = TRUE, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [horaFin, latitud || null, longitud || null, duracionMinutos, resultadoVisita.trim(), agendaId]
    );

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'Investigador',
      usuarioRol: req.user?.rol || 'investigador',
      accion: 'CHECKOUT_VISITA_CAMPO',
      recurso: 'agenda_visitas',
      recursoId: String(agendaId),
      descripcion: `Check-out finalizado para visita #${agendaId}. Duración total: ${duracionMinutos} minutos.`,
      datosNuevos: rows[0],
    });

    res.json({
      mensaje: `Visita domiciliaria completada. Duración calculada: ${duracionMinutos} minutos.`,
      duracion_minutos: duracionMinutos,
      data: rows[0],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAgenda,
  programarOReagendarVisita,
  checkinVisita,
  checkoutVisita,
};
