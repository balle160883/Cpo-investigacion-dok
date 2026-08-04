const express = require('express');
const {
  getConfiguracionCorreo,
  guardarConfiguracionCorreo,
  probarConexionCorreo,
} = require('../controllers/configuracion.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/correo', authenticate, getConfiguracionCorreo);
router.post('/correo', authenticate, guardarConfiguracionCorreo);
router.post('/correo/prueba', authenticate, probarConexionCorreo);

module.exports = router;
