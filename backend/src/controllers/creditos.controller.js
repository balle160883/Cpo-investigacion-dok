const db = require('../../db');

/**
 * Obtener listado de créditos recientes para acceso rápido en el módulo
 */
async function getCreditosRecientes(req, res, next) {
  try {
    const query = `
      SELECT sc.id_sif, sc.folio, sc.monto_solicitado, sc.monto_aprobado, sc.producto_nombre,
             sc.tipo_producto, sc.sucursal_nombre, sc.dictamen_aptitud, sc.total_firmantes,
             sc.total_conyuges, sc.created_at,
             p.nombre_completo as titular_nombre
      FROM solicitudes_credito sc
      LEFT JOIN personas p ON sc.cliente_id_sif = p.id_sif
      WHERE sc.folio IS NOT NULL
      ORDER BY sc.created_at DESC NULLS LAST
      LIMIT 12;
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

/**
 * Búsqueda predictiva de solicitudes de crédito por folio o nombre del socio
 */
async function buscarCreditos(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const query = `
      SELECT sc.id_sif, sc.folio, sc.monto_solicitado, sc.monto_aprobado, sc.producto_nombre,
             sc.tipo_producto, sc.sucursal_nombre, sc.dictamen_aptitud, sc.total_firmantes,
             sc.total_conyuges, sc.created_at,
             p.nombre_completo as titular_nombre
      FROM solicitudes_credito sc
      LEFT JOIN personas p ON sc.cliente_id_sif = p.id_sif
      WHERE sc.folio ILIKE $1
         OR p.nombre_completo ILIKE $1
         OR CAST(sc.id_sif AS TEXT) = $2
      ORDER BY 
        CASE WHEN sc.folio ILIKE $1 THEN 1 ELSE 2 END,
        sc.created_at DESC NULLS LAST
      LIMIT 15;
    `;
    const searchPattern = `%${q}%`;
    const result = await db.query(query, [searchPattern, q]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

/**
 * Dictamen integral por Folio de Apertura de Crédito
 * Reúne Solicitud, Titular, Cónyuges, Avales, Firmantes, Evidencias e Historial de Otros Créditos
 */
async function getDictamenCredito(req, res, next) {
  try {
    const folioParam = (req.params.folio || '').trim();
    if (!folioParam) {
      return res.status(400).json({ error: 'Debes proporcionar un folio de crédito válido.' });
    }

    // 1. Obtener la Solicitud de Crédito
    const solRes = await db.query(`
      SELECT sc.*,
             p.nombre_completo as titular_nombre,
             p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido,
             p.curp as titular_curp,
             p.rfc as titular_rfc,
             p.telefono_principal as titular_telefono,
             p.celular as titular_celular,
             p.nivel_riesgo as titular_nivel_riesgo,
             d.calle as titular_calle,
             d.numero_exterior as titular_numero_exterior,
             d.numero_interior as titular_numero_interior,
             d.codigo_postal as titular_codigo_postal,
             d.colonia as titular_colonia,
             d.municipio as titular_municipio,
             d.estado_provincia as titular_estado_provincia,
             d.latitud as titular_latitud,
             d.longitud as titular_longitud
      FROM solicitudes_credito sc
      LEFT JOIN personas p ON sc.cliente_id_sif = p.id_sif
      LEFT JOIN direcciones d ON sc.direccion_id_sif = d.id_sif
      WHERE sc.folio ILIKE $1 OR CAST(sc.id_sif AS TEXT) = $1
      LIMIT 1;
    `, [folioParam]);

    if (solRes.rows.length === 0) {
      // Buscar si hay folios similares para sugerencias
      const sugerenciasRes = await db.query(`
        SELECT sc.folio, sc.producto_nombre, p.nombre_completo as titular_nombre
        FROM solicitudes_credito sc
        LEFT JOIN personas p ON sc.cliente_id_sif = p.id_sif
        WHERE sc.folio ILIKE $1 OR p.nombre_completo ILIKE $1
        LIMIT 5;
      `, [`%${folioParam}%`]);

      return res.status(404).json({
        error: `No se encontró ninguna apertura de crédito con el folio o ID "${folioParam}".`,
        sugerencias: sugerenciasRes.rows,
      });
    }

    const solicitud = solRes.rows[0];

    // 2. Obtener Firmantes Oficiales (Titular, Cónyuges, Avales, Cónyuges de Avales)
    const firmantesRes = await db.query(`
      SELECT sf.*,
             p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido,
             COALESCE(p.telefono_principal, p.celular, p.telefono) as telefono_contacto,
             p.celular, p.telefono, p.es_aval, p.es_conyuge,
             d.calle, d.numero_exterior, d.numero_interior, d.codigo_postal, d.colonia, d.municipio, d.estado_provincia,
             d.latitud, d.longitud
      FROM solicitud_firmantes sf
      LEFT JOIN personas p ON sf.persona_id_sif = p.id_sif
      LEFT JOIN LATERAL (
        SELECT d2.* FROM direcciones d2
        WHERE d2.persona_id_sif = sf.persona_id_sif
        ORDER BY COALESCE(d2.es_principal, false) DESC, d2.id_sif DESC
        LIMIT 1
      ) d ON TRUE
      WHERE sf.solicitud_id_sif = $1
      ORDER BY 
        CASE sf.rol
          WHEN 'TITULAR' THEN 1
          WHEN 'CONYUGE_TITULAR' THEN 2
          WHEN 'AVAL' THEN 3
          WHEN 'CONYUGE_AVAL' THEN 4
          ELSE 5
        END,
        sf.id ASC;
    `, [solicitud.id_sif]);

    let firmantes = firmantesRes.rows;

    // Si por alguna razón la solicitud no tiene registros en solicitud_firmantes (casos legacy),
    // creamos los registros base a partir de solicitudes_credito y solicitud_avales
    if (firmantes.length === 0) {
      const titularRow = {
        id: 0,
        solicitud_id_sif: solicitud.id_sif,
        persona_id_sif: solicitud.cliente_id_sif,
        nombre_completo: solicitud.titular_nombre,
        rol: 'TITULAR',
        debe_firmar: true,
        es_apto: true,
        motivo_inaptitud: null,
        nivel_riesgo: solicitud.titular_nivel_riesgo,
        curp: solicitud.titular_curp,
        rfc: solicitud.titular_rfc,
        ine_vigente: true,
        tiene_domicilio: Boolean(solicitud.titular_calle),
        tiene_expediente_digital: true,
        telefono_contacto: solicitud.titular_telefono,
        calle: solicitud.titular_calle,
        numero_exterior: solicitud.titular_numero_exterior,
        colonia: solicitud.titular_colonia,
        municipio: solicitud.titular_municipio,
        estado_provincia: solicitud.titular_estado_provincia,
      };
      firmantes.push(titularRow);

      const avalesLegacy = await db.query(`
        SELECT sa.aval_id_sif, sa.tipo_garantia_nombre,
               p.nombre_completo, p.curp, p.rfc, p.nivel_riesgo,
               COALESCE(p.telefono_principal, p.celular, p.telefono) as telefono_contacto,
               d.calle, d.numero_exterior, d.colonia, d.municipio, d.estado_provincia
        FROM solicitud_avales sa
        JOIN personas p ON sa.aval_id_sif = p.id_sif
        LEFT JOIN LATERAL (
          SELECT d2.* FROM direcciones d2
          WHERE d2.persona_id_sif = sa.aval_id_sif
          ORDER BY COALESCE(d2.es_principal, false) DESC, d2.id_sif DESC
          LIMIT 1
        ) d ON TRUE
        WHERE sa.solicitud_id_sif = $1;
      `, [solicitud.id_sif]);

      for (const av of avalesLegacy.rows) {
        firmantes.push({
          id: firmantes.length,
          solicitud_id_sif: solicitud.id_sif,
          persona_id_sif: av.aval_id_sif,
          nombre_completo: av.nombre_completo,
          rol: 'AVAL',
          debe_firmar: true,
          es_apto: true,
          motivo_inaptitud: null,
          nivel_riesgo: av.nivel_riesgo,
          curp: av.curp,
          rfc: av.rfc,
          ine_vigente: true,
          tiene_domicilio: Boolean(av.calle),
          tiene_expediente_digital: true,
          telefono_contacto: av.telefono_contacto,
          calle: av.calle,
          numero_exterior: av.numero_exterior,
          colonia: av.colonia,
          municipio: av.municipio,
          estado_provincia: av.estado_provincia,
        });
      }
    }

    // 3. Obtener Investigaciones y Evidencias de Campo vinculadas a esta Solicitud
    const invRes = await db.query(`
      SELECT inv.id_sif_research, inv.persona_id_sif, inv.tipo_sujeto, inv.estado,
             inv.estado_validacion, inv.fecha_cumplimiento, inv.fecha_validacion,
             inv.comentarios_validacion, inv.observaciones_sif,
             i.nombre as investigador_nombre,
             val.nombre as validador_nombre,
             ev.id as evidencia_id, ev.latitud_checkin, ev.longitud_checkin, ev.fecha_checkin,
             ev.estudio_socioeconomico, ev.fotos_urls, ev.firma_url, ev.firma_investigador_url,
             ev.notas_investigador
      FROM investigaciones inv
      LEFT JOIN investigadores i ON inv.investigador_id = i.id
      LEFT JOIN investigadores val ON inv.validador_id = val.id
      LEFT JOIN evidencias_visita ev ON CAST(ev.investigacion_id_sif AS TEXT) = CAST(inv.id_sif_research AS TEXT)
      WHERE inv.solicitud_id_sif = $1
      ORDER BY 
        CASE WHEN inv.tipo_sujeto = 'SOLICITANTE' THEN 1 ELSE 2 END,
        inv.id_sif_research ASC;
    `, [solicitud.id_sif]);

    const investigaciones = invRes.rows;

    // Mapear investigaciones por persona_id_sif para cruzar rápidamente
    const invPorPersona = {};
    for (const inv of investigaciones) {
      const pid = String(inv.persona_id_sif);
      if (!invPorPersona[pid]) {
        invPorPersona[pid] = inv;
      }
    }

    // 4. Para cada firmante, obtener su Historial de OTROS CRÉDITOS en Caja Popular Oblatos
    const firmantesConHistorial = await Promise.all(
      firmantes.map(async (f) => {
        const pid = f.persona_id_sif;
        let otrosCreditos = [];

        if (pid) {
          const otrosRes = await db.query(`
            SELECT DISTINCT sub.id_sif, sub.folio, sub.monto_solicitado, sub.monto_aprobado,
                   sub.estado_sif, sub.producto_nombre, sub.tipo_producto, sub.dictamen_aptitud,
                   sub.created_at, sub.rol_en_credito
            FROM (
              SELECT sc2.id_sif, sc2.folio, sc2.monto_solicitado, sc2.monto_aprobado, sc2.estado_sif,
                     sc2.producto_nombre, sc2.tipo_producto, sc2.dictamen_aptitud, sc2.created_at,
                     'TITULAR' as rol_en_credito
              FROM solicitudes_credito sc2
              WHERE sc2.cliente_id_sif = $1 AND sc2.id_sif != $2
              
              UNION ALL
              
              SELECT sc2.id_sif, sc2.folio, sc2.monto_solicitado, sc2.monto_aprobado, sc2.estado_sif,
                     sc2.producto_nombre, sc2.tipo_producto, sc2.dictamen_aptitud, sc2.created_at,
                     'AVAL' as rol_en_credito
              FROM solicitud_avales sa2
              JOIN solicitudes_credito sc2 ON sa2.solicitud_id_sif = sc2.id_sif
              WHERE sa2.aval_id_sif = $1 AND sc2.id_sif != $2

              UNION ALL

              SELECT sc2.id_sif, sc2.folio, sc2.monto_solicitado, sc2.monto_aprobado, sc2.estado_sif,
                     sc2.producto_nombre, sc2.tipo_producto, sc2.dictamen_aptitud, sc2.created_at,
                     sf2.rol as rol_en_credito
              FROM solicitud_firmantes sf2
              JOIN solicitudes_credito sc2 ON sf2.solicitud_id_sif = sc2.id_sif
              WHERE sf2.persona_id_sif = $1 AND sc2.id_sif != $2
            ) sub
            ORDER BY sub.created_at DESC NULLS LAST
            LIMIT 10;
          `, [pid, solicitud.id_sif]);

          otrosCreditos = otrosRes.rows;
        }

        // Vincular investigación y evidencia de visita correspondiente si existe
        const invVinculada = pid ? invPorPersona[String(pid)] : null;

        return {
          ...f,
          investigacion: invVinculada || null,
          otrosCreditos,
          total_otros_creditos: otrosCreditos.length,
          monto_total_otros_creditos: otrosCreditos.reduce((acc, curr) => acc + (Number(curr.monto_solicitado) || 0), 0),
        };
      })
    );

    // 5. Agrupación Jerárquica para la Vista Web
    const titular = firmantesConHistorial.find((f) => f.rol === 'TITULAR') || null;
    const conyugeTitular = firmantesConHistorial.find((f) => f.rol === 'CONYUGE_TITULAR') || null;
    const avales = firmantesConHistorial.filter((f) => f.rol === 'AVAL');
    const conyugesAvales = firmantesConHistorial.filter((f) => f.rol === 'CONYUGE_AVAL');

    // Mapear cada aval con su respectivo cónyuge (si existe)
    const avalesConConyuge = avales.map((av) => {
      // Buscar cónyuge vinculado por relacion_con_persona_id_sif o por orden
      const conyuge = conyugesAvales.find((ca) => String(ca.relacion_con_persona_id_sif) === String(av.persona_id_sif)) || null;
      return {
        ...av,
        conyuge,
      };
    });

    // 6. Análisis Integral de Semáforo de Aptitud
    const totalFirmantes = firmantesConHistorial.length;
    const firmantesInaptos = firmantesConHistorial.filter((f) => !f.es_apto);
    const firmantesObligadosSinFirmar = firmantesConHistorial.filter((f) => f.debe_firmar && f.investigacion && !f.investigacion.firma_url);
    const investigacionesCompletadas = investigaciones.filter((i) => ['COMPLETADA', 'VALIDADA', 'APROBADA_FINAL'].includes(i.estado)).length;
    const visitasPendientes = investigaciones.length > 0 ? (investigaciones.length - investigacionesCompletadas) : 0;

    let semaforoGlobal = 'APTO';
    let semaforoMotivos = [];

    if (firmantesInaptos.length > 0) {
      semaforoGlobal = 'NO_APTO';
      for (const fi of firmantesInaptos) {
        semaforoMotivos.push(`${fi.rol}: ${fi.nombre_completo} presenta inaptitud (${fi.motivo_inaptitud || 'Requisito no cumplido'}).`);
      }
    } else if (visitasPendientes > 0) {
      semaforoGlobal = 'ADVERTENCIA';
      semaforoMotivos.push(`Existen ${visitasPendientes} visita(s) de campo aún en proceso.`);
    } else if (firmantesObligadosSinFirmar.length > 0) {
      semaforoGlobal = 'ADVERTENCIA';
      semaforoMotivos.push('Faltan firmas autógrafas en una o más visitas concluidas.');
    } else {
      semaforoMotivos.push('100% de firmantes analizados cumplen con los criterios de aptitud.');
    }

    // Incorporar observaciones financieras normativas (Ahorro 12m, Morosidad, Retiros)
    if (solicitud.resumen_financiero) {
      const rfResumen = solicitud.resumen_financiero.resumen || {};
      if (solicitud.cumple_habito_ahorro === false || rfResumen.cumple_habito_ahorro === false) {
        const meses = rfResumen.meses_ahorro || (solicitud.resumen_financiero.titular?.meses_ahorro_cumplidos ? `${solicitud.resumen_financiero.titular.meses_ahorro_cumplidos}/12` : 'Incompleto');
        semaforoMotivos.push(`Hábito de Ahorro: Incumplimiento del depósito mensual mínimo de $50 pesos cada mes (Cumplió ${meses} meses).`);
      }
      if (solicitud.tiene_morosidad === true || rfResumen.tiene_morosidad_titular === true || (rfResumen.max_dias_mora_titular > 0)) {
        semaforoMotivos.push(`Historial de Morosidad: Se detectaron atrasos de hasta ${rfResumen.max_dias_mora_titular || 1} días en créditos anteriores.`);
      }
      if (Number(solicitud.total_retiros_12m || rfResumen.total_retiros_12m) > 0) {
        const cantRet = rfResumen.cantidad_retiros_12m || solicitud.resumen_financiero.titular?.cantidad_retiros_12m || 'varios';
        const montoRet = Number(solicitud.total_retiros_12m || rfResumen.total_retiros_12m || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
        semaforoMotivos.push(`Retiros de Ahorro: Registra ${cantRet} retiro(s) por un total de $${montoRet} en los últimos 12 meses.`);
      }
    }

    // Tomar dictamen previo si está fijado en solicitudes_credito
    const dictamenFinal = solicitud.dictamen_aptitud || semaforoGlobal;

    res.json({
      solicitud,
      semaforo: {
        resultado: dictamenFinal,
        motivos: semaforoMotivos,
        total_firmantes: totalFirmantes,
        total_inaptos: firmantesInaptos.length,
        total_conyuges: (conyugeTitular ? 1 : 0) + conyugesAvales.length,
        total_avales: avales.length,
        visitas_totales: investigaciones.length,
        visitas_completadas: investigacionesCompletadas,
      },
      titular,
      conyugeTitular,
      avales: avalesConConyuge,
      conyugesAvales,
      firmantes: firmantesConHistorial,
      investigaciones,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCreditosRecientes,
  buscarCreditos,
  getDictamenCredito,
};
