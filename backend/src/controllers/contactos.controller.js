const db = require('../../db');
const { registrarAuditoria } = require('./audit.controller');

// Obtener datos de contacto, prevalidación de domicilio y semáforo por Persona ID SIF o Investigación ID SIF
async function getContactoDetalle(req, res, next) {
  try {
    const { id } = req.params; // persona_id_sif o id_sif_research

    // 1. Obtener persona_id_sif desde investigaciones si se pasó id_sif_research
    let targetPersonaId = id;
    const { rows: invRows } = await db.query(
      `SELECT persona_id_sif FROM investigaciones WHERE CAST(id_sif_research AS TEXT) = $1 OR CAST(solicitud_id_sif AS TEXT) = $1 LIMIT 1`,
      [id]
    );

    if (invRows.length > 0 && invRows[0].persona_id_sif) {
      targetPersonaId = String(invRows[0].persona_id_sif);
    }

    // 2. Garantizar que la persona exista en la tabla personas
    let { rows: personas } = await db.query(
      `SELECT * FROM personas WHERE CAST(id_sif AS TEXT) = $1`,
      [targetPersonaId]
    );

    if (personas.length === 0) {
      // Insertar registro base para la persona
      const { rows: newPersona } = await db.query(
        `INSERT INTO personas (id_sif, nombre_completo, estado_contacto_semaforo)
         VALUES ($1, $2, 'AMARILLO') ON CONFLICT DO NOTHING RETURNING *`,
        [targetPersonaId, `Socio / Cliente #${targetPersonaId}`]
      );
      if (newPersona.length > 0) {
        personas = newPersona;
      } else {
        const { rows: pFetch } = await db.query(`SELECT * FROM personas WHERE CAST(id_sif AS TEXT) = $1`, [targetPersonaId]);
        personas = pFetch;
      }
    }

    // 3. Obtener dirección vinculada
    let { rows: direcciones } = await db.query(
      `SELECT * FROM direcciones WHERE CAST(persona_id_sif AS TEXT) = $1 LIMIT 1`,
      [targetPersonaId]
    );

    if (direcciones.length === 0) {
      const { rows: newDir } = await db.query(
        `INSERT INTO direcciones (persona_id_sif, calle, colonia, municipio, estado_provincia, domicilio_validado_sucursal)
         VALUES ($1, 'Calle Desconocida', 'Colonia Central', 'Guadalajara', 'Jalisco', FALSE) RETURNING *`,
        [targetPersonaId]
      );
      direcciones = newDir;
    }

    const persona = personas[0] || { id_sif: targetPersonaId, nombre_completo: `Socio #${targetPersonaId}` };
    const direccion = direcciones[0] || {};

    let semaforoContacto = persona.estado_contacto_semaforo || 'AMARILLO';
    if (!persona.telefono_principal && !persona.telefono_secundario && !persona.telefono) {
      semaforoContacto = 'ROJO';
    }

    res.json({
      persona_id_sif: persona.id_sif,
      nombre_completo: persona.nombre_completo,
      domicilio: {
        direccion_id: direccion.id,
        calle: direccion.calle || 'Por verificar',
        numero_exterior: direccion.numero_exterior || 'S/N',
        numero_interior: direccion.numero_interior || '',
        codigo_postal: direccion.codigo_postal || '44700',
        colonia: direccion.colonia || 'Oblatos',
        municipio: direccion.municipio || 'Guadalajara',
        estado_provincia: direccion.estado_provincia || 'Jalisco',
        referencias: direccion.referencias || '',
        latitud: direccion.latitud || 20.6736,
        longitud: direccion.longitud || -103.344,
        domicilio_validado_sucursal: !!direccion.domicilio_validado_sucursal,
        fecha_validacion_domicilio: direccion.fecha_validacion_domicilio,
        usuario_validacion_domicilio: direccion.usuario_validacion_domicilio,
        metodo_validacion_domicilio: direccion.metodo_validacion_domicilio,
        observaciones_domicilio: direccion.observaciones_domicilio,
      },
      contacto: {
        telefono_principal: persona.telefono_principal || persona.telefono || '',
        telefono_secundario: persona.telefono_secundario || '',
        email_validado: persona.email_validado || persona.email || '',
        fuente_datos_contacto: persona.fuente_datos_contacto || 'SUCURSAL',
        estado_contacto_semaforo: semaforoContacto,
        fecha_validacion_contacto: persona.fecha_validacion_contacto,
        usuario_validacion_contacto: persona.usuario_validacion_contacto,
      }
    });
  } catch (err) {
    next(err);
  }
}

// Prevalidar Domicilio por Sucursal antes de enviar a campo (Folio 002)
async function prevalidarDomicilio(req, res, next) {
  try {
    const { personaIdSif, metodoValidacion = 'LLAMADA', observaciones } = req.body;

    if (!personaIdSif) {
      return res.status(400).json({ error: 'personaIdSif es requerido' });
    }

    const { rows } = await db.query(
      `UPDATE direcciones
       SET domicilio_validado_sucursal = TRUE, fecha_validacion_domicilio = NOW(), usuario_validacion_domicilio = $1, metodo_validacion_domicilio = $2, observaciones_domicilio = $3
       WHERE CAST(persona_id_sif AS TEXT) = $4 RETURNING *`,
      [req.user?.nombre || 'Sucursal Operativa', metodoValidacion, observaciones || null, personaIdSif]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Registro de dirección no encontrado para esta persona' });
    }

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'Sucursal',
      usuarioRol: req.user?.rol || 'operador',
      accion: 'PREVALIDAR_DOMICILIO_SUCURSAL',
      recurso: 'direcciones',
      recursoId: String(rows[0].id),
      descripcion: `Domicilio prevalidado por sucursal vía ${metodoValidacion} para la persona ${personaIdSif}`,
      datosNuevos: rows[0],
    });

    res.json({ mensaje: 'Domicilio prevalidado correctamente por la sucursal', data: rows[0] });
  } catch (err) {
    next(err);
  }
}

// Validar Datos de Contacto y Semáforo (Folio 003)
async function validarContacto(req, res, next) {
  try {
    const { personaIdSif, telefonoPrincipal, telefonoSecundario, emailValidado, fuenteDatos = 'SUCURSAL', estadoSemaforo = 'VERDE' } = req.body;

    if (!personaIdSif || !telefonoPrincipal || !telefonoSecundario) {
      return res.status(400).json({ error: 'personaIdSif, telefonoPrincipal y telefonoSecundario (2º contacto) son requeridos' });
    }

    if (!['VERDE', 'AMARILLO', 'ROJO'].includes(estadoSemaforo)) {
      return res.status(400).json({ error: 'estadoSemaforo debe ser VERDE, AMARILLO o ROJO' });
    }

    const { rows } = await db.query(
      `UPDATE personas
       SET telefono_principal = $1, telefono_secundario = $2, email_validado = $3, fuente_datos_contacto = $4, estado_contacto_semaforo = $5, fecha_validacion_contacto = NOW(), usuario_validacion_contacto = $6
       WHERE CAST(id_sif AS TEXT) = $7 RETURNING *`,
      [telefonoPrincipal, telefonoSecundario, emailValidado || null, fuenteDatos, estadoSemaforo, req.user?.nombre || 'Sucursal Operativa', personaIdSif]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Persona no encontrada' });
    }

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'Sucursal',
      usuarioRol: req.user?.rol || 'operador',
      accion: `VALIDAR_CONTACTO_SEMAFORO_${estadoSemaforo}`,
      recurso: 'personas',
      recursoId: String(personaIdSif),
      descripcion: `Contacto verificado con semáforo ${estadoSemaforo}. Tel1: ${telefonoPrincipal}, Tel2 (Ref): ${telefonoSecundario}`,
      datosNuevos: rows[0],
    });

    res.json({ mensaje: `Datos de contacto convalidados con semáforo ${estadoSemaforo}`, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getContactoDetalle,
  prevalidarDomicilio,
  validarContacto,
};
