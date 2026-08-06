// Catálogo de Sucursales de Caja Oblatos
const SUCURSALES_MAP = {
  '1': 'Matriz',
  '01': 'Matriz',
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
  '13': 'Oblatos',
  '42': 'Oblatos Sur',
  '29': 'El Salto',
  '35': 'Lomas del Camichín',
  '54': 'Santa Margarita',
  '34': 'San Gaspar',
  '51': 'Chulavista',
  '41': 'Lomas de Polanco',
  '46': 'Arboledas',
  '40': 'Las Pintas',
  '52': 'Santa Fe',
  '20': 'Miravalle',
  '45': 'Toluquilla',
  '38': 'Belenes',
  '17': 'Santa Cecilia',
  '43': 'Providencia'
};

/**
 * Retorna el nombre limpio de la sucursal ocultando el número.
 * Ejemplos:
 * - "Sucursal 13 (Oblatos)" => "Oblatos"
 * - "13 (Oblatos)"          => "Oblatos"
 * - "13"                    => "Oblatos"
 * - "1"                     => "Matriz"
 */
export function formatNombreSucursal(val) {
  if (!val && val !== 0) return 'Matriz';
  const str = String(val).trim();

  // Si contiene paréntesis con el nombre, extraer lo de adentro del paréntesis
  const matchParentesis = str.match(/\(([^)]+)\)/);
  if (matchParentesis && matchParentesis[1].trim()) {
    return matchParentesis[1].trim();
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

  // Si solo era un número que no está en el mapa
  return `Sucursal ${str}`;
}
