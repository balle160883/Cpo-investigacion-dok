const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '31.97.144.6',
  port: parseInt(process.env.DB_PORT || '5437'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Seguridad2028@',
  database: process.env.DB_NAME || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
