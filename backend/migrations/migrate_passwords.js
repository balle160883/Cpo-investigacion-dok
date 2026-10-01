const db = require('../db');
const bcrypt = require('bcryptjs');

async function migrate() {
  try {
    console.log('1. Agregando columna debe_cambiar_password...');
    await db.query('ALTER TABLE investigadores ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN DEFAULT FALSE;');

    console.log('2. Hasheando Seguridad2026@...');
    const hashed = await bcrypt.hash('Seguridad2026@', 10);

    console.log('3. Actualizando usuarios excepto jbb16 / id=1...');
    const result = await db.query(
      `UPDATE investigadores 
       SET password = $1, debe_cambiar_password = TRUE 
       WHERE id != 1 AND LOWER(email) != 'ing.ballesteros16@gmail.com' AND LOWER(nombre) != 'jbb16'
       RETURNING id, nombre, email, rol, debe_cambiar_password;`,
      [hashed]
    );

    console.log(`Se actualizaron ${result.rowCount} usuarios:`);
    result.rows.forEach(u => {
      console.log(` - [ID ${u.id}] ${u.nombre} (${u.email}) -> debe_cambiar_password: ${u.debe_cambiar_password}`);
    });

    console.log('\n4. Verificando usuario jbb16:');
    const { rows: adminRows } = await db.query(
      "SELECT id, nombre, email, rol, debe_cambiar_password FROM investigadores WHERE id = 1 OR LOWER(email) = 'ing.ballesteros16@gmail.com';"
    );
    console.log(adminRows);

    process.exit(0);
  } catch (err) {
    console.error('Error durante migración:', err);
    process.exit(1);
  }
}

migrate();
