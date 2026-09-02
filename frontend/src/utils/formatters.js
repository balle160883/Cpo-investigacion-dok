// Catálogo Real de Sucursales de Caja Popular Oblatos obtenido directamente de la Base de Datos PostgreSQL
export const SUCURSALES_MAP = {
  '1': 'Matriz',
  '01': 'Matriz',
  '2': 'Jalisco',
  '02': 'Jalisco',
  '3': 'XI de Mayo',
  '03': 'XI de Mayo',
  '4': 'Santo Santiago',
  '04': 'Santo Santiago',
  '5': 'San Marcos',
  '05': 'San Marcos',
  '6': 'Heliodoro Hernández Loza',
  '06': 'Heliodoro Hernández Loza',
  '7': 'Alamedas',
  '07': 'Alamedas',
  '8': 'Margarita Maza de Juárez',
  '08': 'Margarita Maza de Juárez',
  '9': 'Joaquín Amaro',
  '09': 'Joaquín Amaro',
  '10': 'Mazamitla',
  '11': 'Zapopan',
  '12': 'Lomas de San Miguel',
  '13': 'Talpita',
  '14': 'Los Altos',
  '15': 'Concepción de Buenos Aires',
  '16': 'Ixtlahuacán del Río',
  '17': 'Santa Fe',
  '18': 'Aguascalientes',
  '19': 'San Isidro',
  '20': 'Cuquío',
  '21': 'Poncitlán',
  '22': 'Loreto',
  '23': 'El Colli',
  '24': 'Teocuitatlán',
  '25': 'Hermosa Provincia',
  '26': 'Ixtlahuacán de los Membrillos',
  '27': 'El Salto',
  '28': 'Agua Blanca',
  '29': 'Tulipanes',
  '30': 'El Briseño',
  '31': 'Tres Arcángeles',
  '32': 'San Luis Soyatlán',
  '33': 'Concordia',
  '34': 'Huajote',
  '35': 'Industria',
  '36': 'Centro Joyero',
  '37': 'Polanco',
  '38': 'Tepeyac',
  '39': 'Río Verde',
  '40': 'Rosamorada',
  '41': 'Tuxpan',
  '42': 'Río Presidio',
  '43': 'Mazatlán',
  '44': 'La Cruz',
  '45': 'Guamúchil',
  '46': 'Guasave',
  '47': 'Los Mochis',
  '48': 'Navojoa',
  '49': 'Tabachines',
  '50': 'Zapotiltic',
  '51': 'Acaponeta',
  '52': 'Arcos de Zapopan',
  '53': 'Tesistán',
  '54': 'Tepic',
  '55': 'Santa Cruz del Valle',
  '56': 'Santa Tere'
};

/**
 * Retorna el nombre real y limpio de la sucursal.
 * Soporta tanto sucursal_id como sucursal_nombre y folios "9-309022".
 */
export function formatNombreSucursal(val, nombreDirecto) {
  if (nombreDirecto && typeof nombreDirecto === 'string' && nombreDirecto.trim()) {
    const raw = nombreDirecto.trim();
    if (raw.toUpperCase() === 'MATRIZ') return 'Matriz';
    if (raw.toUpperCase() === 'XI DE MAYO') return 'XI de Mayo';
    return raw
      .toLowerCase()
      .split(' ')
      .map((w, idx) => (idx > 0 && ['de', 'del', 'la', 'las', 'los', 'el', 'y', 'o', 'san'].includes(w)) ? w : (w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ');
  }

  if (!val && val !== 0) return 'Matriz';
  const str = String(val).trim();

  // Si contiene el folio con prefijo "9-309022"
  if (str.includes('-')) {
    const prefijo = str.split('-')[0].trim();
    if (SUCURSALES_MAP[prefijo]) {
      return SUCURSALES_MAP[prefijo];
    }
  }

  // Extraer solo dígitos de la cadena si viene como número
  const soloNumero = str.replace(/\D/g, '');
  if (soloNumero && SUCURSALES_MAP[soloNumero]) {
    return SUCURSALES_MAP[soloNumero];
  }

  if (SUCURSALES_MAP[str]) {
    return SUCURSALES_MAP[str];
  }

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

/**
 * Mapeo de Zonas Horarias por Sucursal / Estado en México:
 * - Zona Pacífico (UTC-7): Sinaloa, Sonora, Nayarit
 * - Zona Centro (UTC-6): Jalisco, Aguascalientes, Michoacán, Guanajuato, etc.
 */
export const SUCURSAL_TIMEZONE_MAP = {
  // Nayarit
  '40': 'America/Mazatlan', // Rosamorada
  '51': 'America/Mazatlan', // Acaponeta
  '54': 'America/Mazatlan', // Tepic
  // Sinaloa
  '42': 'America/Mazatlan', // Río Presidio
  '43': 'America/Mazatlan', // Mazatlán
  '44': 'America/Mazatlan', // La Cruz
  '45': 'America/Mazatlan', // Guamúchil
  '46': 'America/Mazatlan', // Guasave
  '47': 'America/Mazatlan', // Los Mochis
  // Sonora
  '48': 'America/Hermosillo', // Navojoa
};

export function getTimezonePorSucursal(sucursalId) {
  if (!sucursalId) return 'America/Mexico_City';
  const idStr = String(sucursalId).replace(/\D/g, '');
  return SUCURSAL_TIMEZONE_MAP[idStr] || 'America/Mexico_City';
}

/**
 * Formatea de forma precisa la fecha y hora de captura de la sucursal,
 * respetando la zona horaria del estado donde se ubica la sucursal (Centro o Pacífico).
 */
export function formatFechaHoraCaptura(fechaRaw, sucursalId) {
  if (!fechaRaw) return 'Sin fecha';
  try {
    const d = new Date(fechaRaw);
    if (isNaN(d.getTime())) return 'Fecha inválida';

    const tz = getTimezonePorSucursal(sucursalId);
    return d.toLocaleString('es-MX', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (e) {
    return String(fechaRaw);
  }
}

