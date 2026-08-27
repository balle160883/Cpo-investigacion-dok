// Catálogo Completo de Sucursales de Caja Popular Oblatos (1 al 54)
const SUCURSALES_MAP = {
  '1': 'Matriz Oblatos',
  '01': 'Matriz Oblatos',
  '2': 'Tetlán',
  '02': 'Tetlán',
  '3': 'Tlaquepaque',
  '03': 'Tlaquepaque',
  '4': 'Zapopan',
  '04': 'Zapopan',
  '5': 'Tonalá',
  '05': 'Tonalá',
  '6': 'Tlajomulco',
  '06': 'Tlajomulco',
  '7': 'San Gaspar',
  '07': 'San Gaspar',
  '8': 'Huentitán',
  '08': 'Huentitán',
  '9': 'Echeverría',
  '09': 'Echeverría',
  '10': 'El Colli',
  '11': 'Tesistán',
  '12': 'Federalismo',
  '13': 'Oblatos',
  '14': 'El Salto',
  '15': 'Lomas del Camichín',
  '16': 'Santa Margarita',
  '17': 'Santa Cecilia',
  '18': 'Lomas de Polanco',
  '19': 'Arboledas',
  '20': 'Miravalle',
  '21': 'Las Pintas',
  '22': 'Santa Fe',
  '23': 'Toluquilla',
  '24': 'Belenes',
  '25': 'San Juan de Dios',
  '26': 'Tabachines',
  '27': 'Ciudad Aztlán',
  '28': 'San Agustín',
  '29': 'El Salto Centro',
  '30': 'Jocotepec',
  '31': 'Chapala',
  '32': 'Ixtlahuacán',
  '33': 'Zapotlanejo',
  '34': 'San Gaspar Oriente',
  '35': 'Lomas del Camichín Sur',
  '36': 'Tlaquepaque Centro',
  '37': 'Tonalá Centro',
  '38': 'Belenes Norte',
  '39': 'Plaza Patria',
  '40': 'Las Pintas Sur',
  '41': 'Polanco',
  '42': 'Oblatos Sur',
  '43': 'Providencia',
  '44': 'Río Nilo',
  '45': 'Toluquilla Sur',
  '46': 'Arboledas Sur',
  '47': 'Bugambilias',
  '48': 'Santa Ana Tepetitlán',
  '49': 'Tala',
  '50': 'Ameca',
  '51': 'Chulavista',
  '52': 'Santa Fe Sur',
  '53': 'Santa Cruz de las Flores',
  '54': 'Santa Margarita Norte'
};

/**
 * Retorna el nombre limpio de la sucursal ocultando el número ID.
 * Ejemplos:
 * - 25                      => "San Juan de Dios"
 * - 13                      => "Oblatos"
 * - "Sucursal 25"           => "San Juan de Dios"
 * - "Sucursal 13 (Oblatos)" => "Oblatos"
 */
export function formatNombreSucursal(val) {
  if (!val && val !== 0) return 'Matriz Oblatos';
  const str = String(val).trim();

  // Si contiene paréntesis con el nombre, extraer lo de adentro del paréntesis
  const matchParentesis = str.match(/\(([^)]+)\)/);
  if (matchParentesis && matchParentesis[1].trim()) {
    return matchParentesis[1].trim();
  }

  // Extraer solo dígitos de la cadena si viene como "Sucursal 25"
  const soloNumero = str.replace(/\D/g, '');
  if (soloNumero && SUCURSALES_MAP[soloNumero]) {
    return SUCURSALES_MAP[soloNumero];
  }

  // Si está en el mapa por ID
  if (SUCURSALES_MAP[str]) {
    return SUCURSALES_MAP[str];
  }

  // Si la cadena contiene texto mezclado (ej. "Sucursal Oblatos" o "13 - Oblatos")
  let limpio = str
    .replace(/^sucursal\s*/i, '')
    .replace(/^\d+\s*[-–:]*\s*/, '')
    .trim();

  if (limpio && !/^\d+$/.test(limpio)) {
    return limpio;
  }

  // Si solo era un número no mapeado
  return `Sucursal ${str}`;
}

/**
 * Determina de forma robusta si un registro u objeto corresponde a un Aval.
 * Evalúa múltiples propiedades habituales (es_aval booleano/cadena, tipo_sujeto, tipo).
 *
 * @param {Object|string} item
 * @returns {boolean}
 */
export function esAval(item) {
  if (!item) return false;
  if (typeof item === 'string') {
    const s = item.toUpperCase().trim();
    return s.includes('AVAL') || s === 'AVL';
  }
  if (item.es_aval === true || item.es_aval === 't' || item.es_aval === 1 || item.es_aval === 'true') {
    return true;
  }
  const tipo = (item.tipo_sujeto || item.tipo || item.sujeto_tipo || '').toUpperCase().trim();
  if (tipo.includes('AVAL') || tipo === 'AVL') {
    return true;
  }
  return false;
}

/**
 * Retorna la etiqueta formal del sujeto: "Aval" o "Solicitante".
 *
 * @param {Object|string} item
 * @returns {"Aval" | "Solicitante"}
 */
export function getEtiquetaSujeto(item) {
  return esAval(item) ? 'Aval' : 'Solicitante';
}

/**
 * Retorna la etiqueta formal en mayúsculas: "AVAL" o "SOLICITANTE".
 *
 * @param {Object|string} item
 * @returns {"AVAL" | "SOLICITANTE"}
 */
export function getEtiquetaSujetoUpper(item) {
  return esAval(item) ? 'AVAL' : 'SOLICITANTE';
}

/**
 * Retorna propiedades de estilo visual y badges para Solicitante vs Aval.
 *
 * @param {Object|string} item
 * @returns {{ label: string, shortLabel: string, icon: string, badgeClass: string, textClass: string, borderClass: string, bgClass: string }}
 */
export function getBadgeSujetoProps(item) {
  const aval = esAval(item);
  if (aval) {
    return {
      label: 'Aval',
      shortLabel: 'AVL',
      fullLabel: '🤝 Aval de Crédito',
      icon: '🤝',
      badgeClass: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
      badgeClassSolid: 'bg-purple-600 text-white',
      badgePrintClass: 'bg-purple-100 text-purple-900 border-purple-400',
      textClass: 'text-purple-400',
      borderClass: 'border-purple-500/30',
      bgClass: 'bg-purple-500/10',
    };
  }
  return {
    label: 'Solicitante',
    shortLabel: 'SOL',
    fullLabel: '👤 Solicitante de Préstamo',
    icon: '👤',
    badgeClass: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
    badgeClassSolid: 'bg-sky-600 text-white',
    badgePrintClass: 'bg-sky-100 text-sky-900 border-sky-400',
    textClass: 'text-sky-400',
    borderClass: 'border-sky-500/30',
    bgClass: 'bg-sky-500/10',
  };
}
