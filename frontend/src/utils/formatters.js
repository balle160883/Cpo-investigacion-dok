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
