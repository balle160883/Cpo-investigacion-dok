const express = require('express');
const {
  getSuscripcion,
  actualizarPlanSuscripcion,
  registrarPagoRenta,
} = require('../controllers/suscripcion.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, getSuscripcion);
router.post('/plan', authenticate, actualizarPlanSuscripcion);
router.post('/pago', authenticate, registrarPagoRenta);

module.exports = router;
