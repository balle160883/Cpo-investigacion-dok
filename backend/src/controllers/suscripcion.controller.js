const db = require('../../db');
const { registrarAuditoria } = require('./audit.controller');

// Middleware interno para verificar si el usuario es Super Admin / Admin
function esSuperAdmin(req) {
  const rol = (req.user?.rol || '').toLowerCase();
  return rol === 'superadmin' || rol === 'admin';
}

// Obtener Estado de la Renta Mensual y Suscripción (Solo Super Admin)
async function getSuscripcion(req, res, next) {
  try {
    if (!esSuperAdmin(req)) {
      return res.status(403).json({ error: 'Acceso denegado: El módulo de Renta Mensual es exclusivo para Super Admin.' });
    }

    const { rows: suscripciones } = await db.query(`SELECT * FROM suscripcion_empresa LIMIT 1;`);
    if (suscripciones.length === 0) {
      return res.status(404).json({ error: 'Registro de suscripción no encontrado' });
    }

    const suscripcion = suscripciones[0];

    // Obtener historial de pagos
    const { rows: pagos } = await db.query(
      `SELECT * FROM historial_pagos_suscripcion WHERE suscripcion_id = $1 ORDER BY fecha_pago DESC`,
      [suscripcion.id]
    );

    // Calcular días restantes para el próximo pago
    const fechaCorte = new Date(suscripcion.fecha_proximo_pago);
    const ahora = new Date();
    const difTiempo = fechaCorte.getTime() - ahora.getTime();
    const diasRestantes = Math.ceil(difTiempo / (1000 * 3600 * 24));

    let estadoPago = 'AL_DIA';
    if (diasRestantes <= 0 && Math.abs(diasRestantes) <= (suscripcion.dias_gracia || 5)) {
      estadoPago = 'PROXIMO_A_VENCER';
    } else if (diasRestantes < -(suscripcion.dias_gracia || 5)) {
      estadoPago = 'SUSPENDIDO';
    }

    res.json({
      suscripcion: {
        ...suscripcion,
        dias_restantes: diasRestantes,
        estado_pago_calculado: estadoPago,
      },
      historial_pagos: pagos,
    });
  } catch (err) {
    next(err);
  }
}

// Actualizar Plan o Fecha de Corte de la Renta Mensual (Solo Super Admin)
async function actualizarPlanSuscripcion(req, res, next) {
  try {
    if (!esSuperAdmin(req)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { planNombre, precioMensual, fechaProximoPago, estadoSuscripcion, observaciones } = req.body;

    const { rows } = await db.query(
      `UPDATE suscripcion_empresa
       SET plan_nombre = COALESCE($1, plan_nombre),
           precio_mensual = COALESCE($2, precio_mensual),
           fecha_proximo_pago = COALESCE($3, fecha_proximo_pago),
           estado_suscripcion = COALESCE($4, estado_suscripcion),
           observaciones_renta = COALESCE($5, observaciones_renta),
           updated_at = NOW()
       WHERE id = (SELECT id FROM suscripcion_empresa LIMIT 1)
       RETURNING *`,
      [planNombre, precioMensual, fechaProximoPago, estadoSuscripcion, observaciones]
    );

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'SuperAdmin',
      usuarioRol: req.user?.rol || 'superadmin',
      accion: 'ACTUALIZAR_RENTA_MENSUAL',
      recurso: 'suscripcion_empresa',
      recursoId: String(rows[0].id),
      descripcion: `Plan de renta mensual actualizado. Plan: ${rows[0].plan_nombre}, Precio: $${rows[0].precio_mensual}`,
      datosNuevos: rows[0],
    });

    res.json({ mensaje: 'Suscripción de renta mensual actualizada', data: rows[0] });
  } catch (err) {
    next(err);
  }
}

// Registrar Cobro / Pago de Renta Mensual (Solo Super Admin)
async function registrarPagoRenta(req, res, next) {
  try {
    if (!esSuperAdmin(req)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { monto, metodoPago = 'TRANSFERENCIA', folioFactura, observaciones } = req.body;

    if (!monto) {
      return res.status(400).json({ error: 'El monto de pago es requerido' });
    }

    const { rows: susc } = await db.query(`SELECT id FROM suscripcion_empresa LIMIT 1;`);
    if (susc.length === 0) {
      return res.status(404).json({ error: 'Registro de suscripción no encontrado' });
    }

    const suscId = susc[0].id;

    // Registrar pago
    const { rows: pago } = await db.query(
      `INSERT INTO historial_pagos_suscripcion (suscripcion_id, monto, metodo_pago, folio_factura, observaciones)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [suscId, monto, metodoPago, folioFactura || `FAC-${Date.now()}`, observaciones || 'Pago mensual de renta SaaS']
    );

    // Extender 30 días adicionales la fecha del próximo pago y reactivar suscripción
    const { rows: suscActualizada } = await db.query(
      `UPDATE suscripcion_empresa
       SET fecha_proximo_pago = NOW() + INTERVAL '30 days', estado_suscripcion = 'ACTIVA', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [suscId]
    );

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'SuperAdmin',
      usuarioRol: req.user?.rol || 'superadmin',
      accion: 'REGISTRAR_PAGO_RENTA_MENSUAL',
      recurso: 'historial_pagos_suscripcion',
      recursoId: String(pago[0].id),
      descripcion: `Pago de renta mensual registrado por $${monto}. Folio: ${pago[0].folio_factura}`,
      datosNuevos: { pago: pago[0], suscripcion: suscActualizada[0] },
    });

    res.json({
      mensaje: 'Pago de renta mensual registrado. Fecha de corte extendida 30 días.',
      pago: pago[0],
      suscripcion: suscActualizada[0],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSuscripcion,
  actualizarPlanSuscripcion,
  registrarPagoRenta,
};
