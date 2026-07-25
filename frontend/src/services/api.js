const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function fetchStats() {
  const res = await fetch(`${API_BASE_URL}/stats`);
  if (!res.ok) throw new Error('Error al cargar estadísticas');
  return res.json();
}

export async function fetchInvestigaciones(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE_URL}/investigaciones?${query}`);
  if (!res.ok) throw new Error('Error al cargar investigaciones');
  return res.json();
}

export async function fetchInvestigacionDetalle(id) {
  const res = await fetch(`${API_BASE_URL}/investigaciones/${id}`);
  if (!res.ok) throw new Error('Error al cargar detalle de investigación');
  return res.json();
}

export async function asignarInvestigador(investigacionId, investigadorId) {
  const res = await fetch(`${API_BASE_URL}/investigaciones/${investigacionId}/asignar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ investigador_id: investigadorId }),
  });
  if (!res.ok) throw new Error('Error al asignar investigador');
  return res.json();
}

export async function fetchInvestigadores() {
  const res = await fetch(`${API_BASE_URL}/investigadores`);
  if (!res.ok) throw new Error('Error al cargar investigadores');
  return res.json();
}

export async function fetchUbicacionesInvestigadores() {
  const res = await fetch(`${API_BASE_URL}/investigadores/ubicaciones`);
  if (!res.ok) throw new Error('Error al cargar ubicaciones');
  return res.json();
}
