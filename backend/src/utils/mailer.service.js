const nodemailer = require('nodemailer');
const db = require('../../db');

async function getSmtpConfig() {
  try {
    const { rows } = await db.query("SELECT valor FROM configuracion_sistema WHERE clave = 'smtp_config';");
    if (rows.length > 0) {
      return rows[0].valor;
    }
  } catch (e) {
    console.error('Error leyendo smtp_config:', e.message);
  }
  return {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from_email: 'notificaciones@cajaoblatos.com.mx',
    from_name: 'CPO Investigaciones',
    enabled: false,
  };
}

async function sendMail({ to, subject, html }) {
  const config = await getSmtpConfig();

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (e) {
    console.log(`📧 [EMAIL MOCK] Para: ${to} | Asunto: ${subject} (librería nodemailer no instalada)`);
    return { success: true, mock: true, message: 'Correo simulado (nodemailer no instalado)' };
  }

  if (!config.enabled || !config.host || !config.user || !config.pass) {
    console.log(`📧 [EMAIL MOCK / SIMULADO] Para: ${to} | Asunto: ${subject}`);
    console.log(`Contenido del correo:\n${html.substring(0, 300)}...`);
    return { success: true, mock: true, message: 'Correo simulado (SMTP no habilitado o sin credenciales)' };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: Number(config.port) || 587,
    secure: Boolean(config.secure),
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const mailOptions = {
    from: `"${config.from_name || 'CPO Investigaciones'}" <${config.from_email || config.user}>`,
    to,
    subject,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
}

// 1. Envío de Correo de Restablecimiento de Contraseña
async function sendPasswordResetEmail(email, token, nombre = 'Usuario') {
  const resetUrl = `http://localhost:5173/login?resetToken=${token}&email=${encodeURIComponent(email)}`;
  const subject = '🔑 Restablecimiento de Contraseña — CPO Investigaciones';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 24px; rounded-radius: 12px;">
      <h2 style="color: #38bdf8; text-align: center;">Caja Popular Oblatos</h2>
      <hr style="border-color: #334155;" />
      <h3>Hola, ${nombre}</h3>
      <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en la plataforma <strong>CPO Investigaciones</strong>.</p>
      <p>Haz clic en el siguiente botón para definir tu nueva contraseña (enlace válido por 60 minutos):</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          🔑 Restablecer Mi Contraseña
        </a>
      </div>
      <p style="font-size: 12px; color: #94a3b8;">Si no solicitaste este cambio, puedes ignorar este mensaje de forma segura.</p>
      <hr style="border-color: #334155;" />
      <p style="font-size: 11px; color: #64748b; text-align: center;">© 2026 CPO Investigaciones — Todos los derechos reservados.</p>
    </div>
  `;
  return sendMail({ to: email, subject, html });
}

// 2. Notificación a Validador / Analista al Completar Visita en Campo
async function sendInvestigacionCompletadaEmail({ analistaEmail, investigacionId, clienteNombre }) {
  if (!analistaEmail) return;
  const subject = `📌 Investigación #${investigacionId} Completada en Campo — Lista para Validación`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
      <h2 style="color: #10b981; margin-top: 0;">✅ Investigación Lista para Validación</h2>
      <p>Estimado Validador,</p>
      <p>El investigador de campo ha completado la visita domiciliaria para <strong>${clienteNombre}</strong> (Investigación #${investigacionId}).</p>
      <p>Se han adjuntado las coordenadas GPS, fotografías, firmas digitales y estudio socioeconómico.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="http://31.97.144.6:3002/investigaciones/${investigacionId}" style="background-color: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          🔍 Revisar y Dictaminar Formato
        </a>
      </div>
      <p style="font-size: 11px; color: #64748b; text-align: center;">CPO Investigaciones • Caja Popular Oblatos</p>
    </div>
  `;
  return sendMail({ to: analistaEmail, subject, html });
}

// 3. Notificación a Analistas cuando el Validador da Visto Bueno a las Visitas del Crédito
async function sendCreditoValidadoEmail({
  to,
  solicitudFolio,
  clienteNombre,
  sucursalNombre,
  montoSolicitado,
  validadorNombre,
  comentariosValidador,
  investigacionId,
}) {
  if (!to) return;
  const subject = `✅ Visitas Validadas: Crédito ${solicitudFolio || `#${investigacionId}`} — ${clienteNombre || 'Socio'} listo para Aprobación Final`;
  const montoFormat = montoSolicitado ? `$${parseFloat(montoSolicitado).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : 'N/A';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #38bdf8; margin: 0;">Caja Popular Oblatos</h2>
        <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0;">Sistema de Gestión de Investigaciones Domiciliarias</p>
      </div>
      <hr style="border-color: #334155; margin-bottom: 20px;" />
      <div style="background-color: rgba(5, 150, 105, 0.15); border-left: 4px solid #10b981; padding: 14px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="color: #10b981; margin: 0 0 6px 0; font-size: 16px;">✅ Visitas Domiciliarias Validadas con Visto Bueno</h3>
        <p style="margin: 0; font-size: 13px; color: #e2e8f0;">
          El Validador de Crédito <strong>${validadorNombre || 'Validador Autorizado'}</strong> ha otorgado el Visto Bueno formal a las investigaciones de este crédito. El expediente está listo para su <strong>Aprobación Final</strong>.
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
        <tr>
          <td style="padding: 8px; color: #94a3b8; border-bottom: 1px solid #1e293b; width: 40%;"><strong>Folio de Crédito:</strong></td>
          <td style="padding: 8px; color: #ffffff; border-bottom: 1px solid #1e293b; font-weight: bold;">${solicitudFolio || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; color: #94a3b8; border-bottom: 1px solid #1e293b;"><strong>Socio / Acreditado:</strong></td>
          <td style="padding: 8px; color: #ffffff; border-bottom: 1px solid #1e293b; font-weight: bold;">${clienteNombre || 'Socio CPO'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; color: #94a3b8; border-bottom: 1px solid #1e293b;"><strong>Sucursal de Captación:</strong></td>
          <td style="padding: 8px; color: #ffffff; border-bottom: 1px solid #1e293b;">${sucursalNombre || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; color: #94a3b8; border-bottom: 1px solid #1e293b;"><strong>Monto Solicitado:</strong></td>
          <td style="padding: 8px; color: #38bdf8; border-bottom: 1px solid #1e293b; font-weight: bold;">${montoFormat}</td>
        </tr>
        <tr>
          <td style="padding: 8px; color: #94a3b8; border-bottom: 1px solid #1e293b;"><strong>Dictamen del Validador:</strong></td>
          <td style="padding: 8px; color: #a7f3d0; border-bottom: 1px solid #1e293b; font-style: italic;">"${comentariosValidador || 'Estudio validado sin observaciones adicionales.'}"</td>
        </tr>
      </table>

      <div style="text-align: center; margin: 26px 0;">
        <a href="http://31.97.144.6:3002/investigaciones/${investigacionId}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 13px;">
          🔍 Abrir Expediente para Aprobación Final
        </a>
      </div>

      <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 24px;">
        Notificación automática emitida por la plataforma CPO Investigaciones • Caja Popular Oblatos
      </p>
    </div>
  `;
  return sendMail({ to, subject, html });
}

module.exports = {
  getSmtpConfig,
  sendMail,
  sendPasswordResetEmail,
  sendInvestigacionCompletadaEmail,
  sendCreditoValidadoEmail,
};
