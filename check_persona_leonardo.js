const db = require('./backend/db');

async function checkPerson() {
  const pId = 181319;
  console.log('--- SOLICITUDES DONDE 181319 ES CLIENTE ---');
  const sc = await db.query('SELECT * FROM solicitudes_credito WHERE cliente_id_sif = $1', [pId]);
  console.log(sc.rows);

  console.log('--- SOLICITUD_AVALES DONDE 181319 ES AVAL ---');
  const sa = await db.query(
    `SELECT sa.*, sc.folio 
     FROM solicitud_avales sa 
     JOIN solicitudes_credito sc ON sa.solicitud_id_sif = sc.id_sif 
     WHERE sa.aval_id_sif = $1`, 
    [pId]
  );
  console.log(sa.rows);

  console.log('--- INVESTIGACIONES DONDE 181319 ES EL SUJETO ---');
  const inv = await db.query(
    `SELECT inv.id_sif_research, inv.solicitud_id_sif, sc.folio, inv.tipo_sujeto, 
            inv.estado, inv.investigador_id, i.nombre as nombre_investigador 
     FROM investigaciones inv 
     LEFT JOIN solicitudes_credito sc ON inv.solicitud_id_sif = sc.id_sif 
     LEFT JOIN investigadores i ON inv.investigador_id = i.id 
     WHERE inv.persona_id_sif = $1`, 
    [pId]
  );
  console.log(inv.rows);

  process.exit(0);
}

checkPerson().catch(e => { console.error(e); process.exit(1); });
