// Middleware global de manejo de errores en Express
function errorHandler(err, req, res, next) {
  console.error('🔥 Error no capturado en backend:', err);

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
  res.status(statusCode).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
