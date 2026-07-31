/**
 * Cliente Redis para caché en memoria de CPO Investigaciones
 * Cachea estadísticas del dashboard y datos repetitivos para respuesta < 50ms
 */
const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

let client = null;
let connected = false;

async function getRedisClient() {
  if (client && connected) return client;

  try {
    client = createClient({ url: REDIS_URL });

    client.on('error', (err) => {
      console.warn('[REDIS] Error de conexión:', err.message);
      connected = false;
    });

    client.on('connect', () => {
      console.log('[REDIS] ✅ Caché en memoria conectado:', REDIS_URL);
      connected = true;
    });

    client.on('end', () => {
      connected = false;
    });

    await client.connect();
  } catch (err) {
    console.warn('[REDIS] No disponible, se omite caché:', err.message);
    client = null;
    connected = false;
  }

  return client;
}

/**
 * Obtener valor del caché
 * @param {string} key
 * @returns {any|null}
 */
async function cacheGet(key) {
  try {
    const c = await getRedisClient();
    if (!c) return null;
    const val = await c.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

/**
 * Guardar valor en caché con TTL en segundos
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 */
async function cacheSet(key, value, ttlSeconds = 60) {
  try {
    const c = await getRedisClient();
    if (!c) return;
    await c.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Falla silenciosamente si Redis no está disponible
  }
}

/**
 * Invalidar una clave del caché
 * @param {string} key
 */
async function cacheDel(key) {
  try {
    const c = await getRedisClient();
    if (!c) return;
    await c.del(key);
  } catch {}
}

module.exports = { cacheGet, cacheSet, cacheDel };
