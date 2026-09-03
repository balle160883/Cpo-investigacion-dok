const express = require('express');
const {
  getInvestigaciones,
  getInvestigacionDetalle,
  getColoniasActivas,
  getSucursalesActivas,
  asignarInvestigador,
  asignarInvestigadorLote,
  guardarEvidencia,
  validarInvestigacion,
  revalidarInvestigacion,
  guardarComentariosValidador,
  actualizarTelefonoInvestigacion,
} = require('../controllers/investigaciones.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { PERMISSIONS } = require('../rbac/roles');

const router = express.Router();

router.get('/', authenticate, getInvestigaciones);
router.get('/colonias', authenticate, getColoniasActivas);
router.get('/sucursales', authenticate, getSucursalesActivas);
router.post('/asignar-lote', authenticate, asignarInvestigadorLote);
router.get('/:id', authenticate, getInvestigacionDetalle);
router.post('/:id/asignar', authenticate, asignarInvestigador);
router.post('/:id/evidencia', authenticate, guardarEvidencia);
router.patch('/:id/telefono', authenticate, actualizarTelefonoInvestigacion);
router.post('/:id/validar', authenticate, authorize(PERMISSIONS.VALIDAR_INVESTIGACION), validarInvestigacion);
router.post('/:id/revalidar', authenticate, authorize(PERMISSIONS.REVALIDAR_INVESTIGACION), revalidarInvestigacion);
router.post('/:id/comentarios-validador', authenticate, authorize(PERMISSIONS.VALIDAR_INVESTIGACION), guardarComentariosValidador);

module.exports = router;


