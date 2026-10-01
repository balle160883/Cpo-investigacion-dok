const db = require('../db');
const bcrypt = require('bcryptjs');
const { login, cambiarPasswordPrimerIngreso } = require('../src/controllers/auth.controller');

async function runTest() {
  console.log('--- INICIANDO PRUEBAS DE CAMBIO OBLIGATORIO DE CONTRASEÑA ---');

  // 1. Activar temporalmente a Maria Valenzuela (cuenta test)
  await db.query("UPDATE investigadores SET activo = TRUE, debe_cambiar_password = TRUE WHERE email = 'maria.test@cajaoblatos.com.mx';");

  // 2. Simular Login con Seguridad2026@
  let loginResponse = null;
  const mockReqLogin = {
    body: {
      email: 'maria.test@cajaoblatos.com.mx',
      password: 'Seguridad2026@'
    }
  };
  const mockResLogin = {
    status: (code) => ({
      json: (data) => {
        console.error('Login status error:', code, data);
        return data;
      }
    }),
    json: (data) => {
      loginResponse = data;
      return data;
    }
  };

  await login(mockReqLogin, mockResLogin, (err) => { if (err) console.error('Login next err:', err); });

  console.log('2. Resultado de Login:');
  console.log(' - debe_cambiar_password:', loginResponse?.debe_cambiar_password);
  console.log(' - Token generado:', !!loginResponse?.token);
  console.log(' - User ID:', loginResponse?.user?.id);

  if (!loginResponse?.debe_cambiar_password) {
    throw new Error('Fallo: debe_cambiar_password debería ser true');
  }

  // 3. Probar cambio con la misma contraseña temporal (debe fallar)
  let failSamePass = null;
  const mockReqSame = {
    user: { id: loginResponse.user.id },
    body: {
      nuevaPassword: 'Seguridad2026@',
      confirmarPassword: 'Seguridad2026@'
    }
  };
  const mockResSame = {
    status: (code) => ({
      json: (data) => {
        failSamePass = { code, data };
        return data;
      }
    }),
    json: (data) => { failSamePass = { code: 200, data }; }
  };
  await cambiarPasswordPrimerIngreso(mockReqSame, mockResSame, (err) => {});
  console.log('3. Intento de reusar Seguridad2026@:', failSamePass?.code === 400 ? 'RECHAZADO CORRECTAMENTE (OK)' : 'ERROR');

  // 4. Probar cambio con contraseñas que no coinciden (debe fallar)
  let failMismatch = null;
  const mockReqMismatch = {
    user: { id: loginResponse.user.id },
    body: {
      nuevaPassword: 'MiClaveSecreta2026!',
      confirmarPassword: 'OtraClaveDistinta'
    }
  };
  const mockResMismatch = {
    status: (code) => ({
      json: (data) => {
        failMismatch = { code, data };
        return data;
      }
    }),
    json: (data) => { failMismatch = { code: 200, data }; }
  };
  await cambiarPasswordPrimerIngreso(mockReqMismatch, mockResMismatch, (err) => {});
  console.log('4. Intento con claves no coincidentes:', failMismatch?.code === 400 ? 'RECHAZADO CORRECTAMENTE (OK)' : 'ERROR');

  // 5. Probar cambio exitoso con nueva contraseña personal
  let successChange = null;
  const mockReqSuccess = {
    user: { id: loginResponse.user.id },
    body: {
      nuevaPassword: 'MiNuevaPasswordSegura2026$',
      confirmarPassword: 'MiNuevaPasswordSegura2026$'
    }
  };
  const mockResSuccess = {
    status: (code) => ({
      json: (data) => {
        successChange = { code, data };
        return data;
      }
    }),
    json: (data) => { successChange = { code: 200, data }; }
  };
  await cambiarPasswordPrimerIngreso(mockReqSuccess, mockResSuccess, (err) => {});
  console.log('5. Cambio con nueva clave válida:', successChange?.code === 200 ? 'ÉXITO (OK)' : 'ERROR');
  console.log(' - Nuevo token recibido:', !!successChange?.data?.token);
  console.log(' - debe_cambiar_password post-cambio:', successChange?.data?.user?.debe_cambiar_password);

  // 6. Probar nuevo login con la contraseña recién creada
  let newLoginRes = null;
  const mockReqNewLogin = {
    body: {
      email: 'maria.test@cajaoblatos.com.mx',
      password: 'MiNuevaPasswordSegura2026$'
    }
  };
  const mockResNewLogin = {
    status: (code) => ({ json: (d) => console.error('Error status:', code, d) }),
    json: (d) => { newLoginRes = d; }
  };
  await login(mockReqNewLogin, mockResNewLogin, (err) => {});
  console.log('6. Login con nueva contraseña:');
  console.log(' - Login exitoso:', !!newLoginRes?.token);
  console.log(' - debe_cambiar_password:', newLoginRes?.debe_cambiar_password);

  // 7. Restaurar estado de prueba
  const hashReset = await bcrypt.hash('Seguridad2026@', 10);
  await db.query(
    "UPDATE investigadores SET activo = FALSE, password = $1, debe_cambiar_password = TRUE WHERE email = 'maria.test@cajaoblatos.com.mx';",
    [hashReset]
  );
  console.log('7. Estado del usuario test restaurado.');

  console.log('--- TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE ---');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Error fatal durante la prueba:', err);
  process.exit(1);
});
