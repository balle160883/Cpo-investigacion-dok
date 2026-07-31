import { Platform, Linking, Alert } from 'react-native';

/**
 * Convierte un objeto de investigación en una dirección formateada limpia para Google Maps / Waze
 */
export function construirQueryDireccion(item) {
  if (!item) return 'Guadalajara, Jalisco, Mexico';
  const partes = [
    item.calle ? `${item.calle} ${item.numero_exterior || ''}`.trim() : null,
    item.colonia ? `Col. ${item.colonia}` : null,
    item.municipio || 'Guadalajara',
    item.estado_provincia || 'Jalisco',
    'Mexico',
  ].filter(Boolean);
  return partes.join(', ');
}

/**
 * Revisa si las coordenadas registradas son numéricamente válidas
 */
export function tieneCoordenadasValidas(item) {
  if (!item) return false;
  const lat = Number(item.latitud);
  const lng = Number(item.longitud);
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    Math.abs(lat) > 0.001 &&
    Math.abs(lng) > 0.001
  );
}

/**
 * Geocodificación Automática de respaldo (Nominatim OpenStreetMap)
 */
export async function obtenerCoordenadas(item) {
  if (tieneCoordenadasValidas(item)) {
    return { lat: Number(item.latitud), lng: Number(item.longitud) };
  }

  const query = construirQueryDireccion(item);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CPO-Investigaciones-Mobile/1.0' },
    });
    const data = await res.json();

    if (data && data.length > 0 && data[0].lat && data[0].lon) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch (err) {
    console.log('[GEOCODE] Error obteniendo coordenadas:', err);
  }

  return null;
}

/**
 * Abrir aplicación Nativa de Google Maps en modo Navegación Estilo Uber (por Coordenadas o Dirección)
 */
export async function abrirGoogleMapsNativo(item) {
  const coords = await obtenerCoordenadas(item);
  const query = construirQueryDireccion(item);

  let targetParam = '';
  if (coords) {
    targetParam = `${coords.lat},${coords.lng}`;
  } else {
    targetParam = encodeURIComponent(query);
  }

  let url = '';
  if (Platform.OS === 'android') {
    // google.navigation abre la App nativa de Google Maps directamente en Turn-by-Turn GPS
    url = `google.navigation:q=${targetParam}`;
  } else {
    // iOS: comgooglemaps abre la App nativa en iPhone
    url = `comgooglemaps://?daddr=${targetParam}&directionsmode=driving`;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      // Fallback intent si la URL nativa directa no responde
      const fallbackUrl =
        Platform.OS === 'android'
          ? `geo:0,0?q=${targetParam}`
          : `maps://?daddr=${targetParam}`;
      
      const canFallback = await Linking.canOpenURL(fallbackUrl);
      if (canFallback) {
        await Linking.openURL(fallbackUrl);
      } else {
        // Fallback universal HTTPS (abre la app Google Maps instalada o el navegador)
        await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${targetParam}&travelmode=driving`);
      }
    }
  } catch (err) {
    // Fallback de emergencia universal para nunca bloquear al usuario
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=driving`).catch(() => {
      Alert.alert('Error', 'No se pudo abrir la navegación de Google Maps');
    });
  }
}

/**
 * Abrir aplicación Nativa de Waze en modo Navegación Estilo Uber (por Coordenadas o Dirección)
 */
export async function abrirWazeNativo(item) {
  const coords = await obtenerCoordenadas(item);
  const query = construirQueryDireccion(item);

  let nativeUrl = '';
  let webFallbackUrl = '';

  if (coords) {
    nativeUrl = `waze://?ll=${coords.lat},${coords.lng}&navigate=yes`;
    webFallbackUrl = `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`;
  } else {
    nativeUrl = `waze://?q=${encodeURIComponent(query)}&navigate=yes`;
    webFallbackUrl = `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
  }

  try {
    const canOpen = await Linking.canOpenURL(nativeUrl);
    if (canOpen) {
      await Linking.openURL(nativeUrl);
    } else {
      await Linking.openURL(nativeUrl).catch(async () => {
        await Linking.openURL(webFallbackUrl);
      });
    }
  } catch (err) {
    Linking.openURL(webFallbackUrl).catch(() => {
      Alert.alert('Error', 'No se pudo abrir la navegación de Waze');
    });
  }
}

/**
 * Diálogo interactivo para elegir entre Google Maps y Waze Nativos sin alertas de error
 */
export async function abrirNavegacionNativa(item) {
  const coords = await obtenerCoordenadas(item);
  const query = construirQueryDireccion(item);
  const infoTexto = coords
    ? `📍 Destino GPS: ${coords.lat}, ${coords.lng}`
    : `📍 Destino Dirección: ${query}`;

  Alert.alert(
    '🗺️ Navegación por GPS (Estilo Uber)',
    infoTexto,
    [
      {
        text: '🗺️ Google Maps',
        onPress: () => abrirGoogleMapsNativo(item),
      },
      {
        text: '🚙 Waze',
        onPress: () => abrirWazeNativo(item),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]
  );
}
