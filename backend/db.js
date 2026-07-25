const { Pool } = require('pg');

let currentHost = process.env.DB_HOST || '31.97.144.6';
let currentPort = parseInt(process.env.DB_PORT || '5437');
let currentPassword = process.env.DB_PASSWORD || 'Seguridad2028@';

// Prevent EAI_AGAIN DNS resolution issues on internal Dokploy network names
if (currentHost.includes('investigacion-postgres') || currentHost === 'localhost' || currentHost === '127.0.0.1') {
  currentHost = '31.97.144.6';
  currentPort = 5437;
}

console.log(`🔌 Conectando a PostgreSQL -> Host: ${currentHost}:${currentPort}, DB: postgres`);

const pool = new Pool({
  host: currentHost,
  port: currentPort,
  user: process.env.DB_USER || 'postgres',
  password: currentPassword,
  database: process.env.DB_NAME || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Error en pool de PostgreSQL:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
