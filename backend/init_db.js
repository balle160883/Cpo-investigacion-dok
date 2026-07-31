const db = require('./db');
const bcrypt = require('bcryptjs');

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
        rol VARCHAR(50) DEFAULT 'investigador',
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 2. Tabla de Direcciones
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
    `);

    // 3. Tabla de Evidencias de Visita
    await db.query(`
      CREATE TABLE IF NOT EXISTS evidencias_visita (
        id SERIAL PRIMARY KEY,
        investigacion_id_sif INT,
        latitud_checkin DOUBLE PRECISION,
        longitud_checkin DOUBLE PRECISION,
        fecha_checkin TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        estudio_socioeconomico JSONB,
        fotos_urls JSONB,
        firma_url TEXT,
        firma_investigador_url TEXT,
        notas_investigador TEXT,
        sincronizado_a_sif BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 4. Tabla de Ubicaciones en Tiempo Real de Investigadores
    await db.query(`
      CREATE TABLE IF NOT EXISTS ubicaciones_investigadores (
        id SERIAL PRIMARY KEY,
        investigador_id INT,
        latitud DOUBLE PRECISION,
        longitud DOUBLE PRECISION,
        bateria_nivel INT DEFAULT 100,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 5. Bitácora de Auditoría Inalterable (Audit Log)
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id BIGSERIAL PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        usuario_id INT,
        usuario_nombre VARCHAR(255),
        usuario_rol VARCHAR(50),
        accion VARCHAR(100) NOT NULL,
        recurso VARCHAR(100),
        recurso_id VARCHAR(100),
        descripcion TEXT,
        ip_origen VARCHAR(50),
        user_agent TEXT,
        datos_anteriores JSONB,
        datos_nuevos JSONB,
        resultado VARCHAR(20) DEFAULT 'exito'
      );
    `);

    // Índices para consultas por usuario y por fecha en audit_log
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_usuario ON audit_log(usuario_id);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_accion ON audit_log(accion);`); } catch (e) {}

    // Alteraciones seguras
    try { await db.query(`ALTER TABLE investigadores ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT '123456';`); } catch (e) {}
    try { await db.query(`ALTER TABLE investigadores ADD COLUMN IF NOT EXISTS rol VARCHAR(50) DEFAULT 'investigador';`); } catch (e) {}
    try { await db.query(`ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS colonia VARCHAR(255);`); } catch (e) {}
    try { await db.query(`ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS municipio VARCHAR(255) DEFAULT 'Guadalajara';`); } catch (e) {}
    try { await db.query(`ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS estado_provincia VARCHAR(255) DEFAULT 'Jalisco';`); } catch (e) {}
    try { await db.query(`ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS es_principal BOOLEAN DEFAULT TRUE;`); } catch (e) {}
    try { await db.query(`ALTER TABLE evidencias_visita ADD COLUMN IF NOT EXISTS firma_investigador_url TEXT;`); } catch (e) {}

    // Seed default admin and investigators if empty
    const { rows: existingInvestigadores } = await db.query('SELECT count(*) FROM investigadores;');
    if (parseInt(existingInvestigadores[0].count) === 0) {
      console.log('Sembrando usuarios iniciales con contraseñas cifradas...');
      const adminPass = await bcrypt.hash('admin123', 10);
      const userPass = await bcrypt.hash('123456', 10);

      await db.query(`
        INSERT INTO investigadores (nombre, email, password, telefono, rol) VALUES
        ($1, $2, $3, $4, $5),
        ($6, $7, $8, $9, $10),
        ($11, $12, $13, $14, $15);
      `, [
        'Administrador CPO', 'admin@cajaoblatos.com.mx', adminPass, '3300000000', 'admin',
        'Carlos Mendoza (Investigador 1)', 'carlos.mendoza@cajaoblatos.com.mx', userPass, '3312345678', 'investigador',
        'Elena Torres (Investigadora 2)', 'elena.torres@cajaoblatos.com.mx', userPass, '3387654321', 'investigador'
      ]);
    }

    console.log('✅ Esquema inicializado correctamente.');
  } catch (err) {
    console.error('Error inicializando base de datos:', err);
  }
}

module.exports = initDb;
