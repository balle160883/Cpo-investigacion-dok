const express = require('express');
const { getInvestigadores, guardarUbicacion, getUbicaciones } = require('../controllers/investigadores.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, getInvestigadores);
router.post('/ubicacion', guardarUbicacion);
router.get('/ubicaciones', authenticate, getUbicaciones);

module.exports = router;
