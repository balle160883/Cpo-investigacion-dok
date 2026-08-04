const db = require('../../db');
const { registrarAuditoria } = require('./audit.controller');

// Obtener Checklist y Semáforo Documental por Solicitud ID SIF
async function getChecklistBySolicitud(req, res, next) {
  try {
    const { solicitudId } = req.params;
    const { tipoCredito = 'GENERAL' } = req.query;

    // 1. Obtener los documentos requeridos del catálogo según tipo de crédito
    const { rows: catalogo } = await db.query(
      `SELECT * FROM catalogo_documentos_credito 
       WHERE es_activo = TRUE AND (tipo_credito = 'GENERAL' OR UPPER(tipo_credito) = UPPER($1))
       ORDER BY obligatorio DESC, id ASC`,
      [tipoCredito]
    );

    // 2. Obtener los documentos actualmente cargados en el expediente
    const { rows: expediente } = await db.query(
      `SELECT * FROM expediente_documentos WHERE solicitud_id_sif = $1`,
      [solicitudId]
    );

    // Mapear el expediente por documento_codigo
    const expedienteMap = {};
    expediente.forEach(item => {
      expedienteMap[item.documento_codigo] = item;
    });

    // 3. Evaluar el estatus de cada documento y calcular el semáforo global
    let tieneFaltanteObligatorio = false;
    let tieneRechazado = false;
    let tienePendienteRevision = false;

    const checklist = catalogo.map(doc => {
      const exp = expedienteMap[doc.codigo_documento];
      const estado = exp ? exp.estado_validacion : 'NO_CARGADO';
      const esExcepcion = exp ? exp.es_excepcion : false;

      if (doc.obligatorio) {
        if (estado === 'NO_CARGADO' && !esExcepcion) {
          tieneFaltanteObligatorio = true;
        } else if (estado === 'RECHAZADO' && !esExcepcion) {
          tieneRechazado = true;
        } else if (estado === 'PENDIENTE') {
          tienePendienteRevision = true;
        }
      }

      return {
        id_catalogo: doc.id,
        codigo_documento: doc.codigo_documento,
        nombre_documento: doc.nombre_documento,
        descripcion: doc.descripcion,
        obligatorio: doc.obligatorio,
        tipo_credito: doc.tipo_credito,
        cargado: !!exp,
        archivo_url: exp ? exp.archivo_url : null,
        nombre_archivo: exp ? exp.nombre_archivo : null,
        formato_archivo: exp ? exp.formato_archivo : null,
        es_legible: exp ? exp.es_legible : true,
        estado_validacion: estado,
        observaciones_analista: exp ? exp.observaciones_analista : null,
        es_excepcion: esExcepcion,
        justificacion_excepcion: exp ? exp.justificacion_excepcion : null,
        usuario_carga: exp ? exp.usuario_carga : null,
        fecha_carga: exp ? exp.fecha_carga : null,
        usuario_validador: exp ? exp.usuario_validador : null,
        fecha_validacion: exp ? exp.fecha_validacion : null,
      };
    });

    // 4. Calcular el color del semáforo global
    let semaforo = 'VERDE';
    let semaforoMensaje = 'Expediente documental completo y validado.';

    if (tieneFaltanteObligatorio || tieneRechazado) {
      semaforo = 'ROJO';
      semaforoMensaje = tieneRechazado 
        ? 'Existen documentos obligatorios rechazados por el analista.' 
        : 'Faltan documentos obligatorios por adjuntar al expediente.';
    } else if (tienePendienteRevision) {
      semaforo = 'AMARILLO';
      semaforoMensaje = 'Documentos obligatorios cargados pendientes de revisión por análisis.';
    }

    res.json({
      solicitud_id_sif: solicitudId,
      tipo_credito: tipoCredito,
      semaforo,
      semaforo_mensaje: semaforoMensaje,
      completado: !tieneFaltanteObligatorio && !tieneRechazado && !tienePendienteRevision,
      total_requeridos: catalogo.filter(c => c.obligatorio).length,
      total_aprobados: checklist.filter(c => c.obligatorio && (c.estado_validacion === 'APROBADO' || c.es_excepcion)).length,
      documentos: checklist,
    });
  } catch (err) {
    next(err);
  }
}

// Cargar o actualizar documento en expediente
async function cargarDocumento(req, res, next) {
  try {
    const { solicitudId, codigoDocumento, nombreArchivo, archivoUrl, formatoArchivo, usuarioCarga } = req.body;

    if (!solicitudId || !codigoDocumento || !archivoUrl) {
      return res.status(400).json({ error: 'solicitudId, codigoDocumento y archivoUrl son requeridos' });
    }

    // Verificar si ya existe en expediente
    const { rows: existing } = await db.query(
      `SELECT * FROM expediente_documentos WHERE solicitud_id_sif = $1 AND documento_codigo = $2`,
      [solicitudId, codigoDocumento]
    );

    let docResult;
    if (existing.length > 0) {
      const { rows } = await db.query(
        `UPDATE expediente_documentos 
         SET nombre_archivo = $1, archivo_url = $2, formato_archivo = $3, usuario_carga = $4, fecha_carga = NOW(), estado_validacion = 'PENDIENTE', observaciones_analista = NULL
         WHERE id = $5 RETURNING *`,
        [nombreArchivo, archivoUrl, formatoArchivo || 'JPG', usuarioCarga || req.user?.nombre || 'Sucursal', existing[0].id]
      );
      docResult = rows[0];
    } else {
      const { rows } = await db.query(
        `INSERT INTO expediente_documentos (solicitud_id_sif, documento_codigo, nombre_archivo, archivo_url, formato_archivo, usuario_carga, estado_validacion)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE') RETURNING *`,
        [solicitudId, codigoDocumento, nombreArchivo, archivoUrl, formatoArchivo || 'JPG', usuarioCarga || req.user?.nombre || 'Sucursal']
      );
      docResult = rows[0];
    }

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || usuarioCarga || 'Sucursal',
      usuarioRol: req.user?.rol || 'operador',
      accion: 'CARGA_DOCUMENTO',
      recurso: 'expediente_documentos',
      recursoId: String(docResult.id),
      descripcion: `Documento ${codigoDocumento} cargado para la solicitud ${solicitudId}`,
      datosNuevos: docResult,
    });

    res.json({ mensaje: 'Documento cargado correctamente', data: docResult });
  } catch (err) {
    next(err);
  }
}

// Validar o Rechazar documento (Rol Analista / Admin)
async function validarDocumento(req, res, next) {
  try {
    const { id } = req.params;
    const { estadoValidacion, observaciones, esLegible = true } = req.body;

    if (!['APROBADO', 'RECHAZADO'].includes(estadoValidacion)) {
      return res.status(400).json({ error: 'El estado_validacion debe ser APROBADO o RECHAZADO' });
    }

    const { rows } = await db.query(
      `UPDATE expediente_documentos
       SET estado_validacion = $1, observaciones_analista = $2, es_legible = $3, usuario_validador = $4, fecha_validacion = NOW()
       WHERE id = $5 RETURNING *`,
      [estadoValidacion, observaciones || null, esLegible, req.user?.nombre || 'Analista', id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Registro de documento no encontrado' });
    }

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'Analista',
      usuarioRol: req.user?.rol || 'analista',
      accion: `VALIDAR_DOCUMENTO_${estadoValidacion}`,
      recurso: 'expediente_documentos',
      recursoId: String(id),
      descripcion: `Documento #${id} marcado como ${estadoValidacion}. Obs: ${observaciones || 'Sin observaciones'}`,
      datosNuevos: rows[0],
    });

    res.json({ mensaje: `Documento ${estadoValidacion.toLowerCase()} con éxito`, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

// Registrar Excepción Documental (Entrega Física Posterior)
async function registrarExcepcionDocumento(req, res, next) {
  try {
    const { solicitudId, codigoDocumento, justificacion } = req.body;

    if (!solicitudId || !codigoDocumento || !justificacion) {
      return res.status(400).json({ error: 'solicitudId, codigoDocumento y justificacion son requeridos' });
    }

    const { rows: existing } = await db.query(
      `SELECT * FROM expediente_documentos WHERE solicitud_id_sif = $1 AND documento_codigo = $2`,
      [solicitudId, codigoDocumento]
    );

    let docResult;
    if (existing.length > 0) {
      const { rows } = await db.query(
        `UPDATE expediente_documentos 
         SET es_excepcion = TRUE, justificacion_excepcion = $1, estado_validacion = 'EXCEPCION', usuario_validador = $2, fecha_validacion = NOW()
         WHERE id = $3 RETURNING *`,
        [justificacion, req.user?.nombre || 'Operador', existing[0].id]
      );
      docResult = rows[0];
    } else {
      const { rows } = await db.query(
        `INSERT INTO expediente_documentos (solicitud_id_sif, documento_codigo, es_excepcion, justificacion_excepcion, estado_validacion, usuario_validador, fecha_validacion)
         VALUES ($1, $2, TRUE, $3, 'EXCEPCION', $4, NOW()) RETURNING *`,
        [solicitudId, codigoDocumento, justificacion, req.user?.nombre || 'Operador']
      );
      docResult = rows[0];
    }

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'Operador',
      usuarioRol: req.user?.rol || 'operador',
      accion: 'REGISTRO_EXCEPCION_DOCUMENTAL',
      recurso: 'expediente_documentos',
      recursoId: String(docResult.id),
      descripcion: `Excepción registrada para ${codigoDocumento} en solicitud ${solicitudId}. Motivo: ${justificacion}`,
      datosNuevos: docResult,
    });

    res.json({ mensaje: 'Excepción documental registrada correctamente', data: docResult });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getChecklistBySolicitud,
  cargarDocumento,
  validarDocumento,
  registrarExcepcionDocumento,
};
