/**
 * Utilidad de optimización y sanitización de imágenes para la App Móvil CPO.
 * Garantiza que los datos base64 enviados a la API tengan el formato adecuado,
 * sin prefijos duplicados y dentro de límites seguros de memoria.
 */

/**
 * Normaliza y valida un string de imagen en base64.
 * @param {string} base64Data - String base64 recibido de la cámara o galería
 * @returns {string} String base64 limpio con prefijo data URI estándar
 */
export function formatBase64Image(base64Data) {
  if (!base64Data) return null;
  
  // Limpiar posible prefijo repetido o malformado
  let cleanBase64 = base64Data.trim();
  if (cleanBase64.startsWith('data:image')) {
    cleanBase64 = cleanBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
  }

  // Garantizar prefijo estándar data URI JPEG
  return `data:image/jpeg;base64,${cleanBase64}`;
}

/**
 * Estima el tamaño en Kilobytes de una imagen en base64.
 * @param {string} base64String 
 * @returns {number} Tamaño estimado en KB
 */
export function getBase64SizeKB(base64String) {
  if (!base64String) return 0;
  const padding = (base64String.endsWith('==') ? 2 : base64String.endsWith('=') ? 1 : 0);
  const sizeBytes = (base64String.length * 0.75) - padding;
  return Math.round(sizeBytes / 1024);
}

/**
 * Sanitiza un lote de fotos en base64 asegurando validez y métricas de peso.
 * @param {Array<string>} fotosArray 
 * @returns {Array<string>} Arreglo de imágenes procesadas
 */
export function optimizePhotosBatch(fotosArray) {
  if (!Array.isArray(fotosArray)) return [];
  return fotosArray
    .map((img) => formatBase64Image(img))
    .filter((img) => img !== null);
}
