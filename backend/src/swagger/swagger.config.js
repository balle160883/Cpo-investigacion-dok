const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CPO Investigaciones Domiciliarias — API',
      version: '2.0.0',
      description:
        'API REST del sistema de gestión de investigaciones domiciliarias de **Caja de Ahorro y Crédito Oblatos (CPO)**. ' +
        'Permite gestionar investigaciones SIF, investigadores en campo, estadísticas de productividad y autenticación segura.',
      contact: {
        name: 'Departamento de Investigaciones CPO',
        email: 'sistemas@cajaoblatos.mx',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'Servidor de Producción (Dokploy)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido en /api/auth/login',
        },
      },
    },
    tags: [
      { name: 'Autenticación', description: 'Login y verificación de sesión' },
      { name: 'Estadísticas', description: 'Métricas globales y productividad del dashboard' },
      { name: 'Investigaciones', description: 'Gestión de estudios domiciliarios SIF' },
      { name: 'Investigadores', description: 'Catálogo de gestores domiciliarios en campo' },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
