const express = require('express');
const {
  getInvestigaciones,
  getInvestigacionDetalle,
  asignarInvestigador,
  guardarEvidencia,
  validarInvestigacion,
  revalidarInvestigacion,
} = require('../controllers/investigaciones.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { PERMISSIONS } = require('../rbac/roles');

const router = express.Router();

router.get('/', authenticate, getInvestigaciones);
router.get('/:id', authenticate, getInvestigacionDetalle);
router.post('/:id/asignar', authenticate, asignarInvestigador);
router.post('/:id/evidencia', authenticate, guardarEvidencia);
router.post('/:id/validar', authenticate, authorize(PERMISSIONS.VALIDAR_INVESTIGACION), validarInvestigacion);
router.post('/:id/revalidar', authenticate, authorize(PERMISSIONS.REVALIDAR_INVESTIGACION), revalidarInvestigacion);

module.exports = router;


