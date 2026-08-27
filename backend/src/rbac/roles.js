/**
 * Definición Centralizada de Roles y Permisos RBAC — CPO Investigaciones
 *
 * Roles del sistema:
 *   superadmin  → Acceso total, gestión de usuarios y auditoría
 *   admin       → Acceso total excepto gestión de usuarios
 *   asignador   → Asignar investigaciones, ver mapa GPS
 *   validador   → Validar estudios completados, leer métricas
 *   investigador→ Solo su propia cola de trabajo (app móvil)
 *   auditor     → Solo lectura: audit log, stats, investigaciones
 */

const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  ASIGNADOR: 'asignador',
  VALIDADOR: 'validador',
  COORDINADORA_ANALISTAS: 'coordinadora_analistas',
  COORDINADOR_ANALISTAS: 'coordinador_analistas',
  GERENTE_ANALISTAS: 'gerente_analistas',
  ANALISTA: 'analista',
  INVESTIGADOR: 'investigador',
  AUDITOR: 'auditor',
};

// Permisos atómicos del sistema
const PERMISSIONS = {
  // Investigaciones
  VER_INVESTIGACIONES: 'ver_investigaciones',
  ASIGNAR_INVESTIGADOR: 'asignar_investigador',
  EDITAR_INVESTIGACION: 'editar_investigacion',
  VALIDAR_INVESTIGACION: 'validar_investigacion',
  REVALIDAR_INVESTIGACION: 'revalidar_investigacion',
  EXPORTAR_DATOS: 'exportar_datos',

  // Mapa GPS
  VER_MAPA: 'ver_mapa',

  // Investigadores / Usuarios
  VER_INVESTIGADORES: 'ver_investigadores',
  GESTIONAR_USUARIOS: 'gestionar_usuarios',

  // Dashboard / Estadísticas
  VER_DASHBOARD: 'ver_dashboard',
  VER_PRODUCTIVIDAD: 'ver_productividad',

  // Auditoría — solo superadmin y auditor
  VER_AUDIT_LOG: 'ver_audit_log',
};

// Mapa de permisos por rol
const ROLE_PERMISSIONS = {
  [ROLES.SUPERADMIN]: Object.values(PERMISSIONS), // Todo

  [ROLES.ADMIN]: [
    PERMISSIONS.VER_INVESTIGACIONES,
    PERMISSIONS.ASIGNAR_INVESTIGADOR,
    PERMISSIONS.EDITAR_INVESTIGACION,
    PERMISSIONS.VALIDAR_INVESTIGACION,
    PERMISSIONS.EXPORTAR_DATOS,
    PERMISSIONS.VER_MAPA,
    PERMISSIONS.VER_INVESTIGADORES,
    PERMISSIONS.VER_DASHBOARD,
    PERMISSIONS.VER_PRODUCTIVIDAD,
    PERMISSIONS.VER_AUDIT_LOG,
  ],

  [ROLES.ASIGNADOR]: [
    PERMISSIONS.VER_INVESTIGACIONES,
    PERMISSIONS.ASIGNAR_INVESTIGADOR,
    PERMISSIONS.VER_MAPA,
    PERMISSIONS.VER_INVESTIGADORES,
    PERMISSIONS.VER_DASHBOARD,
    PERMISSIONS.EXPORTAR_DATOS,
  ],

  [ROLES.VALIDADOR]: [
    PERMISSIONS.VER_INVESTIGACIONES,
    PERMISSIONS.VALIDAR_INVESTIGACION,
    PERMISSIONS.VER_MAPA,
    PERMISSIONS.VER_DASHBOARD,
    PERMISSIONS.VER_PRODUCTIVIDAD,
    PERMISSIONS.EXPORTAR_DATOS,
  ],

  [ROLES.COORDINADORA_ANALISTAS]: [
    PERMISSIONS.VER_INVESTIGACIONES,
    PERMISSIONS.REVALIDAR_INVESTIGACION,
    PERMISSIONS.VER_DASHBOARD,
    PERMISSIONS.VER_PRODUCTIVIDAD,
    PERMISSIONS.EXPORTAR_DATOS,
  ],

  [ROLES.COORDINADOR_ANALISTAS]: [
    PERMISSIONS.VER_INVESTIGACIONES,
    PERMISSIONS.REVALIDAR_INVESTIGACION,
    PERMISSIONS.VER_DASHBOARD,
    PERMISSIONS.VER_PRODUCTIVIDAD,
    PERMISSIONS.EXPORTAR_DATOS,
  ],

  [ROLES.GERENTE_ANALISTAS]: [
    PERMISSIONS.VER_INVESTIGACIONES,
    PERMISSIONS.REVALIDAR_INVESTIGACION,
    PERMISSIONS.VER_DASHBOARD,
    PERMISSIONS.VER_PRODUCTIVIDAD,
    PERMISSIONS.EXPORTAR_DATOS,
  ],

  [ROLES.ANALISTA]: [
    PERMISSIONS.VER_INVESTIGACIONES,
    PERMISSIONS.REVALIDAR_INVESTIGACION,
    PERMISSIONS.VER_DASHBOARD,
    PERMISSIONS.VER_PRODUCTIVIDAD,
    PERMISSIONS.EXPORTAR_DATOS,
  ],

  [ROLES.INVESTIGADOR]: [
    PERMISSIONS.VER_INVESTIGACIONES, // Solo las propias (filtrado en API)
  ],

  [ROLES.AUDITOR]: [
    PERMISSIONS.VER_INVESTIGACIONES,
    PERMISSIONS.VER_DASHBOARD,
    PERMISSIONS.VER_PRODUCTIVIDAD,
    PERMISSIONS.VER_AUDIT_LOG,
    PERMISSIONS.VER_INVESTIGADORES,
  ],
};

// Metadatos visuales del rol para el frontend
const ROLE_META = {
  [ROLES.SUPERADMIN]: {
    label: 'Super Administrador',
    color: 'purple',
    badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
    icon: '👑',
    description: 'Acceso total al sistema',
  },
  [ROLES.ADMIN]: {
    label: 'Administrador',
    color: 'sky',
    badge: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
    icon: '🛡️',
    description: 'Gestión completa de operaciones',
  },
  [ROLES.ASIGNADOR]: {
    label: 'Asignador de Zonas',
    color: 'amber',
    badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    icon: '📍',
    description: 'Asignación y seguimiento de investigaciones',
  },
  [ROLES.VALIDADOR]: {
    label: 'Validador de Crédito',
    color: 'emerald',
    badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    icon: '✅',
    description: 'Validación y aprobación de estudios',
  },
  [ROLES.COORDINADORA_ANALISTAS]: {
    label: 'Coordinadora de Analistas',
    color: 'indigo',
    badge: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
    icon: '👩‍💼',
    description: 'Coordinación y supervisión de analistas, auditoría de tiempos y control de dictámenes',
  },
  [ROLES.COORDINADOR_ANALISTAS]: {
    label: 'Coordinador de Analistas',
    color: 'indigo',
    badge: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
    icon: '👩‍💼',
    description: 'Coordinación y supervisión de analistas, auditoría de tiempos y control de dictámenes',
  },
  [ROLES.GERENTE_ANALISTAS]: {
    label: 'Coordinadora de Analistas',
    color: 'indigo',
    badge: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
    icon: '👩‍💼',
    description: 'Coordinación y supervisión de analistas, auditoría de tiempos y control de dictámenes',
  },
  [ROLES.ANALISTA]: {
    label: 'Analista de Investigaciones',
    color: 'teal',
    badge: 'bg-teal-500/20 text-teal-300 border border-teal-500/40',
    icon: '📊',
    description: 'Revisión y dictamen de formatos e investigaciones',
  },
  [ROLES.INVESTIGADOR]: {
    label: 'Investigador en Campo',
    color: 'blue',
    badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
    icon: '🔍',
    description: 'Realización de visitas domiciliarias',
  },
  [ROLES.AUDITOR]: {
    label: 'Auditor',
    color: 'rose',
    badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
    icon: '📋',
    description: 'Lectura de bitácora y estadísticas',
  },
  'asignador,validador': {
    label: 'Asignador y Validador',
    color: 'teal',
    badge: 'bg-teal-500/20 text-teal-300 border border-teal-500/40',
    icon: '📍✅',
    description: 'Asignación de visitas y validación de estudios socioeconómicos',
  },
  'validador,asignador': {
    label: 'Asignador y Validador',
    color: 'teal',
    badge: 'bg-teal-500/20 text-teal-300 border border-teal-500/40',
    icon: '📍✅',
    description: 'Asignación de visitas y validación de estudios socioeconómicos',
  },
};

/**
 * Verificar si un rol tiene un permiso específico (soporta múltiples roles separados por coma)
 * @param {string} rol
 * @param {string} permiso
 * @returns {boolean}
 */
function hasPermission(rol, permiso) {
  const roles = (rol || '').toLowerCase().split(',').map(r => r.trim());
  return roles.some(r => {
    const permisos = ROLE_PERMISSIONS[r] || [];
    return permisos.includes(permiso);
  });
}

module.exports = { ROLES, PERMISSIONS, ROLE_PERMISSIONS, ROLE_META, hasPermission };
