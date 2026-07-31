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

module.exports = {
  login,
  me,
};
