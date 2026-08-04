const express = require('express');
const {
  getNotificacionesBySolicitud,
  enviarNotificacion,
  registrarAcuseLectura,
  marcarRequerimientoAtendido,
} = require('../controllers/notificaciones.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/solicitud/:solicitudId', authenticate, getNotificacionesBySolicitud);
router.post('/enviar', authenticate, enviarNotificacion);
router.post('/:id/acuse', authenticate, registrarAcuseLectura);
router.post('/:id/atender', authenticate, marcarRequerimientoAtendido);

module.exports = router;
