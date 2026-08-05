const express = require('express');
const { 
  getInvestigadores, 
  guardarUbicacion, 
  getUbicaciones,
  crearInvestigador,
  actualizarInvestigador,
  eliminarInvestigador,
} = require('../controllers/investigadores.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, getInvestigadores);
router.post('/', authenticate, crearInvestigador);
router.put('/:id', authenticate, actualizarInvestigador);
router.delete('/:id', authenticate, eliminarInvestigador);

router.post('/ubicacion', guardarUbicacion);
router.get('/ubicaciones', authenticate, getUbicaciones);

module.exports = router;
