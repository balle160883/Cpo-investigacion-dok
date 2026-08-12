const logger = require('../utils/logger');

// Middleware global de manejo de errores en Express
function errorHandler(err, req, res, next) {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  logger.error(err.message || 'Error interno del servidor', {
    url: req.originalUrl || req.url,
    method: req.method,
    statusCode,
    stack: err.stack,
    user: req.user ? req.user.email : 'Anon',
  });

  res.status(statusCode).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
