const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const initDb = require('./init_db');
const errorHandler = require('./src/middlewares/error.middleware');

const authRoutes = require('./src/routes/auth.routes');
const statsRoutes = require('./src/routes/stats.routes');
const investigadoresRoutes = require('./src/routes/investigadores.routes');
const investigacionesRoutes = require('./src/routes/investigaciones.routes');

const app = express();
const PORT = process.env.PORT || 4000;

// Seguridad HTTP con Helmet y CORS
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Inicializar esquema de Base de Datos al arrancar
initDb();

// Registro de Enrutadores Modulares
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/investigadores', investigadoresRoutes);
app.use('/api/investigaciones', investigacionesRoutes);

// Middleware Global de Manejo de Errores
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Backend modular corriendo en puerto ${PORT}`);
});
