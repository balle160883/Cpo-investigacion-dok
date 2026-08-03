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
