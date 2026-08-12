/**
 * Middleware para la validación de campos obligatorios en peticiones API
 */

/**
 * Valida que los campos indicados estén presentes en req.body y no estén vacíos.
 * @param {Array<string>} requiredFields - Lista de nombres de campos requeridos
 */
function validateRequiredFields(requiredFields = []) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Cuerpo de la petición inválido o ausente.' });
    }

    const missingFields = [];
    for (const field of requiredFields) {
      const val = req.body[field];
      if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Campos requeridos ausentes o vacíos.',
        campos_faltantes: missingFields,
      });
    }

    next();
  };
}

module.exports = { validateRequiredFields };
