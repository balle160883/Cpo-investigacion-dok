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

    // Índices de alto rendimiento para búsquedas y filtros en investigaciones, evidencias y direcciones
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_investigaciones_investigador ON investigaciones(investigador_id);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_investigaciones_estado ON investigaciones(estado);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_investigaciones_solicitud ON investigaciones(solicitud_id_sif);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_investigaciones_persona ON investigaciones(persona_id_sif);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_investigaciones_fecha_asig ON investigaciones(fecha_asignacion DESC NULLS LAST);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_investigaciones_estado_fecha ON investigaciones(estado, fecha_asignacion DESC NULLS LAST);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_personas_idsif ON personas(id_sif);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_personas_nombre ON personas(nombre_completo);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_solicitudes_idsif ON solicitudes_credito(id_sif);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_solicitudes_folio ON solicitudes_credito(folio);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_evidencias_investigacion ON evidencias_visita(investigacion_id_sif);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_evidencias_jsonb ON evidencias_visita USING gin(estudio_socioeconomico);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_direcciones_persona ON direcciones(persona_id_sif);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_direcciones_colonia ON direcciones(colonia);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_ubicaciones_investigador ON ubicaciones_investigadores(investigador_id);`); } catch (e) {}

    // Alteraciones seguras
    try { await db.query(`ALTER TABLE investigadores ADD COLUMN IF NOT EXISTS password VARCHAR(255) DEFAULT '123456';`); } catch (e) {}
    try { await db.query(`ALTER TABLE investigadores ADD COLUMN IF NOT EXISTS rol VARCHAR(50) DEFAULT 'investigador';`); } catch (e) {}
    try { await db.query(`ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS colonia VARCHAR(255);`); } catch (e) {}
    try { await db.query(`ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS municipio VARCHAR(255) DEFAULT 'Guadalajara';`); } catch (e) {}
    try { await db.query(`ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS estado_provincia VARCHAR(255) DEFAULT 'Jalisco';`); } catch (e) {}
    try { await db.query(`ALTER TABLE direcciones ADD COLUMN IF NOT EXISTS es_principal BOOLEAN DEFAULT TRUE;`); } catch (e) {}
    try { await db.query(`ALTER TABLE evidencias_visita ADD COLUMN IF NOT EXISTS firma_investigador_url TEXT;`); } catch (e) {}
    try { await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS asignacion_manual BOOLEAN DEFAULT FALSE;`); } catch (e) {}
    try { await db.query(`ALTER TABLE investigaciones ADD COLUMN IF NOT EXISTS origen_asignacion VARCHAR(50);`); } catch (e) {}

    // Trigger de protección de asignaciones manuales realizadas desde la plataforma CPO
    try {
      await db.query(`
        CREATE OR REPLACE FUNCTION protect_manual_assignment()
        RETURNS TRIGGER AS $$
        BEGIN
          IF OLD.asignacion_manual = TRUE AND NEW.investigador_id IS DISTINCT FROM OLD.investigador_id THEN
            IF NEW.origen_asignacion IS DISTINCT FROM 'PLATAFORMA_CPO' THEN
              NEW.investigador_id := OLD.investigador_id;
              NEW.asignacion_manual := TRUE;
            ELSE
              NEW.asignacion_manual := TRUE;
              NEW.origen_asignacion := NULL;
            END IF;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trigger_protect_manual_assignment ON investigaciones;
        CREATE TRIGGER trigger_protect_manual_assignment
        BEFORE UPDATE ON investigaciones
        FOR EACH ROW
        EXECUTE FUNCTION protect_manual_assignment();
      `);
    } catch (e) {
      console.error('Error al configurar trigger de protección de asignación manual:', e);
    }

    // Trigger de normalización automática de estados de México según municipio
    try {
      await db.query(`
        CREATE OR REPLACE FUNCTION auto_normalize_estado_provincia()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.municipio IS NOT NULL THEN
            CASE UPPER(TRIM(NEW.municipio))
              WHEN 'CULIACAN', 'AHOME', 'GUASAVE', 'NAVOLATO', 'SAN IGNACIO', 'ESCUINAPA', 'EL FUERTE', 'COSALA', 'BADIRAGUATO', 'MAZATLAN', 'CHOIX', 'CONCORDIA', 'ELOTA', 'MOCORITO', 'ROSARIO', 'SALVADOR ALVARADO', 'SINALOA' THEN
                NEW.estado_provincia := 'Sinaloa';
              WHEN 'HERMOSILLO', 'NAVOJOA', 'ETCHOJOA', 'CAJEME', 'HUATABAMPO', 'BACUM', 'SAN IGNACIO RIO MUERTO', 'ALAMOS', 'NOGALES', 'GUAYMAS', 'CABORCA', 'PUERTO PENASCO', 'AGUA PRIETA' THEN
                NEW.estado_provincia := 'Sonora';
              WHEN 'TEPIC', 'BAHIA DE BANDERAS', 'SANTIAGO IXCUINTLA', 'TECUALA', 'XALISCO', 'SAN BLAS', 'RUIZ', 'HUAJICORI', 'COMPOSTELA', 'IXTLAN DEL RIO', 'ROSAMORADA', 'ACAPONETA', 'AHUACATLAN', 'AMATLAN DE CANAS', 'AMATLAN DE CAÑAS', 'JALA', 'LA YESCA', 'SAN PEDRO LAGUNILLAS', 'SANTA MARIA DEL ORO', 'TUXPAN', 'EL NAYAR', 'DEL NAYAR' THEN
                NEW.estado_provincia := 'Nayarit';
              WHEN 'COLIMA', 'MANZANILLO', 'TECOMAN', 'VILLA DE ALVAREZ', 'ARMERIA', 'COMALA', 'COQUIMATLAN', 'CUAUHTEMOC', 'IXTLAHUACAN', 'MINATITLAN' THEN
                NEW.estado_provincia := 'Colima';
              WHEN 'SAN LUIS POTOSI', 'SOLEDAD DE GRACIANO SANCHEZ', 'CIUDAD FERNANDEZ', 'SAN CIRO DE ACOSTA', 'RIOVERDE', 'CIUDAD VALLES', 'TAMAZUNCHALE', 'MATEHUALA' THEN
                NEW.estado_provincia := 'San Luis Potosí';
              WHEN 'AGUASCALIENTES', 'JESUS MARIA', 'ASIENTOS', 'TEPEZALA', 'RINCON DE ROMOS', 'COSIO', 'PABELLON DE ARTEAGA', 'SAN FRANCISCO DE LOS ROMO', 'CALVILLO', 'EL LLANO', 'SAN JOSE DE GRACIA' THEN
                NEW.estado_provincia := 'Aguascalientes';
              WHEN 'ZACATECAS', 'GUADALUPE', 'PINOS', 'LORETO', 'OJOCALIENTE', 'LUIS MOYA', 'NORIA DE ANGELES', 'VILLA HIDALGO', 'VILLA GONZALEZ ORTEGA', 'VILLA GARCIA', 'MOYAHUA DE ESTRADA', 'JUCHIPILA', 'APULCO', 'FRESNILLO', 'JEREZ', 'SOMBRERETE', 'RIO GRANDE' THEN
                NEW.estado_provincia := 'Zacatecas';
              WHEN 'MARCOS CASTELLANOS', 'JIQUILPAN', 'MORELIA', 'URUAPAN', 'ZAMORA', 'SAHUAYO', 'LA PIEDAD', 'LOS REYES', 'PATZCUARO', 'ZITACUARO', 'APATZINGAN' THEN
                NEW.estado_provincia := 'Michoacán';
              WHEN 'LEON', 'CELAYA', 'IRAPUATO', 'SALAMANCA', 'SILAO', 'GUANAJUATO', 'SAN MIGUEL DE ALLENDE', 'PENJAMO' THEN
                NEW.estado_provincia := 'Guanajuato';
              WHEN 'APAXCO', 'TOLUCA', 'METEPEC', 'ECATEPEC', 'NEZAHUALCOYOTL', 'NAUCALPAN', 'TLALNEPANTLA' THEN
                NEW.estado_provincia := 'Estado de México';
              WHEN 'GUADALAJARA', 'ZAPOPAN', 'TLAQUEPAQUE', 'SAN PEDRO TLAQUEPAQUE', 'TONALA', 'TLAJOMULCO DE ZUNIGA', 'TLAJOMULCO DE ZÚÑIGA', 'EL SALTO', 'PUERTO VALLARTA', 'CIUDAD GUZMAN', 'ZAPOTLAN EL GRANDE', 'TEPATITLAN DE MORELOS', 'TEPATITLAN', 'ARANDAS', 'LAGOS DE MORENO', 'OCOTLAN', 'AUTLAN DE NAVARRO', 'AMECA', 'TALPA DE ALLENDE', 'MASCOTA', 'TEQUILA', 'CHAPALA', 'JOCOTEPEC' THEN
                NEW.estado_provincia := 'Jalisco';
              ELSE
                IF NEW.estado_provincia IS NULL OR NEW.estado_provincia = '' THEN
                  NEW.estado_provincia := 'Jalisco';
                END IF;
            END CASE;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trigger_auto_normalize_estado ON direcciones;
        CREATE TRIGGER trigger_auto_normalize_estado
        BEFORE INSERT OR UPDATE ON direcciones
        FOR EACH ROW
        EXECUTE FUNCTION auto_normalize_estado_provincia();
      `);

      // Corregir inmediatamente cualquier registro en la base de datos con municipio asignado a un estado incorrecto (ej: Jalisco)
      await db.query(`
        UPDATE direcciones SET estado_provincia = 'Nayarit'
        WHERE UPPER(TRIM(municipio)) IN ('ROSAMORADA', 'TEPIC', 'BAHIA DE BANDERAS', 'SANTIAGO IXCUINTLA', 'TECUALA', 'XALISCO', 'SAN BLAS', 'RUIZ', 'HUAJICORI', 'COMPOSTELA', 'IXTLAN DEL RIO', 'ACAPONETA', 'AHUACATLAN', 'AMATLAN DE CANAS', 'AMATLAN DE CAÑAS', 'JALA', 'LA YESCA', 'SAN PEDRO LAGUNILLAS', 'SANTA MARIA DEL ORO', 'TUXPAN', 'EL NAYAR', 'DEL NAYAR')
          AND (estado_provincia IS NULL OR estado_provincia != 'Nayarit');

        UPDATE direcciones SET estado_provincia = 'Sinaloa'
        WHERE UPPER(TRIM(municipio)) IN ('CULIACAN', 'AHOME', 'GUASAVE', 'NAVOLATO', 'SAN IGNACIO', 'ESCUINAPA', 'EL FUERTE', 'COSALA', 'BADIRAGUATO', 'MAZATLAN', 'CHOIX', 'CONCORDIA', 'ELOTA', 'MOCORITO', 'ROSARIO', 'SALVADOR ALVARADO', 'SINALOA')
          AND (estado_provincia IS NULL OR estado_provincia != 'Sinaloa');

        UPDATE direcciones SET estado_provincia = 'Colima'
        WHERE UPPER(TRIM(municipio)) IN ('COLIMA', 'MANZANILLO', 'TECOMAN', 'VILLA DE ALVAREZ', 'ARMERIA', 'COMALA', 'COQUIMATLAN', 'CUAUHTEMOC', 'IXTLAHUACAN', 'MINATITLAN')
          AND (estado_provincia IS NULL OR estado_provincia != 'Colima');

        UPDATE direcciones SET estado_provincia = 'Sonora'
        WHERE UPPER(TRIM(municipio)) IN ('HERMOSILLO', 'NAVOJOA', 'ETCHOJOA', 'CAJEME', 'HUATABAMPO', 'BACUM', 'SAN IGNACIO RIO MUERTO', 'ALAMOS', 'NOGALES', 'GUAYMAS', 'CABORCA', 'PUERTO PENASCO', 'AGUA PRIETA')
          AND (estado_provincia IS NULL OR estado_provincia != 'Sonora');

        UPDATE direcciones SET estado_provincia = 'Zacatecas'
        WHERE UPPER(TRIM(municipio)) IN ('ZACATECAS', 'GUADALUPE', 'PINOS', 'LORETO', 'OJOCALIENTE', 'LUIS MOYA', 'NORIA DE ANGELES', 'VILLA HIDALGO', 'VILLA GONZALEZ ORTEGA', 'VILLA GARCIA', 'MOYAHUA DE ESTRADA', 'JUCHIPILA', 'APULCO', 'FRESNILLO', 'JEREZ', 'SOMBRERETE', 'RIO GRANDE')
          AND (estado_provincia IS NULL OR estado_provincia != 'Zacatecas');

        UPDATE direcciones SET estado_provincia = 'Aguascalientes'
        WHERE UPPER(TRIM(municipio)) IN ('AGUASCALIENTES', 'JESUS MARIA', 'ASIENTOS', 'TEPEZALA', 'RINCON DE ROMOS', 'COSIO', 'PABELLON DE ARTEAGA', 'SAN FRANCISCO DE LOS ROMO', 'CALVILLO', 'EL LLANO', 'SAN JOSE DE GRACIA')
          AND (estado_provincia IS NULL OR estado_provincia != 'Aguascalientes');

        UPDATE direcciones SET estado_provincia = 'Michoacán'
        WHERE UPPER(TRIM(municipio)) IN ('MARCOS CASTELLANOS', 'JIQUILPAN', 'MORELIA', 'URUAPAN', 'ZAMORA', 'SAHUAYO', 'LA PIEDAD', 'LOS REYES', 'PATZCUARO', 'ZITACUARO', 'APATZINGAN')
          AND (estado_provincia IS NULL OR estado_provincia != 'Michoacán');

        UPDATE direcciones SET estado_provincia = 'Guanajuato'
        WHERE UPPER(TRIM(municipio)) IN ('LEON', 'CELAYA', 'IRAPUATO', 'SALAMANCA', 'SILAO', 'GUANAJUATO', 'SAN MIGUEL DE ALLENDE', 'PENJAMO')
          AND (estado_provincia IS NULL OR estado_provincia != 'Guanajuato');
      `);
    } catch (e) {
      console.error('Error al configurar trigger de normalización de estados:', e);
    }

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

    // Actualización automática de rol para Norma Lizette Bermejo Palos (Administradora de Analistas & CPO)
    try {
      await db.query(`
        UPDATE investigadores
        SET rol = 'admin'
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

    // 11. Configuración General del Sistema y Servidor de Correo (SMTP)
    await db.query(`
      CREATE TABLE IF NOT EXISTS configuracion_sistema (
        id SERIAL PRIMARY KEY,
        clave VARCHAR(100) UNIQUE NOT NULL,
        valor JSONB NOT NULL,
        descripcion TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 12. Fichas de Restablecimiento de Contraseña por Correo
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        expiracion TIMESTAMP WITH TIME ZONE NOT NULL,
        utilizado BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_reset_token ON password_resets(token);`); } catch (e) {}
    try { await db.query(`CREATE INDEX IF NOT EXISTS idx_reset_email ON password_resets(email);`); } catch (e) {}

    // 13. Licenciamiento SaaS y Renta Mensual (Exclusivo Super Admin)
    await db.query(`
      CREATE TABLE IF NOT EXISTS suscripcion_empresa (
        id SERIAL PRIMARY KEY,
        nombre_empresa VARCHAR(255) NOT NULL DEFAULT 'Caja Popular Oblatos',
        rfc_identificacion VARCHAR(50) DEFAULT 'CPO850101XXX',
        plan_nombre VARCHAR(100) DEFAULT 'PLAN ENTERPRISE CPO',
        precio_mensual NUMERIC(12, 2) DEFAULT 4500.00,
        estado_suscripcion VARCHAR(50) DEFAULT 'ACTIVA', -- 'ACTIVA', 'PENDIENTE_PAGO', 'SUSPENDIDA'
        fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        fecha_proximo_pago TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
        dias_gracia INT DEFAULT 5,
        limite_usuarios INT DEFAULT 100,
        observaciones_renta TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS historial_pagos_suscripcion (
        id SERIAL PRIMARY KEY,
        suscripcion_id INT REFERENCES suscripcion_empresa(id),
        monto NUMERIC(12, 2) NOT NULL,
        fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        metodo_pago VARCHAR(50) DEFAULT 'TRANSFERENCIA',
        folio_factura VARCHAR(100),
        estatus VARCHAR(50) DEFAULT 'PAGADO',
        observaciones TEXT
      );
    `);

    // Sembrar configuración SMTP, Triggers y WhatsApp por defecto si no existen
    try {
      await db.query(`
        INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
        ('smtp_config', $1, 'Configuración de servidor SMTP y notificaciones por correo'),
        ('email_triggers', $2, 'Interruptores para el envío de notificaciones automáticas'),
        ('whatsapp_config', $3, 'Configuración de integración con WhatsApp Business API')
        ON CONFLICT (clave) DO NOTHING;
      `, [
        JSON.stringify({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          user: 'notificaciones@cajaoblatos.com.mx',
          pass: '',
          from_email: 'notificaciones@cajaoblatos.com.mx',
          from_name: 'CPO Investigaciones — Notificaciones',
          enabled: false,
        }),
        JSON.stringify({
          notificar_validador_al_completar: true,
          notificar_analista_al_validar: true,
          notificar_sucursal_devolucion: true,
          notificar_alerta_renta_vencida: true,
        }),
        JSON.stringify({
          enabled: false,
          provider: 'META_CLOUD',
          phone_number_id: '109823749827349',
          token: '',
          sender_phone: '+523312345678',
          template_name: 'cpo_notificacion_visita',
        })
      ]);
    } catch (e) {
      console.error('Error sembrando configuracion_sistema:', e.message);
    }

    // Sembrar suscripción empresa si está vacía
    const { rows: existingSusc } = await db.query("SELECT count(*) FROM suscripcion_empresa;");
    if (parseInt(existingSusc[0].count) === 0) {
      console.log('Sembrando registro inicial de renta mensual...');
      await db.query(`
        INSERT INTO suscripcion_empresa (nombre_empresa, rfc_identificacion, plan_nombre, precio_mensual, estado_suscripcion, fecha_proximo_pago)
        VALUES ('Caja Popular Oblatos S.C. de A.P. de R.L. de C.V.', 'CPO850101XXX', 'PLAN ENTERPRISE CPO', 4500.00, 'ACTIVA', NOW() + INTERVAL '30 days');
      `);
    }

    // Actualizar rol 'superadmin' para admin
    try {
      await db.query(`UPDATE investigadores SET rol = 'superadmin' WHERE email = 'admin@cajaoblatos.com.mx';`);
    } catch (e) {}

    console.log('✅ Esquema inicializado correctamente.');
  } catch (err) {
    console.error('Error inicializando base de datos:', err);
  }
}

module.exports = initDb;
