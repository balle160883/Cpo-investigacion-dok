const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/swagger/swagger.config');
const initDb = require('./init_db');
const errorHandler = require('./src/middlewares/error.middleware');
const auditLogger = require('./src/middlewares/audit.middleware');

const authRoutes = require('./src/routes/auth.routes');
const statsRoutes = require('./src/routes/stats.routes');
const investigadoresRoutes = require('./src/routes/investigadores.routes');
const investigacionesRoutes = require('./src/routes/investigaciones.routes');
const auditRoutes = require('./src/routes/audit.routes');
const ocrRoutes = require('./src/routes/ocr.routes');
const documentosRoutes = require('./src/routes/documentos.routes');
const notificacionesRoutes = require('./src/routes/notificaciones.routes');
const agendaRoutes = require('./src/routes/agenda.routes');
const contactosRoutes = require('./src/routes/contactos.routes');
const configuracionRoutes = require('./src/routes/configuracion.routes');
const suscripcionRoutes = require('./src/routes/suscripcion.routes');

const app = express();
const PORT = process.env.PORT || 4000;

// Garantizar que el directorio de uploads exista (volumen Docker: /app/uploads)
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`📁 Directorio de medios creado: ${UPLOADS_DIR}`);
}

// Seguridad HTTP con Helmet y CORS
app.use(helmet({
  contentSecurityPolicy: false, // Necesario para que Swagger UI cargue correctamente
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Logger de Auditoría de Eventos
app.use(auditLogger);

// Servir archivos de evidencias fotográficas almacenados en disco
app.use('/uploads', express.static(UPLOADS_DIR));

// Documentación Interactiva de la API (Swagger UI)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'CPO Investigaciones — API Docs',
  customCss: '.swagger-ui .topbar { background-color: #0f172a; } .swagger-ui .topbar-wrapper img { content: none; }',
}));
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Inicializar esquema de Base de Datos al arrancar
initDb();

// Registro de Enrutadores Modulares
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/investigadores', investigadoresRoutes);
app.use('/api/investigaciones', investigacionesRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/contactos', contactosRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/suscripcion', suscripcionRoutes);

// Middleware Global de Manejo de Errores
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Backend modular corriendo en puerto ${PORT}`);
  console.log(`📦 Almacenamiento de medios en: ${UPLOADS_DIR}`);
  console.log(`📖 Documentación API disponible en: http://localhost:${PORT}/api/docs`);
});


