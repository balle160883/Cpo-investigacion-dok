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

    // 3. Asegurar campos de colonia, municipio y estado en direcciones
    await db.query(`
      CREATE TABLE IF NOT EXISTS direcciones (
        id SERIAL PRIMARY KEY,
        id_sif INT,
        persona_id_sif INT,
        calle VARCHAR(255),
        numero_exterior VARCHAR(50),
        numero_interior VARCHAR(50),
        codigo_postal VARCHAR(20),
        colonia VARCHAR(255),
        municipio VARCHAR(255) DEFAULT 'Guadalajara',
        estado_provincia VARCHAR(255) DEFAULT 'Jalisco',
        referencias TEXT,
        latitud DOUBLE PRECISION,
        longitud DOUBLE PRECISION,
        es_principal BOOLEAN DEFAULT TRUE,
        activa BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS colonia VARCHAR(255);
      ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS municipio VARCHAR(255) DEFAULT 'Guadalajara';
      ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS estado_provincia VARCHAR(255) DEFAULT 'Jalisco';
      ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS es_principal BOOLEAN DEFAULT TRUE;
      ALTER TABLE evidencias_visita ADD COLUMN IF NOT EXISTS firma_investigador_url TEXT;
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
