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

export async function fetchStats() {
  const res = await fetch(`${getApiBaseUrl()}/stats`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Error al cargar estadísticas');
  return res.json();
}

export async function fetchInvestigaciones(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${getApiBaseUrl()}/investigaciones?${query}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Error al cargar investigaciones');
  return res.json();
}

export async function fetchInvestigacionDetalle(id) {
  const res = await fetch(`${getApiBaseUrl()}/investigaciones/${id}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Error al cargar detalle de investigación');
  return res.json();
}

export async function asignarInvestigador(investigacionId, investigadorId) {
  const res = await fetch(`${getApiBaseUrl()}/investigaciones/${investigacionId}/asignar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ investigador_id: investigadorId }),
  });
  if (!res.ok) throw new Error('Error al asignar investigador');
  return res.json();
}

export async function fetchInvestigadores() {
  const res = await fetch(`${getApiBaseUrl()}/investigadores`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Error al cargar investigadores');
  return res.json();
}

export async function fetchUbicacionesInvestigadores() {
  const res = await fetch(`${getApiBaseUrl()}/investigadores/ubicaciones`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Error al cargar ubicaciones');
  return res.json();
}
