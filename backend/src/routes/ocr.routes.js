const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { escanearINE } = require('../controllers/ocr.controller');

/**
 * POST /api/ocr/ine
 * Escanea la fotografía frontal de una INE mexicana y extrae los campos automáticamente.
 * Requiere autenticación. Accesible para investigadores, admins y superadmin.
 * Body: { imagen_base64: "data:image/jpeg;base64,..." }
 */
router.post('/ine', authenticate, escanearINE);

module.exports = router;
