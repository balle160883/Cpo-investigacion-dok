const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión desde esta IP. Por favor intenta de nuevo en 15 minutos.' }
});

router.post('/login', loginLimiter, login);
router.get('/me', authenticate, me);

module.exports = router;
