const express = require('express');
const router = express.Router();
const creditosController = require('../controllers/creditos.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Rutas protegidas por autenticación JWT
router.get('/recientes', authenticate, creditosController.getCreditosRecientes);
router.get('/buscar', authenticate, creditosController.buscarCreditos);
router.get('/dictamen/:folio', authenticate, creditosController.getDictamenCredito);

module.exports = router;
