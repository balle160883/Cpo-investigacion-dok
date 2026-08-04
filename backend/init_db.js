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

    // Actualización automática de rol para Norma Lizette Bermejo Palos
    try {
      await db.query(`
        UPDATE investigadores
        SET rol = 'analista'
        WHERE UPPER(nombre) LIKE '%NORMA%' 
           OR UPPER(nombre) LIKE '%BERMEJO%'
           OR UPPER(nombre) LIKE '%PALOS%'
           OR UPPER(email) LIKE '%NORMA%'
           OR UPPER(email) LIKE '%BERMEJO%';
      `);
    } catch (e) {}

    // 6. Catálogo de Documentos Requeridos por Tipo de Crédito (Checklist Inteligente)
    await db.query(`
      CREATE TABLE IF NOT EXISTS catalogo_documentos_credito (
        id SERIAL PRIMARY KEY,
        tipo_credito VARCHAR(50) DEFAULT 'GENERAL', -- 'GENERAL', 'CONSUMO', 'COMERCIAL', 'VIVIENDA'
        nombre_documento VARCHAR(255) NOT NULL,
        codigo_documento VARCHAR(100) UNIQUE NOT NULL,
        descripcion TEXT,
        obligatorio BOOLEAN DEFAULT TRUE,
        es_activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 7. Expediente Digital de Documentos por Solicitud de Crédito
    await db.query(`
      CREATE TABLE IF NOT EXISTS expediente_documentos (
        id SERIAL PRIMARY KEY,
        solicitud_id_sif VARCHAR(100) NOT NULL,
        documento_codigo VARCHAR(100) NOT NULL,
        nombre_archivo VARCHAR(255),
        archivo_url TEXT,
        formato_archivo VARCHAR(50),
        es_legible BOOLEAN DEFAULT TRUE,
        estado_validacion VARCHAR(50) DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'APROBADO', 'RECHAZADO', 'EXCEPCION'
        observaciones_analista TEXT,
        es_excepcion BOOLEAN DEFAULT FALSE,
        justificacion_excepcion TEXT,
        usuario_carga VARCHAR(255),
        fecha_carga TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        usuario_validador VARCHAR(255),
        fecha_validacion TIMESTAMP WITH TIME ZONE
      );
    `);

    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_expediente_solicitud ON expediente_documentos(solicitud_id_sif);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_expediente_doc ON expediente_documentos(documento_codigo);`); } catch (e) {}

    // Sembrar catálogo inicial de documentos por tipo de crédito si está vacío
    const { rows: existingDocs } = await db.query('SELECT count(*) FROM catalogo_documentos_credito;');
    if (parseInt(existingDocs[0].count) === 0) {
      console.log('Sembrando catálogo de documentos requeridos...');
      await db.query(`
        INSERT INTO catalogo_documentos_credito (tipo_credito, codigo_documento, nombre_documento, descripcion, obligatorio) VALUES
        ('GENERAL', 'INE_OFICIAL', 'Identificación Oficial Vigente (INE/Pasaporte)', 'Copia clara legible por ambos lados', TRUE),
        ('GENERAL', 'COMPROBANTE_DOMICILIO', 'Comprobante de Domicilio (Agua/Luz/Predial)', 'No mayor a 3 meses de antigüedad', TRUE),
        ('GENERAL', 'SOLICITUD_FIRMADA', 'Solicitud de Crédito Firmada por el Solicitante', 'Formato F001 con firmas autógrafas', TRUE),
        ('GENERAL', 'CURP_SOCIO', 'Constancia de CURP o RFC', 'Documento oficial SAT o RENAPO', FALSE),
        ('CONSUMO', 'COMPROBANTE_INGRESOS', 'Comprobante de Ingresos (Recibos de Nómina/Estados de Cuenta)', 'Últimos 2 meses completos', TRUE),
        ('COMERCIAL', 'ACTA_CONSTITUTIVA', 'Acta Constitutiva / Registro de Negocio', 'Para personas morales o actividades empresariales', TRUE),
        ('COMERCIAL', 'ESTADOS_FINANCIEROS', 'Estados Financieros / Declaración Anual', 'Firmados por contador público registrado', TRUE),
        ('VIVIENDA', 'ESCRITURA_PROPIEDAD', 'Escritura Pública de la Propiedad / Titulo', 'Inscrita en el Registro Público de la Propiedad', TRUE),
        ('VIVIENDA', 'CERTIFICADO_LIBRE_GRAVAMEN', 'Certificado de Libertad de Gravamen', 'Vigencia máxima de 30 días', TRUE);
      `);
    }

    // 8. Módulo de Notificaciones Internas e Interáreas (Folios 004 y 009)
    await db.query(`
      CREATE TABLE IF NOT EXISTS notificaciones_interareas (
        id SERIAL PRIMARY KEY,
        solicitud_id_sif VARCHAR(100) NOT NULL,
        remitente_id INT,
        remitente_nombre VARCHAR(255) NOT NULL,
        remitente_area VARCHAR(100) DEFAULT 'ANALISIS', -- 'ANALISIS', 'SUCURSAL', 'OPERATIVA'
        destinatario_area VARCHAR(100) DEFAULT 'SUCURSAL', -- 'SUCURSAL', 'ANALISIS'
        tipo_notificacion VARCHAR(50) NOT NULL, -- 'DEVOLUCION_DOCUMENTAL', 'REQUERIMIENTO_ATENDIDO', 'OBSERVACION'
        asunto VARCHAR(255) NOT NULL,
        mensaje TEXT NOT NULL,
        documento_codigo VARCHAR(100),
        fecha_envio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        leido BOOLEAN DEFAULT FALSE,
        fecha_lectura TIMESTAMP WITH TIME ZONE,
        usuario_lectura VARCHAR(255),
        atendido BOOLEAN DEFAULT FALSE,
        fecha_atencion TIMESTAMP WITH TIME ZONE,
        usuario_atencion VARCHAR(255),
        respuesta_atencion TEXT,
        plazo_limite_horas INT DEFAULT 24
      );
    `);

    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_notif_solicitud ON notificaciones_interareas(solicitud_id_sif);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_notif_leido ON notificaciones_interareas(leido);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_notif_atendido ON notificaciones_interareas(atendido);`); } catch (e) {}

    // 9. Módulo de Agenda Dinámica, Reagenda y Registro de Visitas Domiciliarias (Folios 001, 005 y 007)
    await db.query(`
      CREATE TABLE IF NOT EXISTS agenda_visitas (
        id SERIAL PRIMARY KEY,
        investigacion_id_sif VARCHAR(100) NOT NULL,
        solicitud_id_sif VARCHAR(100),
        persona_id_sif VARCHAR(100),
        investigador_id INT,
        tipo_gestion VARCHAR(50) DEFAULT 'INVESTIGACION', -- 'INVESTIGACION', 'COBRANZA'
        categoria_producto VARCHAR(50) DEFAULT 'CONSUMO', -- 'CONSUMO', 'COMERCIAL', 'VIVIENDA'
        zona_geografica VARCHAR(100) DEFAULT 'ZONA_CENTRO',
        prioridad INT DEFAULT 1,
        fecha_programada TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        estado_agenda VARCHAR(50) DEFAULT 'PROGRAMADA', -- 'PROGRAMADA', 'REAGENDADA', 'CANCELADA', 'EN_CAMPO', 'COMPLETADA', 'VENCIDA'
        motivo_reagenda TEXT,
        usuario_reagenda VARCHAR(255),
        hora_inicio TIMESTAMP WITH TIME ZONE, -- Check-in obligatorio
        latitud_inicio DOUBLE PRECISION,
        longitud_inicio DOUBLE PRECISION,
        hora_fin TIMESTAMP WITH TIME ZONE, -- Check-out obligatorio
        latitud_fin DOUBLE PRECISION,
        longitud_fin DOUBLE PRECISION,
        duracion_minutos INT, -- Duración real de la entrevista en minutos
        resultado_visita TEXT,
        evidencias_completas BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_investigacion ON agenda_visitas(investigacion_id_sif);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_investigador ON agenda_visitas(investigador_id);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_estado ON agenda_visitas(estado_agenda);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_agenda_tipo ON agenda_visitas(tipo_gestion);`); } catch (e) {}

    // Alteraciones en evidencias_visita para duración y tipo de gestión
    try { await db.query(`ALTER TABLE evidencias_visita ADD COLUMN IF NOT EXISTS hora_inicio TIMESTAMP WITH TIME ZONE;`); } catch (e) {}
    try { await db.query(`ALTER TABLE evidencias_visita ADD COLUMN IF NOT EXISTS hora_fin TIMESTAMP WITH TIME ZONE;`); } catch (e) {}
    try { await db.query(`ALTER TABLE evidencias_visita ADD COLUMN IF NOT EXISTS duracion_minutos INT;`); } catch (e) {}
    try { await db.query(`ALTER TABLE evidencias_visita ADD COLUMN IF NOT EXISTS tipo_gestion VARCHAR(50) DEFAULT 'INVESTIGACION';`); } catch (e) {}

    // 10. Prevalidación de Domicilio y Semáforo de Validación de Contactos (Folios 002 y 003)
    try { await db.query(`ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS domicilio_validado_sucursal BOOLEAN DEFAULT FALSE;`); } catch (e) {}
    try { await db.query(`ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS fecha_validacion_domicilio TIMESTAMP WITH TIME ZONE;`); } catch (e) {}
    try { await db.query(`ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS usuario_validacion_domicilio VARCHAR(255);`); } catch (e) {}
    try { await db.query(`ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS metodo_validacion_domicilio VARCHAR(50);`); } catch (e) {}
    try { await db.query(`ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS observaciones_domicilio TEXT;`); } catch (e) {}

    try { await db.query(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS telefono_principal VARCHAR(50);`); } catch (e) {}
    try { await db.query(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS telefono_secundario VARCHAR(50);`); } catch (e) {}
    try { await db.query(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS email_validado VARCHAR(255);`); } catch (e) {}
    try { await db.query(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS fuente_datos_contacto VARCHAR(50) DEFAULT 'SUCURSAL';`); } catch (e) {}
    try { await db.query(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS estado_contacto_semaforo VARCHAR(20) DEFAULT 'AMARILLO';`); } catch (e) {} // 'VERDE', 'AMARILLO', 'ROJO'
    try { await db.query(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS fecha_validacion_contacto TIMESTAMP WITH TIME ZONE;`); } catch (e) {}
    try { await db.query(`ALTER TABLE personas ADD COLUMN IF NOT EXISTS usuario_validacion_contacto VARCHAR(255);`); } catch (e) {}

    console.log('✅ Esquema inicializado correctamente.');
  } catch (err) {
    console.error('Error inicializando base de datos:', err);
  }
}

module.exports = initDb;
