const db = require('./backend/db');

async function fixCases() {
  console.log('=== APLICANDO CORRECCIÓN DE CLIENTE Y AVALES EN LOS 3 FOLIOS ===\n');

  // CASO 1: Folio 40-314823
  // Solicitante Real: MARIA IMELDA GRIJALVA GRIJALVA (id_sif: 336560)
  // Avales: LUIS FERNANDO GRIJALVA GRIJALVA (id_sif: 585442), MAYRA LIZBETH RIVERA GRIJALVA (id_sif: 361951)
  console.log('1. Corrigiendo Folio 40-314823...');
  await db.query(`
    UPDATE solicitudes_credito 
    SET cliente_id_sif = 336560 
    WHERE folio = '40-314823';
  `);
  await db.query(`
    UPDATE personas SET es_aval = FALSE WHERE id_sif = 336560;
  `);
  await db.query(`
    UPDATE personas SET es_aval = TRUE WHERE id_sif = 585442;
  `);
  await db.query(`
    UPDATE investigaciones 
    SET tipo_sujeto = 'SOLICITANTE' 
    WHERE id_sif_research = 167761;
  `);
  await db.query(`
    UPDATE investigaciones 
    SET tipo_sujeto = 'AVAL' 
    WHERE id_sif_research = 167762;
  `);

  // CASO 2: Folio 5-314905
  // Solicitante Real: VIANETH ARACELY NUÑO ASCENCIO (id_sif: 793477)
  // Aval: LAURA ASCENCIO LEMUS (id_sif: 268101)
  console.log('2. Corrigiendo Folio 5-314905...');
  await db.query(`
    UPDATE solicitudes_credito 
    SET cliente_id_sif = 793477 
    WHERE folio = '5-314905';
  `);
  await db.query(`
    UPDATE personas SET es_aval = FALSE WHERE id_sif = 793477;
  `);
  await db.query(`
    UPDATE personas SET es_aval = TRUE WHERE id_sif = 268101;
  `);
  await db.query(`
    UPDATE investigaciones 
    SET tipo_sujeto = 'SOLICITANTE' 
    WHERE id_sif_research = 167801;
  `);
  await db.query(`
    UPDATE investigaciones 
    SET tipo_sujeto = 'AVAL' 
    WHERE id_sif_research = 167802;
  `);

  // CASO 3: Folio 9-314765
  // Solicitante Real: MARIO ALBERTO RAMIREZ ALVAREZ (id_sif: 513303)
  // Aval: RAMON RAMIREZ REYES (id_sif: 84806)
  console.log('3. Corrigiendo Folio 9-314765...');
  await db.query(`
    UPDATE solicitudes_credito 
    SET cliente_id_sif = 513303 
    WHERE folio = '9-314765';
  `);
  await db.query(`
    UPDATE personas SET es_aval = FALSE WHERE id_sif = 513303;
  `);
  await db.query(`
    UPDATE personas SET es_aval = TRUE WHERE id_sif = 84806;
  `);
  await db.query(`
    UPDATE investigaciones 
    SET tipo_sujeto = 'SOLICITANTE' 
    WHERE id_sif_research = 167710;
  `);
  await db.query(`
    UPDATE investigaciones 
    SET tipo_sujeto = 'AVAL' 
    WHERE id_sif_research = 167711;
  `);

  console.log('✅ Correcciones aplicadas exitosamente en la base de datos.');

  // Verificación final
  const folios = ['40-314823', '5-314905', '9-314765'];
  for (const fol of folios) {
    console.log(`\n--- VERIFICACIÓN POST-FIX FOLIO: ${fol} ---`);
    const sc = await db.query(
      `SELECT sc.folio, sc.cliente_id_sif, p.nombre_completo as solicitante 
       FROM solicitudes_credito sc 
       JOIN personas p ON sc.cliente_id_sif = p.id_sif 
       WHERE sc.folio = $1`,
      [fol]
    );
    console.log('Solicitud:', sc.rows[0]);

    const invs = await db.query(
      `SELECT inv.id_sif_research, inv.tipo_sujeto, p.nombre_completo, p.es_aval, inv.estado
       FROM investigaciones inv
       JOIN solicitudes_credito sc ON inv.solicitud_id_sif = sc.id_sif
       JOIN personas p ON inv.persona_id_sif = p.id_sif
       WHERE sc.folio = $1
       ORDER BY inv.id_sif_research ASC`,
      [fol]
    );
    console.log('Investigaciones:');
    for (const i of invs.rows) {
      console.log(`  * [${i.id_sif_research}] ${i.nombre_completo} -> TIPO: ${i.tipo_sujeto} (es_aval=${i.es_aval}) | Estado: ${i.estado}`);
    }
  }

  process.exit(0);
}

fixCases().catch(e => { console.error('Error aplicando corrección:', e); process.exit(1); });
