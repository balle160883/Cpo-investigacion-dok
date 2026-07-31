import AsyncStorage from '@react-native-async-storage/async-storage';

// Default API URL pointing to server or local host
const BASE_URL = 'http://31.97.144.6:4002/api';

// Memoria caché en ejecución para eliminar condiciones de carrera con AsyncStorage
let inMemoryToken = null;
let inMemoryUser = null;

async function getToken() {
  if (inMemoryToken) return inMemoryToken;
  try {
    const t = await AsyncStorage.getItem('userToken');
    if (t) {
      inMemoryToken = t;
      return t;
    }
  } catch (e) {}
  return null;
}

async function getUser() {
  if (inMemoryUser) return inMemoryUser;
  try {
    const raw = await AsyncStorage.getItem('userData');
    if (raw) {
      const u = JSON.parse(raw);
      inMemoryUser = u;
      return u;
    }
  } catch (e) {}
  return null;
}

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
      inMemoryToken = data.token;
      inMemoryUser = data.user;
      await Promise.all([
        AsyncStorage.setItem('userToken', data.token),
        AsyncStorage.setItem('userData', JSON.stringify(data.user)),
      ]);
    }
    return data;
  } catch (err) {
    if (err.message === 'Network request failed' || err.name === 'TypeError') {
      throw new Error(
        `Error de red al conectar con el servidor (http://31.97.144.6:4002). Por favor verifica tu conexión a internet.`
      );
    }
    throw err;
  }
}

export async function getAssignedInvestigaciones(investigadorId) {
  const token = await getToken();
  let realId =
    investigadorId && investigadorId !== 'undefined' && investigadorId !== 'null'
      ? investigadorId
      : null;

  if (!realId) {
    const u = await getUser();
    if (u && u.id && u.id !== 'undefined' && u.id !== 'null') {
      realId = u.id;
    }
  }

  const queryParam = realId ? `?investigador_id=${encodeURIComponent(realId)}` : '';
  const res = await fetch(`${BASE_URL}/investigaciones${queryParam}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 401 || res.status === 403) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'SESION_EXPIRADA');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error del servidor (${res.status}) al cargar asignaciones`);
  }

  return res.json();
}

export async function getInvestigacionDetalle(id) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/investigaciones/${id}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error('Error al obtener detalle de la investigación');
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
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/investigaciones/${item.id}/evidencia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
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
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/investigaciones/${id}/evidencia`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar captura');
    return data;
  } catch (err) {
    if (
      err.message === 'Network request failed' ||
      err.name === 'TypeError' ||
      err.message?.includes('fetch')
    ) {
      await savePendingOfflineSurvey(id, payload);
      return {
        success: true,
        offline: true,
        message:
          'Sin conexión a internet. La visita se guardó localmente y se enviará automáticamente cuando tengas señal.',
      };
    }
    throw err;
  }
}

export async function enviarUbicacionGPS(latitud, longitud, bateria_nivel) {
  try {
    const token = await getToken();
    const userObj = await getUser();

    await fetch(`${BASE_URL}/investigadores/ubicacion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        investigador_id: userObj?.id || null,
        latitud,
        longitud,
        bateria_nivel: bateria_nivel || 100,
      }),
    });
  } catch (err) {
    // Falla silenciosa de rastreo GPS en segundo plano
  }
}
