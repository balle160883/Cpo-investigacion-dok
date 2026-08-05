const db = require('../../db');

async function getWhatsAppConfig() {
  try {
    const { rows } = await db.query("SELECT valor FROM configuracion_sistema WHERE clave = 'whatsapp_config';");
    if (rows.length > 0) {
      return rows[0].valor;
    }
  } catch (e) {
    console.error('Error leyendo whatsapp_config:', e.message);
  }
  return {
    enabled: false,
    provider: 'META_CLOUD',
    phone_number_id: '',
    token: '',
    sender_phone: '+523312345678',
    template_name: 'cpo_notificacion_visita',
  };
}

async function sendWhatsAppMessage({ toPhone, messageText }) {
  const config = await getWhatsAppConfig();

  const formattedPhone = (toPhone || '').replace(/\D/g, '');

  if (!config.enabled || !config.token || !config.phone_number_id) {
    console.log(`💬 [WHATSAPP MOCK / SIMULADO] Para: +${formattedPhone} | Mensaje: "${messageText}"`);
    return {
      success: true,
      mock: true,
      message: 'Mensaje de WhatsApp simulado (API no habilitada o sin token de Meta)',
    };
  }

  // Intento de envío real vía Meta Cloud API
  try {
    const url = `https://graph.facebook.com/v19.0/${config.phone_number_id}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: { body: messageText },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error al comunicarse con Meta Cloud API');
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error('Error enviando WhatsApp vía Meta Cloud API:', err.message);
    // Retornar respuesta descriptiva sin tumbar el proceso
    return { success: false, error: err.message, mock: true };
  }
}

async function sendTestWhatsApp(toPhone = '+523312345678') {
  const text = `🧪 *Prueba de Integración WhatsApp API — CPO Investigaciones*\n\nEste es un mensaje de prueba generado desde el Panel de Ajustes por el Super Admin.\n\nFecha: ${new Date().toLocaleString()}`;
  return sendWhatsAppMessage({ toPhone, messageText: text });
}

module.exports = {
  getWhatsAppConfig,
  sendWhatsAppMessage,
  sendTestWhatsApp,
};
