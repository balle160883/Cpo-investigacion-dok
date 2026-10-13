const db = require('./backend/db');

async function diagnostico() {
  try {
    const folios = ['40-314823', '5-314905', '9-314765', '2-314481'];

    console.log('====================================================');
    console.log('       DIAGNÓSTICO DETALLADO DE LOS CASOS');
    console.log('====================================================\n');

    for (const fol of folios) {
      console.log(`\n>>>>>>>>>>>>>>>> FOLIO: ${fol} <<<<<<<<<<<<<<<<`);
      
      // 1. Buscar en solicitudes_credito
      const solRes = await db.query(
        `SELECT sc.*, p.nombre_completo as nombre_cliente, p.es_aval as cliente_es_aval
         FROM solicitudes_credito sc
         LEFT JOIN personas p ON sc.cliente_id_sif = p.id_sif
         WHERE sc.folio = $1`,
        [fol]
      );

      if (solRes.rows.length === 0) {
        console.log(`[!] No se encontró ninguna solicitud de crédito con folio '${fol}' en solicitudes_credito.`);
        
        // Buscar si existe el folio parcial o similar
        const folSim = await db.query(
          `SELECT sc.id_sif, sc.folio, p.nombre_completo 
           FROM solicitudes_credito sc 
           LEFT JOIN personas p ON sc.cliente_id_sif = p.id_sif
           WHERE sc.folio ILIKE $1 OR sc.folio ILIKE $2`,
          [`%${fol.split('-')[1] || fol}%`, `%${fol}%`]
        );
        console.log('  Búsqueda aproximada de folio similar:', folSim.rows);
      } else {
        const sol = solRes.rows[0];
        console.log(`SOLICITUD id_sif: ${sol.id_sif}`);
        console.log(`  Cliente_id_sif: ${sol.cliente_id_sif}`);
        console.log(`  Nombre Cliente: ${sol.nombre_cliente} (p.es_aval = ${sol.cliente_es_aval})`);
        console.log(`  Monto Solicitado: ${sol.monto_solicitado}, Sucursal: ${sol.sucursal_id}, Estado SIF: ${sol.estado_sif}`);

        // 2. Avales en solicitud_avales
        const avalesRes = await db.query(
          `SELECT sa.*, p.nombre_completo, p.es_aval
           FROM solicitud_avales sa
           LEFT JOIN personas p ON sa.aval_id_sif = p.id_sif
           WHERE sa.solicitud_id_sif = $1`,
          [sol.id_sif]
        );
        console.log(`\n  AVALES REGISTRADOS (${avalesRes.rows.length}):`);
        for (const a of avalesRes.rows) {
          console.log(`    - Aval ID SIF: ${a.aval_id_sif}, Nombre: ${a.nombre_completo}, Tipo: ${a.tipo_garantia_nombre}, p.es_aval=${a.es_aval}`);
        }

        // 3. Investigaciones asociadas a esta solicitud
        const invRes = await db.query(
          `SELECT inv.id_sif_research, inv.solicitud_id_sif, inv.persona_id_sif, 
                  inv.tipo_sujeto, inv.estado, inv.investigador_id,
                  p.nombre_completo, p.es_aval,
                  i.nombre as nombre_investigador
           FROM investigaciones inv
           LEFT JOIN personas p ON inv.persona_id_sif = p.id_sif
           LEFT JOIN investigadores i ON inv.investigador_id = i.id
           WHERE inv.solicitud_id_sif = $1`,
          [sol.id_sif]
        );
        console.log(`\n  INVESTIGACIONES GENERADAS (${invRes.rows.length}):`);
        for (const inv of invRes.rows) {
          console.log(`    * [ID ${inv.id_sif_research}] persona_id_sif: ${inv.persona_id_sif} -> ${inv.nombre_completo}`);
          console.log(`      tipo_sujeto en inv: '${inv.tipo_sujeto}', p.es_aval: ${inv.es_aval}`);
          console.log(`      estado: ${inv.estado}, investigador: ${inv.nombre_investigador} (ID: ${inv.investigador_id})`);
        }
      }
    }

    // Caso especial: Buscar a Leonardo Gutierrez Orozco en toda la base de datos
    console.log('\n====================================================');
    console.log('    BÚSQUEDA DE "GUTIERREZ OROZCO LEONARDO"');
    console.log('====================================================');
    const pers = await db.query(
      `SELECT * FROM personas 
       WHERE nombre_completo ILIKE '%LEONARDO%' 
          OR nombre_completo ILIKE '%GUTIERREZ%OROZCO%'`
    );
    console.log(`Personas encontradas (${pers.rows.length}):`);
    for (const p of pers.rows) {
      console.log(`\n- ID SIF: ${p.id_sif} | Nombre: ${p.nombre_completo} | es_aval: ${p.es_aval}`);
      
      // Ver si tiene solicitudes de crédito
      const pSols = await db.query(
        `SELECT sc.* FROM solicitudes_credito sc WHERE sc.cliente_id_sif = $1`,
        [p.id_sif]
      );
      for (const sc of pSols.rows) {
        console.log(`   -> Solicitud como Cliente: ID SIF: ${sc.id_sif}, Folio: ${sc.folio}, Monto: ${sc.monto_solicitado}`);
      }

      // Ver si es aval en alguna solicitud
      const pAvals = await db.query(
        `SELECT sa.*, sc.folio FROM solicitud_avales sa 
         JOIN solicitudes_credito sc ON sa.solicitud_id_sif = sc.id_sif
         WHERE sa.aval_id_sif = $1`,
        [p.id_sif]
      );
      for (const sa of pAvals.rows) {
        console.log(`   -> Aval en Solicitud: ID SIF: ${sa.solicitud_id_sif}, Folio: ${sa.folio}`);
      }

      // Ver investigaciones
      const pInvs = await db.query(
        `SELECT inv.*, sc.folio, i.nombre as nombre_investigador 
         FROM investigaciones inv
         LEFT JOIN solicitudes_credito sc ON inv.solicitud_id_sif = sc.id_sif
         LEFT JOIN investigadores i ON inv.investigador_id = i.id
         WHERE inv.persona_id_sif = $1`,
        [p.id_sif]
      );
      for (const inv of pInvs.rows) {
        console.log(`   -> Investigacion ID ${inv.id_sif_research}: Folio: ${inv.folio}, tipo_sujeto: '${inv.tipo_sujeto}', estado: ${inv.estado}, investigador: ${inv.nombre_investigador} (ID: ${inv.investigador_id})`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error en diagnostico:', err);
    process.exit(1);
  }
}

diagnostico();
