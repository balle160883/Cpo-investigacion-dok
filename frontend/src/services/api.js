export const getApiBaseUrl = () => {
  if (import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return `http://${window.location.hostname}:4002/api`;
  }
  return 'http://localhost:4002/api';
};

const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? (localStorage.getItem('cpo_token') || localStorage.getItem('userToken')) : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

async function handleResponse(res, errorMessage) {
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cpo:unauthorized'));
    }
    throw new Error('Sesión expirada o token inválido');
  }
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorMessage || 'Error en la petición');
  }
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${getApiBaseUrl()}/stats`, { headers: getAuthHeaders() });
  return handleResponse(res, 'Error al cargar estadísticas');
}

export async function fetchInvestigaciones(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${getApiBaseUrl()}/investigaciones?${query}`, { headers: getAuthHeaders() });
  return handleResponse(res, 'Error al cargar investigaciones');
}

export async function fetchInvestigacionDetalle(id) {
  const res = await fetch(`${getApiBaseUrl()}/investigaciones/${id}`, { headers: getAuthHeaders() });
  return handleResponse(res, 'Error al cargar detalle de investigación');
}

export async function asignarInvestigador(investigacionId, investigadorId) {
  const res = await fetch(`${getApiBaseUrl()}/investigaciones/${investigacionId}/asignar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ investigador_id: investigadorId }),
  });
  return handleResponse(res, 'Error al asignar investigador');
}

export async function fetchInvestigadores() {
  const res = await fetch(`${getApiBaseUrl()}/investigadores`, { headers: getAuthHeaders() });
  return handleResponse(res, 'Error al cargar investigadores');
}

export async function fetchUbicacionesInvestigadores() {
  const res = await fetch(`${getApiBaseUrl()}/investigadores/ubicaciones`, { headers: getAuthHeaders() });
  return handleResponse(res, 'Error al cargar ubicaciones');
}

export async function fetchProductividadInvestigadores() {
  const res = await fetch(`${getApiBaseUrl()}/stats/productividad`, { headers: getAuthHeaders() });
  return handleResponse(res, 'Error al cargar productividad de investigadores');
}

export async function fetchAuditLog(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${getApiBaseUrl()}/audit?${qs}`, { headers: getAuthHeaders() });
  return handleResponse(res, 'Error al cargar bitácora de auditoría');
}

export async function fetchAuditAcciones() {
  const res = await fetch(`${getApiBaseUrl()}/audit/acciones`, { headers: getAuthHeaders() });
  return handleResponse(res, 'Error al cargar tipos de acciones');
}

export async function validarInvestigacion(investigacionId, { accion, comentarios }) {
  const res = await fetch(`${getApiBaseUrl()}/investigaciones/${investigacionId}/validar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ accion, comentarios }),
  });
  return handleResponse(res, 'Error al validar investigación');
}

export async function revalidarInvestigacion(investigacionId, { accion, comentarios }) {
  const res = await fetch(`${getApiBaseUrl()}/investigaciones/${investigacionId}/revalidar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ accion, comentarios }),
  });
  return handleResponse(res, 'Error al revalidar investigación');
}

export async function fetchChecklistDocumental(solicitudId, tipoCredito = 'GENERAL') {
  const res = await fetch(`${getApiBaseUrl()}/documentos/checklist/${solicitudId}?tipoCredito=${tipoCredito}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Error al cargar checklist documental');
}

export async function cargarDocumentoExpediente(data) {
  const res = await fetch(`${getApiBaseUrl()}/documentos/cargar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Error al cargar documento');
}

export async function validarDocumentoExpediente(docId, { estadoValidacion, observaciones, esLegible }) {
  const res = await fetch(`${getApiBaseUrl()}/documentos/${docId}/validar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ estadoValidacion, observaciones, esLegible }),
  });
  return handleResponse(res, 'Error al validar documento');
}

export async function registrarExcepcionDocumental(data) {
  const res = await fetch(`${getApiBaseUrl()}/documentos/excepcion`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Error al registrar excepción documental');
}

export async function fetchNotificacionesSolicitud(solicitudId) {
  const res = await fetch(`${getApiBaseUrl()}/notificaciones/solicitud/${solicitudId}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Error al cargar notificaciones interáreas');
}

export async function enviarNotificacionInterareas(data) {
  const res = await fetch(`${getApiBaseUrl()}/notificaciones/enviar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Error al enviar notificación');
}

export async function registrarAcuseLecturaNotificacion(id) {
  const res = await fetch(`${getApiBaseUrl()}/notificaciones/${id}/acuse`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Error al registrar acuse de lectura');
}

export async function marcarRequerimientoAtendidoApi(id, respuestaAtencion) {
  const res = await fetch(`${getApiBaseUrl()}/notificaciones/${id}/atender`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ respuestaAtencion }),
  });
  return handleResponse(res, 'Error al marcar requerimiento como atendido');
}

export async function fetchAgendaVisitas(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${getApiBaseUrl()}/agenda?${qs}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Error al cargar agenda de visitas');
}

export async function programarOReagendarVisitaApi(data) {
  const res = await fetch(`${getApiBaseUrl()}/agenda/programar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Error al programar/reagendar visita');
}

export async function checkinVisitaCampoApi(data) {
  const res = await fetch(`${getApiBaseUrl()}/agenda/checkin`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Error al realizar check-in');
}

export async function checkoutVisitaCampoApi(data) {
  const res = await fetch(`${getApiBaseUrl()}/agenda/checkout`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Error al realizar check-out');
}

export async function fetchContactoDetalle(personaIdSif) {
  const res = await fetch(`${getApiBaseUrl()}/contactos/persona/${personaIdSif}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, 'Error al cargar datos de contacto');
}

export async function prevalidarDomicilioApi(data) {
  const res = await fetch(`${getApiBaseUrl()}/contactos/prevalidar-domicilio`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Error al prevalidar domicilio');
}

export async function validarContactoApi(data) {
  const res = await fetch(`${getApiBaseUrl()}/contactos/validar-contacto`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(res, 'Error al validar contacto');
}
