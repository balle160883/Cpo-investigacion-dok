const { createWorker } = require('tesseract.js');

/**
 * Parsea el texto extraído del INE mexicano y retorna los campos estructurados.
 * El INE frontal tiene estas secciones clave:
 * - APELLIDO PATERNO / APELLIDO MATERNO / NOMBRE(S)
 * - DOMICILIO: Calle Núm. Col. Mpio. Estado CP
 * - CURP: 18 chars alfanumérico
 * - CLAVE DE ELECTOR / CIC: alfanumérico
 * - AÑO DE REGISTRO: AAAA
 * - VIGENCIA: hasta AAAA
 * - SEXO: H o M
 * - FECHA DE NACIMIENTO: DD/MMM/AAAA
 */
function parsearINE(texto) {
  const lineas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const resultado = {
    curp: null,
    clave_elector: null,
    folio_cic: null,
    nombre_completo: null,
    apellido_paterno: null,
    apellido_materno: null,
    nombres: null,
    fecha_nacimiento: null,
    sexo: null,
    domicilio: null,
    calle: null,
    numero_exterior: null,
    colonia: null,
    municipio: null,
    estado: null,
    codigo_postal: null,
    ocr_raw_text: texto,
  };

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const lineaUp = linea.toUpperCase();

    // --- CURP (18 chars exactos: 4 letras + 6 números + 6 letras + 2 alfanumérico) ---
    const matchCurp = linea.match(/\b([A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d)\b/i);
    if (matchCurp && !resultado.curp) {
      resultado.curp = matchCurp[1].toUpperCase();
    }

    // --- Clave de Elector (18 chars alfanumérico sin vocales en primeros 6) ---
    const matchClave = linea.match(/\b([A-Z]{6}\d{8}[A-Z]\d{3})\b/i);
    if (matchClave && !resultado.clave_elector) {
      resultado.clave_elector = matchClave[1].toUpperCase();
    }

    // --- Folio CIC / OCR (13 dígitos numéricos) ---
    const matchCIC = linea.match(/\b(\d{13})\b/);
    if (matchCIC && !resultado.folio_cic) {
      resultado.folio_cic = matchCIC[1];
    }

    // --- Fecha de Nacimiento DD/MM/AAAA o DD/MON/AAAA ---
    const matchFecha = linea.match(/(\d{2})[\/\-]([A-Z]{3}|\d{2})[\/\-](\d{4})/i);
    if (matchFecha && !resultado.fecha_nacimiento) {
      resultado.fecha_nacimiento = linea.match(/\d{2}[\/\-][A-Z0-9]{2,3}[\/\-]\d{4}/i)?.[0] || null;
    }

    // --- Sexo: línea que sea solo H o M (o HOMBRE/MUJER) ---
    if (!resultado.sexo && /^\s*(H|M|HOMBRE|MUJER)\s*$/i.test(linea)) {
      resultado.sexo = linea.trim().startsWith('H') ? 'H' : 'M';
    }

    // --- Domicilio: detectar por palabras clave comunes ---
    const esDomicilio =
      lineaUp.includes('CALLE') ||
      lineaUp.includes('COL.') ||
      lineaUp.includes('COLONIA') ||
      lineaUp.includes('C.P.') ||
      lineaUp.includes('NUM.') ||
      lineaUp.match(/\bNo\.\s*\d/);

    if (esDomicilio && !resultado.domicilio) {
      // Capturar hasta 3 líneas del domicilio
      const bloqueDom = lineas.slice(i, i + 4).join(' ').replace(/\s+/g, ' ').trim();
      resultado.domicilio = bloqueDom;

      // CP: 5 dígitos precedidos por "C.P." o solos en el texto del domicilio
      const matchCP = bloqueDom.match(/C\.P\.?\s*(\d{5})|(?<!\d)(\d{5})(?!\d)/);
      if (matchCP) resultado.codigo_postal = matchCP[1] || matchCP[2];

      // Colonia: después de "COL." o "COLONIA"
      const matchCol = bloqueDom.match(/COL(?:ONIA)?\.?\s+([A-ZÁÉÍÓÚÑ\s]{3,40}?)(?=\s+[A-Z]{2,}|$|,)/i);
      if (matchCol) resultado.colonia = matchCol[1].trim();
    }

    // --- Nombre: en INE aparece como APELLIDO_PAT APELLIDO_MAT NOMBRE en líneas separadas ---
    // Las líneas de nombre son todo en mayúsculas, más de 3 chars, sin números
    if (
      /^[A-ZÁÉÍÓÚÑ\s]{4,40}$/.test(lineaUp) &&
      !resultado.curp?.includes(linea.slice(0, 4)) &&
      !esDomicilio &&
      !['MEXICO', 'ESTADOS UNIDOS MEXICANOS', 'INSTITUTO NACIONAL ELECTORAL',
        'CREDENCIAL PARA VOTAR', 'ORGANO SUPERIOR DE DIRECCION'].some((s) => lineaUp.includes(s))
    ) {
      // Primera línea = apellido paterno, segunda = materno, tercera = nombre(s)
      if (!resultado.apellido_paterno) {
        resultado.apellido_paterno = linea.trim();
      } else if (!resultado.apellido_materno) {
        resultado.apellido_materno = linea.trim();
      } else if (!resultado.nombres) {
        resultado.nombres = linea.trim();
      }
    }
  }

  // Construir nombre completo
  if (resultado.apellido_paterno) {
    const partes = [resultado.apellido_paterno, resultado.apellido_materno, resultado.nombres].filter(Boolean);
    resultado.nombre_completo = partes.join(' ');
  }

  return resultado;
}

/**
 * POST /api/ocr/ine
 * Recibe { imagen_base64: "data:image/jpeg;base64,..." } y retorna campos del INE.
 */
async function escanearINE(req, res, next) {
  let worker = null;
  try {
    const { imagen_base64 } = req.body;

    if (!imagen_base64) {
      return res.status(400).json({ error: 'Se requiere el campo imagen_base64 con la foto del INE.' });
    }

    // Eliminar prefijo data URL si existe y convertir a Buffer
    const base64Data = imagen_base64.replace(/^data:image\/\w+;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');

    // Inicializar worker de Tesseract con idioma español
    worker = await createWorker('spa', 1, {
      logger: () => {}, // Silenciar logs internos
    });

    // Ejecutar OCR sobre el buffer de imagen
    const { data: { text } } = await worker.recognize(imgBuffer);

    // Parsear el texto con el parser especializado de INE
    const camposINE = parsearINE(text);

    res.json({
      success: true,
      campos: camposINE,
      texto_crudo: text, // Útil para debug si el parser falla
    });
  } catch (err) {
    next(err);
  } finally {
    if (worker) {
      await worker.terminate().catch(() => {});
    }
  }
}

module.exports = { escanearINE };
