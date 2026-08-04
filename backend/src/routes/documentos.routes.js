const express = require('express');
const {
  getChecklistBySolicitud,
  cargarDocumento,
  validarDocumento,
  registrarExcepcionDocumento,
} = require('../controllers/documentos.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/checklist/:solicitudId', authenticate, getChecklistBySolicitud);
router.post('/cargar', authenticate, cargarDocumento);
router.post('/:id/validar', authenticate, validarDocumento);
router.post('/excepcion', authenticate, registrarExcepcionDocumento);

module.exports = router;
