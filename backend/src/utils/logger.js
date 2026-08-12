/**
 * Sistema de Logging Estructurado JSON para CPO Investigaciones
 */

const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  AUDIT: 'AUDIT',
};

function formatLog(level, message, metadata = {}) {
  const logObject = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata,
  };
  return JSON.stringify(logObject);
}

const logger = {
  info(message, metadata = {}) {
    console.log(formatLog(LOG_LEVELS.INFO, message, metadata));
  },

  warn(message, metadata = {}) {
    console.warn(formatLog(LOG_LEVELS.WARN, message, metadata));
  },

  error(message, metadata = {}) {
    console.error(formatLog(LOG_LEVELS.ERROR, message, metadata));
  },

  audit(message, metadata = {}) {
    console.log(formatLog(LOG_LEVELS.AUDIT, message, metadata));
  },
};

module.exports = logger;
