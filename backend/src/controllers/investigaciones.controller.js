const db = require('../../db');

async function getInvestigaciones(req, res, next) {
  try {
    const { estado, buscar, investigador_id } = req.query;
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.max(1, parseInt(req.query.limit || (investigador_id ? '500' : '50')));
    const offset = (page - 1) * limit;

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

    res.json({
      investigacion,
      avales,
      evidencia,
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

    await db.query(`
      UPDATE investigaciones 
      SET investigador_id = $1, fecha_asignacion = NOW(), estado = 'EN_PROCESO', updated_at = NOW()
      WHERE CAST(id_sif_research AS TEXT) = CAST($2 AS TEXT);
    `, [investigador_id, id]);

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

module.exports = {
  getInvestigaciones,
  getInvestigacionDetalle,
  asignarInvestigador,
  guardarEvidencia,
};
