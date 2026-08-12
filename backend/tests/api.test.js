const { describe, it } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

const { JWT_SECRET, authenticate, authorize } = require('../src/middlewares/auth.middleware');
const { hasPermission, ROLES, PERMISSIONS } = require('../src/rbac/roles');
const { validateRequiredFields } = require('../src/middlewares/validate.middleware');

describe('🔒 Pruebas de Autenticación y JWT', () => {
  it('Debe firmar y verificar un token JWT correctamente', () => {
    const payload = { id: 1, email: 'investigador@cajaoblatos.com.mx', rol: ROLES.INVESTIGADOR };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    assert.ok(typeof token === 'string');
    const decoded = jwt.verify(token, JWT_SECRET);
    assert.strictEqual(decoded.id, 1);
    assert.strictEqual(decoded.rol, ROLES.INVESTIGADOR);
  });

  it('Debe rechazar token invalido en el middleware authenticate', () => {
    const req = { headers: { authorization: 'Bearer token_invalido_123' }, query: {} };
    let statusSet = null;
    let jsonSent = null;

    const res = {
      status(code) {
        statusSet = code;
        return this;
      },
      json(obj) {
        jsonSent = obj;
        return this;
      },
    };

    authenticate(req, res, () => {});

    assert.strictEqual(statusSet, 401);
    assert.strictEqual(jsonSent.error, 'Token inválido o expirado');
  });

  it('Debe aceptar token por query parameter (?token=...)', () => {
    const token = jwt.sign({ id: 99, email: 'test@cpo.com', rol: ROLES.ADMIN }, JWT_SECRET);
    const req = { headers: {}, query: { token } };
    let nextCalled = false;

    authenticate(req, {}, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.user.id, 99);
  });
});

describe('🛡️ Pruebas de Control de Acceso Basado en Roles (RBAC)', () => {
  it('Superadmin debe tener permiso para gestionar usuarios y ver audit log', () => {
    assert.strictEqual(hasPermission(ROLES.SUPERADMIN, PERMISSIONS.GESTIONAR_USUARIOS), true);
    assert.strictEqual(hasPermission(ROLES.SUPERADMIN, PERMISSIONS.VER_AUDIT_LOG), true);
  });

  it('Investigador debe tener permiso para ver investigaciones pero NO para audit log', () => {
    assert.strictEqual(hasPermission(ROLES.INVESTIGADOR, PERMISSIONS.VER_INVESTIGACIONES), true);
    assert.strictEqual(hasPermission(ROLES.INVESTIGADOR, PERMISSIONS.VER_AUDIT_LOG), false);
  });
});

describe('📋 Pruebas de Middleware de Validación de Entradas', () => {
  it('Debe pasar si todos los campos requeridos existen', () => {
    const middleware = validateRequiredFields(['email', 'password']);
    const req = { body: { email: 'test@cpo.com', password: 'secretpassword' } };
    let nextCalled = false;

    middleware(req, {}, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
  });

  it('Debe retornar 400 si falta un campo requerido', () => {
    const middleware = validateRequiredFields(['email', 'password']);
    const req = { body: { email: 'test@cpo.com' } };
    let statusSet = null;
    let jsonSent = null;

    const res = {
      status(code) {
        statusSet = code;
        return this;
      },
      json(obj) {
        jsonSent = obj;
        return this;
      },
    };

    middleware(req, res, () => {});

    assert.strictEqual(statusSet, 400);
    assert.deepStrictEqual(jsonSent.campos_faltantes, ['password']);
  });
});
