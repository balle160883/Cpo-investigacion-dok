const db = require('../../db');
const { registrarAuditoria } = require('./audit.controller');

/**
 * Evalúa las inconsistencias y calidad de datos de la tabla personas y direcciones en PostgreSQL
 * para advertir al asignador antes de enviar la investigación a campo.
 */
function evaluarInconsistenciasPersona(row) {
  const inconsistencias = [];
  let nivel = 'NINGUNA'; // 'NINGUNA' | 'MEDIA' | 'ALTA'

  // 1. Teléfonos / Contacto
  const tieneTel = Boolean(
    (row.telefono_principal && String(row.telefono_principal).trim()) ||
    (row.telefono_secundario && String(row.telefono_secundario).trim()) ||
    (row.telefono && String(row.telefono).trim())
  );
  
  const semaforoContacto = row.estado_contacto_semaforo
    ? String(row.estado_contacto_semaforo).toUpperCase()
    : (tieneTel ? 'AMARILLO' : 'ROJO');

  if (!tieneTel || semaforoContacto === 'ROJO') {
    inconsistencias.push('Sin teléfono de contacto registrado o en estatus ROJO');
    nivel = 'ALTA';
  } else if (semaforoContacto === 'AMARILLO') {
    inconsistencias.push('Contacto telefónico no verificado (Semáforo Amarillo)');
    if (nivel !== 'ALTA') nivel = 'MEDIA';
  }

  // 2. Domicilio
  if (!row.domicilio_validado_sucursal) {
    inconsistencias.push('Domicilio no prevalidado por la sucursal');
    if (nivel === 'NINGUNA') nivel = 'MEDIA';
  }

  const calle = row.calle ? String(row.calle).trim() : '';
  if (!calle || calle.toLowerCase().includes('desconocid')) {
    inconsistencias.push('Calle de domicilio no especificada o desconocida');
    nivel = 'ALTA';
  }

  const numExt = row.numero_exterior ? String(row.numero_exterior).trim() : '';
  if (!numExt || numExt.toUpperCase() === 'S/N') {
    inconsistencias.push('Número exterior no especificado o marcado S/N');
    if (nivel === 'NINGUNA') nivel = 'MEDIA';
  }

  const colonia = row.colonia ? String(row.colonia).trim() : '';
  if (!colonia || colonia.toLowerCase().includes('desconocid')) {
    inconsistencias.push('Colonia no especificada');
    if (nivel === 'NINGUNA') nivel = 'MEDIA';
  }

  // 3. Documentos de Identidad (CURP, RFC, Clave de Elector)
  const curp = row.curp ? String(row.curp).trim() : '';
  if (!curp || curp.length < 18) {
    inconsistencias.push('CURP ausente o con formato incompleto');
    if (nivel === 'NINGUNA') nivel = 'MEDIA';
  }

  const rfc = row.rfc ? String(row.rfc).trim() : '';
  if (!rfc || rfc.length < 10) {
    inconsistencias.push('RFC ausente o incompleto');
    if (nivel === 'NINGUNA') nivel = 'MEDIA';
  }

  return {
    tiene_inconsistencias: inconsistencias.length > 0,
    nivel_inconsistencia: nivel, // 'ALTA', 'MEDIA', 'NINGUNA'
    inconsistencias,
    estado_contacto_semaforo: semaforoContacto,
  };
}

async function getInvestigaciones(req, res, next) {
  try {
    const { estado, buscar, investigador_id, colonia, sucursal } = req.query;

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

    // Filtros de Rol por Usuario autenticado
    if (req.user) {
      const userRol = (req.user.rol || '').toLowerCase();
      const rolesArray = userRol.split(',').map((r) => r.trim());
      const esAdminOAsignador = rolesArray.some((r) =>
        ['admin', 'superadmin', 'asignador', 'supervisor', 'coordinadora_analistas', 'coordinador_analistas', 'gerente_analistas'].includes(r)
      );
      const esSoloValidador = rolesArray.includes('validador') && !esAdminOAsignador;
      const esSoloAnalista = rolesArray.includes('analista') && !esAdminOAsignador;
      const esInvestigadorCampo =
        rolesArray.some((r) => ['investigador', 'investigador_campo'].includes(r)) &&
        !esAdminOAsignador &&
        !rolesArray.includes('validador');

      // Solo si es un investigador de campo puro se fuerza a filtrar por sus propias asignaciones
      if (req.user.id && !targetInvestigadorId) {
        if (esInvestigadorCampo) {
          targetInvestigadorId = req.user.id;
        }
      }

      // VALIDADOR PURO (sin rol asignador ni admin): Solo ve cuando todas las visitas del crédito están completadas
      if (esSoloValidador) {
        whereClauses.push(`NOT EXISTS (
          SELECT 1 
          FROM investigaciones inv_sub 
          WHERE inv_sub.solicitud_id_sif = inv.solicitud_id_sif
            AND (inv_sub.estado IS NULL OR inv_sub.estado != 'COMPLETADA')
        )`);
      }

      // ANALISTA PURO: solo puede ver investigaciones con estado_validacion = 'VALIDADA'
      if (esSoloAnalista) {
        whereClauses.push(`inv.estado_validacion = 'VALIDADA'`);
      }
    }

    const page = Math.max(1, parseInt(req.query.page || '1'));
    // Calcular límite considerando el targetInvestigadorId inferido por el token JWT
    const limit = Math.max(1, parseInt(req.query.limit || (targetInvestigadorId ? '500' : '50')));
    const offset = (page - 1) * limit;

    if (estado) {
      if (estado === 'PENDIENTE') {
        whereClauses.push(`(inv.estado IS NULL OR inv.estado = 'PENDIENTE' OR inv.estado = 'EN_PROCESO')`);
      } else if (estado === 'TODAS') {
        // Muestra todas las investigaciones históricas sin filtrar por estado
      } else {
        queryParams.push(estado);
        whereClauses.push(`inv.estado = $${queryParams.length}`);
      }
    } else {
      // Por defecto (sin filtro explícito), ocultar investigaciones ya validadas o aprobadas final
      // para que al dar el visto bueno desaparezcan de la cola de trabajo activa.
      whereClauses.push(`(inv.estado IS NULL OR inv.estado NOT IN ('VALIDADA', 'APROBADA_FINAL'))`);
    }

    if (targetInvestigadorId) {
      queryParams.push(targetInvestigadorId);
      whereClauses.push(`inv.investigador_id = $${queryParams.length}`);
    }

    if (sucursal) {
      const sucursalNum = parseInt(sucursal, 10);
      if (!isNaN(sucursalNum)) {
        queryParams.push(sucursalNum);
        whereClauses.push(`s.sucursal_id = $${queryParams.length}`);
      } else {
        queryParams.push(`%${sucursal.trim()}%`);
        whereClauses.push(`s.sucursal_nombre ILIKE $${queryParams.length}`);
      }
    }

    if (colonia) {
      queryParams.push(colonia.trim());
      whereClauses.push(`TRIM(d.colonia) = $${queryParams.length}`);
    }

    if (buscar) {
      queryParams.push(`%${buscar}%`);
      whereClauses.push(`(
        p.nombre_completo ILIKE $${queryParams.length} OR 
        s.folio ILIKE $${queryParams.length} OR 
        CAST(inv.id_sif_research AS TEXT) ILIKE $${queryParams.length} OR
        d.colonia ILIKE $${queryParams.length}
      )`);
    }

    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const countQuery = `
      SELECT count(*)
      FROM investigaciones inv
      LEFT JOIN personas p ON inv.persona_id_sif = p.id_sif
      LEFT JOIN solicitudes_credito s ON inv.solicitud_id_sif = s.id_sif
      LEFT JOIN direcciones d ON p.id_sif = d.persona_id_sif
      ${whereSql};
    `;

    const countParams = [...queryParams];

    queryParams.push(limit);
    const limitIndex = queryParams.length;
    queryParams.push(offset);
    const offsetIndex = queryParams.length;

    const dataQuery = `
      WITH paginated AS (
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
          inv.estado_validacion,
          inv.validador_id,
          inv.fecha_validacion,
          inv.comentarios_validacion,
          inv.analista_id,
          inv.fecha_revalidacion,
          inv.comentarios_revalidacion,
          p.nombre_completo as sujeto_nombre,
          p.es_aval,
          p.estado_contacto_semaforo,
          p.telefono_principal,
          p.telefono_secundario,
          p.curp,
          p.rfc,
          p.clave_elector,
          p.nivel_riesgo,
          s.folio as solicitud_folio,
          s.monto_solicitado,
          s.sucursal_id,
          s.sucursal_nombre,
          d.calle,
          d.numero_exterior,
          d.codigo_postal,
          d.colonia,
          d.municipio,
          d.estado_provincia,
          d.domicilio_validado_sucursal,
          inv_usr.nombre as investigador_nombre,
          val_usr.nombre as validador_nombre,
          an_usr.nombre as analista_nombre
        FROM investigaciones inv
        LEFT JOIN personas p ON inv.persona_id_sif = p.id_sif
        LEFT JOIN solicitudes_credito s ON inv.solicitud_id_sif = s.id_sif
        LEFT JOIN direcciones d ON p.id_sif = d.persona_id_sif
        LEFT JOIN investigadores inv_usr ON inv.investigador_id = inv_usr.id
        LEFT JOIN investigadores val_usr ON inv.validador_id = val_usr.id
        LEFT JOIN investigadores an_usr ON inv.analista_id = an_usr.id
        ${whereSql}
        ORDER BY inv.fecha_asignacion DESC NULLS LAST, inv.id_sif_research DESC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      )
      SELECT 
        pag.*,
        -- PROGRESO DEL PAQUETE DEL CRÉDITO (Solicitante + Avales)
        COALESCE(paq.paquete_total, 1) as paquete_total,
        COALESCE(paq.paquete_completadas, 0) as paquete_completadas,
        (COALESCE(paq.paquete_total, 1) = COALESCE(paq.paquete_completadas, 0)) as paquete_completo,
        -- VIGENCIA 90 DÍAS
        vigencia.visita_previa_id,
        vigencia.visita_realizada_en,
        vigencia.visita_vigente_hasta,
        (vigencia.visita_vigente_hasta IS NOT NULL AND vigencia.visita_vigente_hasta > NOW()) AS visita_vigente
      FROM paginated pag
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*) as paquete_total,
          COUNT(*) FILTER (WHERE inv_p.estado = 'COMPLETADA') as paquete_completadas
        FROM investigaciones inv_p
        WHERE inv_p.solicitud_id_sif = pag.solicitud_id_sif
      ) paq ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          inv2.id_sif_research AS visita_previa_id,
          ev2.created_at AS visita_realizada_en,
          (ev2.created_at + INTERVAL '90 days') AS visita_vigente_hasta
        FROM evidencias_visita ev2
        JOIN investigaciones inv2 ON ev2.investigacion_id_sif = inv2.id_sif_research
        WHERE inv2.persona_id_sif = pag.persona_id_sif
          AND ev2.created_at >= NOW() - INTERVAL '90 days'
          AND inv2.id_sif_research != pag.id_sif_research
        ORDER BY ev2.created_at DESC
        LIMIT 1
      ) vigencia ON TRUE
      ORDER BY pag.fecha_asignacion DESC NULLS LAST, pag.id_sif_research DESC;
    `;

    const totalRes = await db.query(countQuery, countParams);
    const { rows } = await db.query(dataQuery, queryParams);

    const total = parseInt(totalRes.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    // Enriquecer cada fila con la evaluación de consistencia de la persona
    const enrichedRows = rows.map((row) => {
      const inconsistenciasInfo = evaluarInconsistenciasPersona(row);
      return {
        ...row,
        ...inconsistenciasInfo,
      };
    });

    res.json({
      total,
      page,
      limit,
      totalPages,
      data: enrichedRows,
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
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS analista_id INTEGER;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS fecha_revalidacion TIMESTAMP;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS comentarios_revalidacion TEXT;`);

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
        p.estado_contacto_semaforo,
        p.telefono_principal,
        p.telefono_secundario,
        p.curp,
        p.rfc,
        p.clave_elector,
        p.nivel_riesgo,
        s.folio as solicitud_folio,
        s.monto_solicitado,
        s.monto_aprobado,
        s.sucursal_id,
        s.sucursal_nombre,
        s.cliente_id_sif,
        d.calle, d.numero_exterior, d.numero_interior, d.codigo_postal, d.colonia, d.municipio, d.estado_provincia, d.referencias, d.latitud, d.longitud,
        d.domicilio_validado_sucursal,
        inv_usr.nombre as investigador_nombre,
        inv_usr.telefono as investigador_telefono,
        inv.estado_validacion,
        inv.fecha_validacion,
        inv.comentarios_validacion,
        val_usr.nombre as validador_nombre,
        inv.analista_id,
        an_usr.nombre as analista_nombre,
        inv.fecha_revalidacion,
        inv.comentarios_revalidacion
      FROM investigaciones inv
      LEFT JOIN personas p ON CAST(inv.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
      LEFT JOIN solicitudes_credito s ON CAST(inv.solicitud_id_sif AS TEXT) = CAST(s.id_sif AS TEXT)
      LEFT JOIN direcciones d ON CAST(p.id_sif AS TEXT) = CAST(d.persona_id_sif AS TEXT)
      LEFT JOIN investigadores inv_usr ON inv.investigador_id = inv_usr.id
      LEFT JOIN investigadores val_usr ON inv.validador_id = val_usr.id
      LEFT JOIN investigadores an_usr ON inv.analista_id = an_usr.id
      WHERE CAST(inv.id_sif_research AS TEXT) = CAST($1 AS TEXT)
      LIMIT 1;
    `, [id]);

    if (invRes.rows.length === 0) {
      return res.status(404).json({ error: 'Investigación no encontrada' });
    }

    const inconsistenciasDetalle = evaluarInconsistenciasPersona(invRes.rows[0]);
    const investigacion = {
      ...invRes.rows[0],
      ...inconsistenciasDetalle,
    };

    // 2. Avales e Investigaciones vinculadas al mismo Crédito
    let avales = [];
    let paqueteInvestigaciones = [];
    if (investigacion.solicitud_id_sif) {
      const avalesRes = await db.query(`
        SELECT sa.aval_id_sif, p.nombre_completo, d.calle, d.numero_exterior, d.codigo_postal
        FROM solicitud_avales sa
        JOIN personas p ON CAST(sa.aval_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
        LEFT JOIN direcciones d ON CAST(p.id_sif AS TEXT) = CAST(d.persona_id_sif AS TEXT)
        WHERE CAST(sa.solicitud_id_sif AS TEXT) = CAST($1 AS TEXT);
      `, [investigacion.solicitud_id_sif]);
      avales = avalesRes.rows;

      const paqueteRes = await db.query(`
        SELECT 
          inv_p.id_sif_research,
          inv_p.persona_id_sif,
          inv_p.tipo_sujeto,
          COALESCE(p.es_aval, FALSE) as es_aval,
          COALESCE(inv_p.estado, 'PENDIENTE') as estado,
          inv_p.estado_validacion,
          p.nombre_completo as sujeto_nombre
        FROM investigaciones inv_p
        LEFT JOIN personas p ON CAST(inv_p.persona_id_sif AS TEXT) = CAST(p.id_sif AS TEXT)
        WHERE CAST(inv_p.solicitud_id_sif AS TEXT) = CAST($1 AS TEXT)
        ORDER BY COALESCE(p.es_aval, FALSE) ASC, inv_p.id_sif_research ASC;
      `, [investigacion.solicitud_id_sif]);
      paqueteInvestigaciones = paqueteRes.rows;
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
      paqueteInvestigaciones,
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
      SET investigador_id = $1, origen_asignacion = 'PLATAFORMA_CPO', asignacion_manual = TRUE, fecha_asignacion = NOW(), estado = 'EN_PROCESO', updated_at = NOW()
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

async function asignarInvestigadorLote(req, res, next) {
  try {
    const { investigacion_ids, investigador_id } = req.body;

    if (!Array.isArray(investigacion_ids) || investigacion_ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere una lista de IDs de investigaciones (investigacion_ids).' });
    }

    if (!investigador_id) {
      return res.status(400).json({ error: 'ID de investigador requerido (investigador_id).' });
    }

    // Convertir todos los IDs a string para evitar problemas de tipos
    const idsClean = investigacion_ids.map((id) => String(id));

    const result = await db.query(
      `UPDATE investigaciones
       SET investigador_id = $1,
           origen_asignacion = 'PLATAFORMA_CPO',
           asignacion_manual = TRUE,
           fecha_asignacion = NOW(),
           estado = 'EN_PROCESO',
           updated_at = NOW()
       WHERE CAST(id_sif_research AS TEXT) = ANY($2::text[])
       RETURNING id_sif_research;`,
      [investigador_id, idsClean]
    );

    const actualizados = result.rows.map((r) => r.id_sif_research);

    // Emitir actualización vía WebSockets
    const io = req.app.get('io');
    if (io) {
      io.emit('investigaciones_actualizadas', {
        tipo: 'ASIGNACION_LOTE',
        investigador_id,
        investigacion_ids: actualizados,
        total: actualizados.length,
      });
    }

    // Registrar en auditoría
    registrarAuditoria({
      usuario_id: req.user?.id || null,
      usuario_nombre: req.user?.nombre || req.user?.email || 'Sistema',
      usuario_rol: req.user?.rol || 'sistema',
      accion: 'ASIGNAR_INVESTIGADOR_LOTE',
      recurso: 'investigaciones',
      recurso_id: actualizados.join(','),
      descripcion: `Asignación en lote de ${actualizados.length} investigaciones al investigador ID ${investigador_id}`,
      datos_nuevos: { investigador_id, total: actualizados.length },
    });

    res.json({
      success: true,
      message: `Se asignaron exitosamente ${actualizados.length} investigaciones al investigador.`,
      asignadas: actualizados,
    });
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
      dictamen,
      supuesto
    } = req.body;

    const supuestoValor = supuesto || estudio_socioeconomico?.supuesto || '';
    const dictamenInfo = dictamen ? `Dictamen: ${dictamen}${supuestoValor ? ` [Supuesto: ${supuestoValor}]` : ''}` : '';

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
      notas_investigador || dictamenInfo
    ]);

    await db.query(`
      UPDATE investigaciones
      SET estado = 'COMPLETADA', fecha_cumplimiento = NOW(), observaciones_sif = $1, updated_at = NOW()
      WHERE id_sif_research = $2;
    `, [notas_investigador ? `${notas_investigador}${supuestoValor ? ` (Supuesto: ${supuestoValor})` : ''}` : (dictamenInfo || 'Completada desde App Móvil'), id]);

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

    // Obtener datos anteriores para audit log y verificación de paquete
    const { rows: prev } = await db.query(
      `SELECT estado, observaciones_sif, solicitud_id_sif FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT)`,
      [id]
    );

    if (prev.length === 0) {
      return res.status(404).json({ error: 'Investigación no encontrada' });
    }

    // Si la acción es VALIDAR, verificar que todas las investigaciones del crédito (solicitante y avales) estén completadas
    if (accion === 'VALIDAR' && prev[0].solicitud_id_sif) {
      const { rows: incompletas } = await db.query(`
        SELECT id_sif_research, estado
        FROM investigaciones
        WHERE CAST(solicitud_id_sif AS TEXT) = CAST($1 AS TEXT)
          AND (estado IS NULL OR estado NOT IN ('COMPLETADA', 'VALIDADA', 'APROBADA_FINAL'))
      `, [prev[0].solicitud_id_sif]);

      if (incompletas.length > 0) {
        return res.status(422).json({
          error: `No se puede validar esta investigación porque el paquete del crédito aún tiene ${incompletas.length} investigación(es) pendiente(s) de completar en campo (solicitante/avales).`,
        });
      }
    }

    await db.query(`
      UPDATE investigaciones
      SET estado = $1,
          estado_validacion = $2,
          validador_id = $3,
          fecha_validacion = NOW(),
          comentarios_validacion = $4,
          updated_at = NOW()
      WHERE CAST(id_sif_research AS TEXT) = CAST($5 AS TEXT);
    `, [nuevoEstado, nuevoEstado, validadorId, comentarios || '', id]);

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

async function revalidarInvestigacion(req, res, next) {
  try {
    const id = req.params.id;
    // accion: 'APROBAR_FINAL' | 'DEVOLVER_VALIDADOR'
    const { accion, comentarios } = req.body;

    if (!accion || !['APROBAR_FINAL', 'DEVOLVER_VALIDADOR'].includes(accion)) {
      return res.status(400).json({ error: 'Acción de revalidación inválida. Debe ser APROBAR_FINAL o DEVOLVER_VALIDADOR.' });
    }

    // Verificar que la investigación exista y esté VALIDADA (solo se puede revalidar tras el validador)
    const { rows: prev } = await db.query(
      `SELECT estado, estado_validacion FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT)`,
      [id]
    );

    if (prev.length === 0) {
      return res.status(404).json({ error: 'Investigación no encontrada' });
    }

    const estadoActual = prev[0].estado_validacion || prev[0].estado;
    const nuevoEstado = accion === 'APROBAR_FINAL' ? 'APROBADA_FINAL' : 'DEVUELTA_A_VALIDADOR';
    const analistaId = req.user?.id || null;

    // Garantizar columnas de revalidacion
    try {
      await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS analista_id INTEGER;`);
      await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS fecha_revalidacion TIMESTAMP;`);
      await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS comentarios_revalidacion TEXT;`);
    } catch (e) {}

    await db.query(`
      UPDATE investigaciones
      SET estado = $1,
          estado_validacion = $2,
          analista_id = $3,
          fecha_revalidacion = NOW(),
          comentarios_revalidacion = $4,
          updated_at = NOW()
      WHERE CAST(id_sif_research AS TEXT) = CAST($5 AS TEXT);
    `, [nuevoEstado, nuevoEstado, analistaId, comentarios || '', id]);

    // Registrar en Audit Log
    const accionAuditoria = accion === 'APROBAR_FINAL' ? 'APROBAR_INVESTIGACION_FINAL' : 'DEVOLVER_A_VALIDADOR';
    await registrarAuditoria(req, {
      accion: accionAuditoria,
      entidad: 'investigaciones',
      entidad_id: id,
      datos_anteriores: { estado: estadoActual },
      datos_nuevos: { estado: nuevoEstado, comentarios_revalidacion: comentarios },
    });

    res.json({
      success: true,
      message: accion === 'APROBAR_FINAL'
        ? `✅ Investigación aprobada definitivamente (APROBADA_FINAL).`
        : `🔄 Investigación devuelta al Validador para revisión.`,
      estado: nuevoEstado,
    });
  } catch (err) {
    next(err);
  }
}

// Devuelve las colonias únicas con investigaciones activas, con conteo de total y sin asignar
async function getColoniasActivas(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT
        TRIM(d.colonia) AS colonia,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE inv.investigador_id IS NULL OR inv.estado = 'PENDIENTE') AS sin_asignar
      FROM investigaciones inv
      JOIN personas p ON inv.persona_id_sif = p.id_sif
      JOIN direcciones d ON p.id_sif = d.persona_id_sif
      WHERE d.colonia IS NOT NULL
        AND d.colonia != ''
        AND (inv.estado IS NULL OR inv.estado NOT IN ('VALIDADA', 'APROBADA_FINAL', 'RECHAZADA'))
      GROUP BY TRIM(d.colonia)
      ORDER BY COUNT(*) DESC, TRIM(d.colonia) ASC
      LIMIT 100;
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// Devuelve las sucursales únicas con investigaciones activas, con conteo de total y sin asignar
async function getSucursalesActivas(req, res, next) {
  try {
    const { rows } = await db.query(`
      SELECT
        s.sucursal_id,
        COALESCE(MAX(s.sucursal_nombre), '') AS sucursal_nombre,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE inv.investigador_id IS NULL OR inv.estado = 'PENDIENTE') AS sin_asignar
      FROM investigaciones inv
      JOIN solicitudes_credito s ON inv.solicitud_id_sif = s.id_sif
      WHERE s.sucursal_id IS NOT NULL
        AND (inv.estado IS NULL OR inv.estado NOT IN ('VALIDADA', 'APROBADA_FINAL', 'RECHAZADA'))
      GROUP BY s.sucursal_id
      ORDER BY s.sucursal_id ASC;
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

// Guardar o actualizar comentarios/observaciones del validador de crédito
async function guardarComentariosValidador(req, res, next) {
  try {
    const id = req.params.id;
    const { comentarios } = req.body;
    const validadorId = req.user?.id || null;

    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS comentarios_validacion TEXT;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS validador_id INTEGER;`);
    await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS fecha_validacion TIMESTAMP;`);

    const { rows: prev } = await db.query(
      `SELECT estado, comentarios_validacion, validador_id FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = CAST($1 AS TEXT)`,
      [id]
    );

    if (prev.length === 0) {
      return res.status(404).json({ error: 'Investigación no encontrada' });
    }

    await db.query(`
      UPDATE investigaciones
      SET comentarios_validacion = $1,
          validador_id = COALESCE(validador_id, $2),
          updated_at = NOW()
      WHERE CAST(id_sif_research AS TEXT) = CAST($3 AS TEXT);
    `, [comentarios || '', validadorId, id]);

    await registrarAuditoria(req, {
      accion: 'ACTUALIZAR_COMENTARIOS_VALIDADOR',
      entidad: 'investigaciones',
      entidad_id: id,
      datos_anteriores: { comentarios_validacion: prev[0].comentarios_validacion },
      datos_nuevos: { comentarios_validacion: comentarios },
    });

    res.json({
      success: true,
      message: 'Comentarios del validador actualizados correctamente',
      comentarios_validacion: comentarios,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInvestigaciones,
  getInvestigacionDetalle,
  getColoniasActivas,
  getSucursalesActivas,
  asignarInvestigador,
  asignarInvestigadorLote,
  guardarEvidencia,
  validarInvestigacion,
  revalidarInvestigacion,
  guardarComentariosValidador,
};
