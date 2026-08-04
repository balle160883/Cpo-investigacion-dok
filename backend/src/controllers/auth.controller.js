const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../../db');
const { JWT_SECRET } = require('../middlewares/auth.middleware');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const searchTerm = email.toString().toLowerCase().trim();

    const { rows } = await db.query(
      `SELECT * FROM investigadores 
       WHERE (LOWER(email) = $1 OR LOWER(nombre) = $1) AND activo = TRUE;`,
      [searchTerm]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    const user = rows[0];
    let isPasswordValid = false;

    const isBcryptHash = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));

    if (isBcryptHash) {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } else {
      if (user.password === password) {
        isPasswordValid = true;
        try {
          const hashedPassword = await bcrypt.hash(password, 10);
          await db.query('UPDATE investigadores SET password = $1 WHERE id = $2;', [hashedPassword, user.id]);
          console.log(`🔒 Contraseña migrada exitosamente a bcrypt para usuario ID: ${user.id}`);
        } catch (migrationErr) {
          console.error('Error durante migración de contraseña:', migrationErr);
        }
      }
    }

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        telefono: user.telefono,
        rol: user.rol,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: req.user });
}

// 1. Solicitar recuperación de contraseña por correo
async function recuperarPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'El correo electrónico es requerido' });
    }

    const { rows } = await db.query(
      `SELECT * FROM investigadores WHERE LOWER(email) = LOWER($1) AND activo = TRUE`,
      [email.trim()]
    );

    if (rows.length === 0) {
      // Para evitar ataques de enumeración, retornamos un mensaje positivo genérico
      return res.json({ mensaje: 'Si el correo está registrado, recibirás las instrucciones en tu bandeja de entrada.' });
    }

    const user = rows[0];
    const crypto = require('crypto');
    const token = crypto.randomBytes(24).toString('hex');
    const expiracion = new Date(Date.now() + 3600000); // 1 hora de vigencia

    await db.query(
      `INSERT INTO password_resets (email, token, expiracion) VALUES ($1, $2, $3)`,
      [user.email, token, expiracion]
    );

    const { sendPasswordResetEmail } = require('../utils/mailer.service');
    await sendPasswordResetEmail(user.email, token, user.nombre);

    res.json({ mensaje: 'Instrucciones enviadas por correo con éxito', email: user.email });
  } catch (err) {
    next(err);
  }
}

// 2. Restablecer contraseña mediante Token de recuperación
async function restablecerPassword(req, res, next) {
  try {
    const { token, nuevaPassword } = req.body;
    if (!token || !nuevaPassword) {
      return res.status(400).json({ error: 'El token y la nueva contraseña son requeridos' });
    }

    const { rows } = await db.query(
      `SELECT * FROM password_resets WHERE token = $1 AND utilizado = FALSE AND expiracion > NOW()`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'El enlace de recuperación es inválido o ha expirado.' });
    }

    const resetItem = rows[0];
    const hashedPassword = await bcrypt.hash(nuevaPassword, 10);

    // Actualizar contraseña del usuario
    await db.query(
      `UPDATE investigadores SET password = $1 WHERE LOWER(email) = LOWER($2)`,
      [hashedPassword, resetItem.email]
    );

    // Marcar token como consumido
    await db.query(
      `UPDATE password_resets SET utilizado = TRUE WHERE id = $1`,
      [resetItem.id]
    );

    res.json({ mensaje: 'Contraseña actualizada con éxito. Ya puedes iniciar sesión.' });
  } catch (err) {
    next(err);
  }
}

// 3. Enviar correo de restablecimiento desde el Panel de Administración por un Super Admin/Admin
async function enviarResetAdmin(req, res, next) {
  try {
    const { usuarioId, email } = req.body;

    let targetEmail = email;
    let targetNombre = 'Usuario';

    if (usuarioId) {
      const { rows } = await db.query(`SELECT email, nombre FROM investigadores WHERE id = $1`, [usuarioId]);
      if (rows.length > 0) {
        targetEmail = rows[0].email;
        targetNombre = rows[0].nombre;
      }
    }

    if (!targetEmail) {
      return res.status(400).json({ error: 'Se requiere usuarioId o email del destinatario' });
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(24).toString('hex');
    const expiracion = new Date(Date.now() + 3600000);

    await db.query(
      `INSERT INTO password_resets (email, token, expiracion) VALUES ($1, $2, $3)`,
      [targetEmail, token, expiracion]
    );

    const { sendPasswordResetEmail } = require('../utils/mailer.service');
    const mailResult = await sendPasswordResetEmail(targetEmail, token, targetNombre);

    res.json({
      mensaje: `Correo de restablecimiento enviado a ${targetEmail}`,
      simulado: !!mailResult.mock,
      details: mailResult.message,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  me,
  recuperarPassword,
  restablecerPassword,
  enviarResetAdmin,
};
