const db = require('../../db');
const { registrarAuditoria } = require('./audit.controller');
const { sendMail } = require('../utils/mailer.service');

// Obtener Configuración SMTP e Interruptores de Correo
async function getConfiguracionCorreo(req, res, next) {
  try {
    const { rows: smtpRows } = await db.query("SELECT valor FROM configuracion_sistema WHERE clave = 'smtp_config';");
    const { rows: triggerRows } = await db.query("SELECT valor FROM configuracion_sistema WHERE clave = 'email_triggers';");

    const smtpConfig = smtpRows.length > 0 ? smtpRows[0].valor : {};
    const emailTriggers = triggerRows.length > 0 ? triggerRows[0].valor : {};

    // Ocultar la contraseña por seguridad al retornar al frontend si no es admin
    const safeSmtpConfig = { ...smtpConfig };
    if (safeSmtpConfig.pass) {
      safeSmtpConfig.pass_configurada = true;
      safeSmtpConfig.pass = '********';
    }

    res.json({
      smtp_config: safeSmtpConfig,
      email_triggers: emailTriggers,
    });
  } catch (err) {
    next(err);
  }
}

// Guardar Configuración SMTP e Interruptores
async function guardarConfiguracionCorreo(req, res, next) {
  try {
    const { smtpConfig, emailTriggers } = req.body;

    if (smtpConfig) {
      // Si la contraseña vino enmascarada '********', conservar la existente en DB
      if (smtpConfig.pass === '********') {
        const { rows: current } = await db.query("SELECT valor FROM configuracion_sistema WHERE clave = 'smtp_config';");
        if (current.length > 0 && current[0].valor.pass) {
          smtpConfig.pass = current[0].valor.pass;
        }
      }

      await db.query(
        `INSERT INTO configuracion_sistema (clave, valor, descripcion)
         VALUES ('smtp_config', $1, 'Configuración SMTP')
         ON CONFLICT (clave) DO UPDATE SET valor = $1, updated_at = NOW()`,
        [JSON.stringify(smtpConfig)]
      );
    }

    if (emailTriggers) {
      await db.query(
        `INSERT INTO configuracion_sistema (clave, valor, descripcion)
         VALUES ('email_triggers', $1, 'Interruptores de notificaciones')
         ON CONFLICT (clave) DO UPDATE SET valor = $1, updated_at = NOW()`,
        [JSON.stringify(emailTriggers)]
      );
    }

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'Administrador',
      usuarioRol: req.user?.rol || 'admin',
      accion: 'GUARDAR_CONFIGURACION_CORREO',
      recurso: 'configuracion_sistema',
      recursoId: 'smtp_config',
      descripcion: 'Actualizada la configuración del servidor de correo SMTP e interruptores de notificación.',
    });

    res.json({ mensaje: 'Configuración de correo guardada exitosamente' });
  } catch (err) {
    next(err);
  }
}

// Enviar Correo de Prueba SMTP
async function probarConexionCorreo(req, res, next) {
  try {
    const { emailDestino } = req.body;
    const to = emailDestino || req.user?.email || 'admin@cajaoblatos.com.mx';

    const mailResult = await sendMail({
      to,
      subject: '🧪 Correo de Prueba — CPO Investigaciones',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc; border-radius: 8px;">
          <h2 style="color: #38bdf8;">✅ Prueba de Conexión SMTP Exitosa</h2>
          <p>Este es un correo de prueba generado desde la plataforma <strong>CPO Investigaciones</strong> para validar la configuración de tu servidor SMTP.</p>
          <p style="color: #94a3b8; font-size: 12px;">Enviado a: ${to} en fecha ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    res.json({
      mensaje: mailResult.mock ? 'Servidor de correo no configurado (Envío Simulado Exitoso)' : 'Correo de prueba enviado con éxito',
      simulado: !!mailResult.mock,
      detalles: mailResult.messageId || mailResult.message,
    });
  } catch (err) {
    next(err);
  }
}

// Helper Super Admin
function esSuperAdmin(req) {
  const rol = (req.user?.rol || '').toLowerCase();
  return rol === 'superadmin' || rol === 'admin';
}

// Obtener Configuración WhatsApp API (Exclusivo Super Admin)
async function getConfiguracionWhatsApp(req, res, next) {
  try {
    if (!esSuperAdmin(req)) {
      return res.status(403).json({ error: 'Acceso denegado: La configuración de WhatsApp es exclusiva para Super Admin.' });
    }

    const { rows } = await db.query("SELECT valor FROM configuracion_sistema WHERE clave = 'whatsapp_config';");
    const defaultConfig = {
      enabled: false,
      provider: 'META_CLOUD',
      phone_number_id: '109823749827349',
      token: '',
      sender_phone: '+523312345678',
      template_name: 'cpo_notificacion_visita',
    };

    const config = rows.length > 0 ? { ...defaultConfig, ...rows[0].valor } : defaultConfig;

    const safeConfig = { ...config };
    if (safeConfig.token) {
      safeConfig.token_configurado = true;
      safeConfig.token = '********';
    }

    res.json({ whatsapp_config: safeConfig });
  } catch (err) {
    next(err);
  }
}

// Guardar Configuración WhatsApp API (Exclusivo Super Admin)
async function guardarConfiguracionWhatsApp(req, res, next) {
  try {
    if (!esSuperAdmin(req)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { whatsappConfig } = req.body;
    if (whatsappConfig) {
      if (whatsappConfig.token === '********') {
        const { rows: current } = await db.query("SELECT valor FROM configuracion_sistema WHERE clave = 'whatsapp_config';");
        if (current.length > 0 && current[0].valor.token) {
          whatsappConfig.token = current[0].valor.token;
        }
      }

      await db.query(
        `INSERT INTO configuracion_sistema (clave, valor, descripcion)
         VALUES ('whatsapp_config', $1, 'Configuración WhatsApp API')
         ON CONFLICT (clave) DO UPDATE SET valor = $1, updated_at = NOW()`,
        [JSON.stringify(whatsappConfig)]
      );
    }

    await registrarAuditoria({
      usuarioId: req.user?.id,
      usuarioNombre: req.user?.nombre || 'SuperAdmin',
      usuarioRol: req.user?.rol || 'superadmin',
      accion: 'GUARDAR_CONFIGURACION_WHATSAPP',
      recurso: 'configuracion_sistema',
      recursoId: 'whatsapp_config',
      descripcion: 'Actualizada la configuración de la integración de WhatsApp Business API.',
    });

    res.json({ mensaje: 'Configuración de WhatsApp guardada exitosamente' });
  } catch (err) {
    next(err);
  }
}

// Probar Envío de WhatsApp en Vivo (Exclusivo Super Admin)
async function probarConexionWhatsApp(req, res, next) {
  try {
    if (!esSuperAdmin(req)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { telefonoDestino } = req.body;
    const { sendTestWhatsApp } = require('../utils/whatsapp.service');

    const result = await sendTestWhatsApp(telefonoDestino || '+523312345678');

    res.json({
      mensaje: result.mock ? 'WhatsApp no configurado (Envío Simulado Registrado)' : 'Mensaje de WhatsApp enviado exitosamente',
      simulado: !!result.mock,
      detalles: result.messageId || result.message || result.error,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getConfiguracionCorreo,
  guardarConfiguracionCorreo,
  probarConexionCorreo,
  getConfiguracionWhatsApp,
  guardarConfiguracionWhatsApp,
  probarConexionWhatsApp,
};
