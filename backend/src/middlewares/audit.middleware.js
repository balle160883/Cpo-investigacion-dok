/**
 * Middleware de Auditoría y Registro de Eventos Estructurados para CPO Investigaciones
 */
function auditLogger(req, res, next) {
  const start = Date.now();
  const path = req.originalUrl || req.url;
  const method = req.method;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const timestamp = new Date().toISOString();
    const user = req.user ? `${req.user.nombre || req.user.email} (ID: ${req.user.id})` : 'Anon/Guest';

    // Registrar solo peticiones que modifican estado o peticiones criticas
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) || path.includes('/auth/login')) {
      console.log(`[AUDITLOG] ${timestamp} | ${method} ${path} | STATUS: ${statusCode} | TIME: ${duration}ms | USER: ${user} | IP: ${ip}`);
    }
  });

  next();
}

module.exports = auditLogger;
