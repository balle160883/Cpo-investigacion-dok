const express = require('express');
const { getStats, getProductividadInvestigadores, getAuditoriaAnalistas, getSlaStats } = require('../controllers/stats.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, getStats);
router.get('/productividad', authenticate, getProductividadInvestigadores);
router.get('/analistas', authenticate, getAuditoriaAnalistas);
router.get('/sla', authenticate, getSlaStats);

module.exports = router;
