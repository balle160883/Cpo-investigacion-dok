const db = require('../../db');
const { registrarAuditoria } = require('./audit.controller');

async function getInvestigaciones(req, res, next) {
  try {
    const { estado, buscar, investigador_id } = req.query;
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.max(1, parseInt(req.query.limit || (investigador_id ? '500' : '50')));
    const offset = (page - 1) * limit;

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

    // Autodetectar ID si la petición viene de un usuario con rol de investigador y no especificó ID explícito
    if (!targetInvestigadorId && req.user) {
      const userRol = (req.user.rol || '').toLowerCase();
      if (userRol === 'investigador' && req.user.id) {
        targetInvestigadorId = req.user.id;
      }
      // ANALISTA: solo puede ver investigaciones con estado_validacion = 'VALIDADA'
      if (userRol === 'analista') {
        whereClauses.push(`inv.estado_validacion = 'VALIDADA'`);
      }
    }

    if (estado) {
      if (estado === 'PENDIENTE') {
        whereClauses.push(`(inv.estado IS NULL OR inv.estado = 'PENDIENTE')`);
      } else {
        queryParams.push(estado);
        whereClauses.push(`inv.estado = $${queryParams.length}`);
      }
    }

    if (targetInvestigadorId) {
      queryParams.push(targetInvestigadorId);
      whereClauses.push(`CAST(inv.investigador_id AS TEXT) = CAST($${queryParams.length} AS TEXT)`);
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
        inv_usr.nombre as investigador_nombre,
        -- VIGENCIA 90 DÍAS: busca si esta persona tiene evidencia reciente en CUALQUIER investigación
        vigencia.visita_previa_id,
        vigencia.visita_realizada_en,
        vigencia.visita_vigente_hasta,
        (vigencia.visita_vigente_hasta IS NOT NULL AND vigencia.visita_vigente_hasta > NOW()) AS visita_vigente
      FROM investigaciones inv
      LEFT JOIN personas p ON CAST(inv.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
      LEFT JOIN solicitudes_credito s ON CAST(inv.solicitud_id_sif AS TEXT) = CAST(s.id_sif AS TEXT)
      LEFT JOIN direcciones d ON CAST(p.id_sif AS TEXT) = CAST(d.persona_id_sif AS TEXT)
      LEFT JOIN investigadores inv_usr ON inv.investigador_id = inv_usr.id
      -- Subconsulta de vigencia: busca la evidencia más reciente de la misma persona en los últimos 90 días
      LEFT JOIN LATERAL (
        SELECT
          inv2.id_sif_research AS visita_previa_id,
          ev2.created_at AS visita_realizada_en,
          (ev2.created_at + INTERVAL '90 days') AS visita_vigente_hasta
        FROM evidencias_visita ev2
        JOIN investigaciones inv2 ON CAST(ev2.investigacion_id_sif AS TEXT) = CAST(inv2.id_sif_research AS TEXT)
        WHERE CAST(inv2.persona_id_sif AS TEXT) = CAST(inv.persona_id_sif AS TEXT)
          AND ev2.created_at >= NOW() - INTERVAL '90 days'
          AND CAST(inv2.id_sif_research AS TEXT) != CAST(inv.id_sif_research AS TEXT)
        ORDER BY ev2.created_at DESC
        LIMIT 1
      ) vigencia ON TRUE
      ${whereSql}
      ORDER BY inv.id_sif_research DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;

    const totalRes = await db.query(countQuery, countParams);
    const { rows } = await db.query(dataQuery, queryParams);

    const total = parseInt(totalRes.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    res.json({
      total,
      page,
      limit,
      totalPages,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
}

async function getInvestigacionDetalle(req, res, next) {
  try {
    const id = req.params.id;

    // Garantizar que existen las columnas de validación antes de consultarlas
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS estado_validacion TEXT;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS validador_id INTEGER;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS fecha_validacion TIMESTAMP;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS comentarios_validacion TEXT;`);

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
        inv_usr.telefono as investigador_telefono,
        inv.estado_validacion,
        inv.fecha_validacion,
        inv.comentarios_validacion,
        val_usr.nombre as validador_nombre
      FROM investigaciones inv
      LEFT JOIN personas p ON CAST(inv.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
      LEFT JOIN solicitudes_credito s ON CAST(inv.solicitud_id_sif AS TEXT) = CAST(s.id_sif AS TEXT)
      LEFT JOIN direcciones d ON CAST(p.id_sif AS TEXT) = CAST(d.persona_id_sif AS TEXT)
      LEFT JOIN investigadores inv_usr ON inv.investigador_id = inv_usr.id
      LEFT JOIN investigadores val_usr ON inv.validador_id = val_usr.id
      WHERE CAST(inv.id_sif_research AS TEXT) = CAST($1 AS TEXT)
      LIMIT 1;
    `, [id]);

    if (invRes.rows.length === 0) {
      return res.status(404).json({ error: 'Investigación no encontrada' });
    }

    const investigacion = invRes.rows[0];

    // 2. Avales vinculados
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

    // 3. Evidencia realizada
    const evRes = await db.query(
      'SELECT * FROM evidencias_visita WHERE CAST(investigacion_id_sif AS TEXT) = CAST($1 AS TEXT) ORDER BY created_at DESC LIMIT 1;',
      [id]
    );

    const evidencia = evRes.rows.length > 0 ? evRes.rows[0] : null;

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

    res.json({
      investigacion,
      avales,
      evidencia,
      vigenciaPrevia,
    });
  } catch (err) {
    next(err);
  }
}

async function asignarInvestigador(req, res, next) {
  try {
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
      SET investigador_id = $1, fecha_asignacion = NOW(), estado = 'EN_PROCESO', updated_at = NOW()
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
      dictamen
    } = req.body;

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
      latitud_checkin || 0,
      longitud_checkin || 0,
      JSON.stringify(estudio_socioeconomico || {}),
      JSON.stringify(fotos_urls || []),
      firma_url || null,
      firma_investigador_url || null,
      notas_investigador || (dictamen ? `Dictamen: ${dictamen}` : '')
    ]);

    await db.query(`
      UPDATE investigaciones
      SET estado = 'COMPLETADA', fecha_cumplimiento = NOW(), observaciones_sif = $1, updated_at = NOW()
      WHERE id_sif_research = $2;
    `, [notas_investigador || (dictamen ? `Dictamen: ${dictamen}` : 'Completada desde App Móvil'), id]);

    res.json({ success: true, message: 'Estudio e investigación guardados correctamente' });
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

    // Obtener estado anterior para audit log
    const { rows: prev } = await db.query(
      `SELECT estado, observaciones_sif FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT)`,
      [id]
    );

    if (prev.length === 0) {
      return res.status(404).json({ error: 'Investigación no encontrada' });
    }

    await db.query(`
      UPDATE investigaciones
      SET estado = $1,
          estado_validacion = $1,
          validador_id = $2,
          fecha_validacion = NOW(),
          comentarios_validacion = $3,
          updated_at = NOW()
      WHERE CAST(id_sif_research AS TEXT) = CAST($4 AS TEXT);
    `, [nuevoEstado, validadorId, comentarios || '', id]);

    // Registrar en Audit Log
    const accionAuditoria = accion === 'VALIDAR' ? 'VALIDAR_INVESTIGACION' : 'RECHAZAR_INVESTIGACION';
    await registrarAuditoria(req, {
      accion: accionAuditoria,
      entidad: 'investigaciones',
      entidad_id: id,
      datos_anteriores: { estado: prev[0].estado },
      datos_nuevos: { estado: nuevoEstado, comentarios_validacion: comentarios },
    });

    res.json({
      success: true,
      message: `Investigación marcada como ${nuevoEstado} correctamente`,
      estado: nuevoEstado,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInvestigaciones,
  getInvestigacionDetalle,
  asignarInvestigador,
  guardarEvidencia,
  validarInvestigacion,
};

