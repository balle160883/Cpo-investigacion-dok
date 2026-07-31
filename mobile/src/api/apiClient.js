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

const PENDING_SURVEYS_KEY = 'cpo_pending_offline_surveys';

export async function getPendingOfflineSurveys() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_SURVEYS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function savePendingOfflineSurvey(id, payload) {
  try {
    const pending = await getPendingOfflineSurveys();
    const existingIndex = pending.findIndex((item) => String(item.id) === String(id));
    const newItem = { id, payload, savedAt: new Date().toISOString() };
    
    if (existingIndex >= 0) {
      pending[existingIndex] = newItem;
    } else {
      pending.push(newItem);
    }
    await AsyncStorage.setItem(PENDING_SURVEYS_KEY, JSON.stringify(pending));
  } catch (e) {
    console.error('Error al guardar encuestas offline:', e);
  }
}

export async function removePendingOfflineSurvey(id) {
  try {
    const pending = await getPendingOfflineSurveys();
    const filtered = pending.filter((item) => String(item.id) !== String(id));
    await AsyncStorage.setItem(PENDING_SURVEYS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error al remover encuesta offline:', e);
  }
}

export async function syncPendingSurveys() {
  const pending = await getPendingOfflineSurveys();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${BASE_URL}/investigaciones/${item.id}/evidencia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(item.payload),
      });

      if (res.ok) {
        await removePendingOfflineSurvey(item.id);
        synced++;
      } else {
        failed++;
      }
    } catch (e) {
      failed++;
    }
  }

  return { synced, failed };
}

export async function guardarEvidenciaInvestigacion(id, payload) {
  try {
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
  } catch (err) {
    if (err.message === 'Network request failed' || err.name === 'TypeError' || err.message?.includes('fetch')) {
      await savePendingOfflineSurvey(id, payload);
      return {
        success: true,
        offline: true,
        message: 'Sin conexión a internet. La visita se guardó localmente y se enviará automáticamente cuando tengas señal.',
      };
    }
    throw err;
  }
}

export async function enviarUbicacionGPS(latitud, longitud, bateria_nivel) {
  try {
    const token = await AsyncStorage.getItem('userToken');
    let userObj = null;
    try {
      const rawUser = await AsyncStorage.getItem('userData');
      if (rawUser) userObj = JSON.parse(rawUser);
    } catch (e) {}

    await fetch(`${BASE_URL}/investigadores/ubicacion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        latitud,
        longitud,
        bateria_nivel,
        investigador_id: userObj?.id || '',
      }),
    });
  } catch (err) {
    console.log('GPS sync background error:', err);
  }
}
