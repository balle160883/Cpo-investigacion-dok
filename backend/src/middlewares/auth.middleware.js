const jwt = require('jsonwebtoken');
const { hasPermission } = require('../rbac/roles');

const JWT_SECRET = process.env.JWT_SECRET || 'cpo-investigaciones-secret-2026';

/**
 * Middleware de autenticación JWT
 * Soporta token mediante header Authorization ('Bearer <token>') o query parameter ('?token=<token>')
 */
function authenticate(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Middleware de Autorización RBAC
 * Verifica que el usuario autenticado tenga el permiso requerido.
 * @param {string} permiso — clave de PERMISSIONS en rbac/roles.js
 */
function authorize(permiso) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!hasPermission(req.user.rol, permiso)) {
      return res.status(403).json({
        error: 'Acceso denegado',
        detalle: `El rol '${req.user.rol}' no tiene permiso para esta operación.`,
        permiso_requerido: permiso,
      });
    }
    next();
  };
}

module.exports = {
  authenticate,
  authorize,
  JWT_SECRET,
};
