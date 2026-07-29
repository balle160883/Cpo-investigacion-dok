import AsyncStorage from '@react-native-async-storage/async-storage';

// Default API URL pointing to server or local host
const BASE_URL = 'http://31.97.144.6:4002/api';

export async function login(email, password) {
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    
    if (data.token) {
      await AsyncStorage.setItem('userToken', data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));
    }
    return data;
  } catch (err) {
    if (err.message === 'Network request failed' || err.name === 'TypeError') {
      throw new Error(`Error de red al conectar con el servidor (http://31.97.144.6:4002). Por favor verifica que tu dispositivo tenga acceso a internet.`);
    }
    throw err;
  }
}

export async function getAssignedInvestigaciones(investigadorId) {
  const token = await AsyncStorage.getItem('userToken');
  let realId = investigadorId;
  if (!realId) {
    try {
      const rawUser = await AsyncStorage.getItem('userData');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        realId = u.id;
      }
    } catch (e) {}
  }
  const res = await fetch(`${BASE_URL}/investigaciones?investigador_id=${realId || ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Error al cargar asignaciones');
  return res.json();
}

export async function getInvestigacionDetalle(id) {
  const res = await fetch(`${BASE_URL}/investigaciones/${id}`);
  if (!res.ok) throw new Error('Error al obtener detalle');
  return res.json();
}

export async function guardarEvidenciaInvestigacion(id, payload) {
  const token = await AsyncStorage.getItem('userToken');
  const res = await fetch(`${BASE_URL}/investigaciones/${id}/evidencia`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al guardar captura');
  return data;
}

export async function enviarUbicacionGPS(latitud, longitud, bateria_nivel) {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) return;
    await fetch(`${BASE_URL}/investigadores/ubicacion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ latitud, longitud, bateria_nivel }),
    });
  } catch (err) {
    console.log('GPS sync background error:', err);
  }
}
