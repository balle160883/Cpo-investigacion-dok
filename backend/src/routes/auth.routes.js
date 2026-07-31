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

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión en el sistema CPO
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@cajaoblatos.mx
 *               password:
 *                 type: string
 *                 example: "MiContraseña123"
 *     responses:
 *       200:
 *         description: Login exitoso, retorna token JWT
 *       401:
 *         description: Credenciales inválidas
 *       429:
 *         description: Demasiados intentos (rate limit)
 */
router.post('/login', loginLimiter, login);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Obtener datos del usuario autenticado
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del usuario activo en sesión
 *       401:
 *         description: Token inválido o expirado
 */
router.get('/me', authenticate, me);

module.exports = router;

