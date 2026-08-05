const express = require('express');
const {
  getConfiguracionCorreo,
  guardarConfiguracionCorreo,
  probarConexionCorreo,
  getConfiguracionWhatsApp,
  guardarConfiguracionWhatsApp,
  probarConexionWhatsApp,
} = require('../controllers/configuracion.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/correo', authenticate, getConfiguracionCorreo);
router.post('/correo', authenticate, guardarConfiguracionCorreo);
router.post('/correo/prueba', authenticate, probarConexionCorreo);

router.get('/whatsapp', authenticate, getConfiguracionWhatsApp);
router.post('/whatsapp', authenticate, guardarConfiguracionWhatsApp);
router.post('/whatsapp/prueba', authenticate, probarConexionWhatsApp);

module.exports = router;
