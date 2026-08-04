const express = require('express');
const {
  getContactoDetalle,
  prevalidarDomicilio,
  validarContacto,
} = require('../controllers/contactos.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/persona/:id', authenticate, getContactoDetalle);
router.post('/prevalidar-domicilio', authenticate, prevalidarDomicilio);
router.post('/validar-contacto', authenticate, validarContacto);

module.exports = router;
