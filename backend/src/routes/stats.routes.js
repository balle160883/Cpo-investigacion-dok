const express = require('express');
const { getStats } = require('../controllers/stats.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, getStats);

module.exports = router;
