const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { PERMISSIONS } = require('../rbac/roles');
const { getAuditLog, getAcciones } = require('../controllers/audit.controller');

const router = express.Router();

// Solo Auditor y Superadmin pueden consultar la bitácora
router.get('/', authenticate, authorize(PERMISSIONS.VER_AUDIT_LOG), getAuditLog);
router.get('/acciones', authenticate, authorize(PERMISSIONS.VER_AUDIT_LOG), getAcciones);

module.exports = router;
