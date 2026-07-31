const express = require('express');
const {
  getInvestigaciones,
  getInvestigacionDetalle,
  asignarInvestigador,
  guardarEvidencia,
} = require('../controllers/investigaciones.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, getInvestigaciones);
router.get('/:id', authenticate, getInvestigacionDetalle);
router.post('/:id/asignar', authenticate, asignarInvestigador);
router.post('/:id/evidencia', authenticate, guardarEvidencia);

module.exports = router;
