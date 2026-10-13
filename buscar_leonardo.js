const db = require('./backend/db');

async function findLeo() {
  const q = `
    SELECT id_sif, nombre_completo, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, es_aval
    FROM personas
    WHERE (primer_nombre ILIKE '%LEONARDO%' OR segundo_nombre ILIKE '%LEONARDO%' OR nombre_completo ILIKE '%LEONARDO%')
      AND (primer_apellido ILIKE '%GUTIERREZ%' OR segundo_apellido ILIKE '%GUTIERREZ%' 
           OR primer_apellido ILIKE '%OROZCO%' OR segundo_apellido ILIKE '%OROZCO%'
           OR nombre_completo ILIKE '%GUTIERREZ%OROZCO%');
  `;
  const res = await db.query(q);
  console.log('Resultados exactos para Leonardo Gutierrez/Orozco (' + res.rows.length + '):');
  for (const r of res.rows) {
    console.log(r);
  }
  process.exit(0);
}
findLeo().catch(e => { console.error(e); process.exit(1); });
