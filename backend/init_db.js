const db = require('./db');

async function initDb() {
  try {
    console.log('Verificando y preparando esquema de base de datos...');
    
    // 1. Tabla de Investigadores / Usuarios
    await db.query(`
      CREATE TABLE IF NOT EXISTS investigadores (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL DEFAULT '123456',
        telefono VARCHAR(50),
        rol VARCHAR(50) DEFAULT 'investigador', -- 'admin', 'supervisor', 'investigador'
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Ensure password column exists if created previously without it
    await db.query(`
      ALTER TABLE investigadores ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT '123456';
      ALTER TABLE investigadores ADD COLUMN IF NOT EXISTS rol VARCHAR(50) DEFAULT 'investigador';
    `);

    // 2. Tabla de Rastreo GPS en Tiempo Real de Investigadores
    await db.query(`
      CREATE TABLE IF NOT EXISTS ubicaciones_investigadores (
        id SERIAL PRIMARY KEY,
        investigador_id INT REFERENCES investigadores(id),
        latitud DOUBLE PRECISION NOT NULL,
        longitud DOUBLE PRECISION NOT NULL,
        bateria_nivel INT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Seed default admin and investigators if empty
    const { rows: existingInvestigadores } = await db.query('SELECT count(*) FROM investigadores;');
    if (parseInt(existingInvestigadores[0].count) === 0) {
      console.log('Sembrando usuarios iniciales...');
      await db.query(`
        INSERT INTO investigadores (nombre, email, password, telefono, rol) VALUES
        ('Administrador CPO', 'admin@cajaoblatos.com.mx', 'admin123', '3300000000', 'admin'),
        ('Carlos Mendoza (Investigador 1)', 'carlos.mendoza@cajaoblatos.com.mx', '123456', '3312345678', 'investigador'),
        ('Elena Torres (Investigadora 2)', 'elena.torres@cajaoblatos.com.mx', '123456', '3387654321', 'investigador');
      `);
    }

    console.log('✅ Esquema inicializado correctamente.');
  } catch (err) {
    console.error('Error inicializando base de datos:', err);
  }
}

module.exports = initDb;
