// Catálogo Real de Sucursales de Caja Popular Oblatos
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

  if (str.includes('-')) {
    const prefijo = str.split('-')[0].trim();
    if (SUCURSALES_MAP[prefijo]) {
      return SUCURSALES_MAP[prefijo];
    }
  }

  const soloNumero = str.replace(/\D/g, '');
  if (soloNumero && SUCURSALES_MAP[soloNumero]) {
    return SUCURSALES_MAP[soloNumero];
  }

  if (SUCURSALES_MAP[str]) {
    return SUCURSALES_MAP[str];
  }

  return `Sucursal ${str}`;
}

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
