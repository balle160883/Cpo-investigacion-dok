const express = require('express');
const { getStats, getProductividadInvestigadores } = require('../controllers/stats.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, getStats);
router.get('/productividad', authenticate, getProductividadInvestigadores);

module.exports = router;
