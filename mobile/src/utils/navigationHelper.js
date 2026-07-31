import { Platform, Linking, Alert } from 'react-native';

/**
 * Convierte un objeto de investigación en una dirección formateada para geocodificación
 */
export function construirQueryDireccion(item) {
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
 * Convierte la dirección en texto a Latitud y Longitud reales antes de navegar
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
 * Abrir aplicación Nativa de Google Maps directamente con Latitud y Longitud
 */
export async function abrirGoogleMapsNativo(item) {
  const coords = await obtenerCoordenadas(item);

  if (!coords) {
    Alert.alert(
      'Ubicación no encontrada',
      'No se pudieron obtener las coordenadas GPS del domicilio. Verifica la dirección.'
    );
    return;
  }

  const { lat, lng } = coords;

  // Esquema Nativo para Android e iOS
  let url = '';
  if (Platform.OS === 'android') {
    // google.navigation abre directamente la App de Google Maps en modo navegación Turn-by-Turn
    url = `google.navigation:q=${lat},${lng}`;
  } else {
    // iOS: comgooglemaps abre la App nativa de Google Maps en iPhone
    url = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      // Fallback a geo: intent (Android) o maps: (iOS Apple Maps) si Google Maps App no responde
      const fallbackUrl =
        Platform.OS === 'android'
          ? `geo:${lat},${lng}?q=${lat},${lng}`
          : `maps://?daddr=${lat},${lng}`;
      
      const canFallback = await Linking.canOpenURL(fallbackUrl);
      if (canFallback) {
        await Linking.openURL(fallbackUrl);
      } else {
        // Fallback universal a la App mediante HTTP Intent
        await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);
      }
    }
  } catch (err) {
    Alert.alert('Error', 'No se pudo abrir la aplicación de Google Maps');
  }
}

/**
 * Abrir aplicación Nativa de Waze directamente con Latitud y Longitud
 */
export async function abrirWazeNativo(item) {
  const coords = await obtenerCoordenadas(item);

  if (!coords) {
    Alert.alert(
      'Ubicación no encontrada',
      'No se pudieron obtener las coordenadas GPS del domicilio para Waze. Verifica la dirección.'
    );
    return;
  }

  const { lat, lng } = coords;

  // Esquema Nativo de Waze para app móvil
  const nativeUrl = `waze://?ll=${lat},${lng}&navigate=yes`;
  const webFallbackUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

  try {
    const canOpen = await Linking.canOpenURL(nativeUrl);
    if (canOpen) {
      await Linking.openURL(nativeUrl);
    } else {
      // Si la app Waze está instalada en Android/iOS pero canOpenURL no la detectó, intenta abrirla
      await Linking.openURL(nativeUrl).catch(async () => {
        await Linking.openURL(webFallbackUrl);
      });
    }
  } catch (err) {
    Linking.openURL(webFallbackUrl).catch(() => {
      Alert.alert('Error', 'No se pudo abrir la aplicación de Waze');
    });
  }
}

/**
 * Diálogo interactivo para elegir entre Google Maps y Waze Nativos
 */
export async function abrirNavegacionNativa(item) {
  const coords = await obtenerCoordenadas(item);
  const latLngTexto = coords ? `📍 Coordenadas: ${coords.lat}, ${coords.lng}` : `📍 Domicilio: ${construirQueryDireccion(item)}`;

  Alert.alert(
    '🗺️ Navegación por GPS Nativa',
    latLngTexto,
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
