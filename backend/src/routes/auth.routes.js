const express = require('express');
const rateLimit = require('express-rate-limit');
const { 
  login, 
  me, 
  recuperarPassword, 
  restablecerPassword, 
  enviarResetAdmin, 
  cambiarPasswordPrimerIngreso 
} = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión desde esta IP. Por favor intenta de nuevo en 15 minutos.' }
});

router.post('/login', loginLimiter, login);
router.get('/me', authenticate, me);

// Middleware opcional de autenticación para cambio obligatorio de contraseña
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }
  next();
}

/**
 * Endpoint para cambio obligatorio de contraseña en primer ingreso
 * Soporta autenticación por token Bearer o por usuario/passwordActual en el body
 */
router.post('/primer-cambio-password', optionalAuthenticate, cambiarPasswordPrimerIngreso);

router.post('/recuperar-password', recuperarPassword);
router.post('/restablecer-password', restablecerPassword);
router.post('/admin-reset', authenticate, enviarResetAdmin);

module.exports = router;

