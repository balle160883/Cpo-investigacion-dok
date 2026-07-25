const { Pool } = require('pg');

const host = process.env.DB_HOST || '31.97.144.6';
const port = parseInt(process.env.DB_PORT || (host === '31.97.144.6' ? '5437' : '5432'));
const password = process.env.DB_PASSWORD || 'Seguridad2028@';

console.log(`🔌 Configurando PostgreSQL Pool -> Host: ${host}, Port: ${port}, DB: postgres`);

const pool = new Pool({
  host,
  port,
  user: process.env.DB_USER || 'postgres',
  password,
  database: process.env.DB_NAME || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Error inesperado en cliente de PostgreSQL pool:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
