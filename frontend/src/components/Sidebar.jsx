import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, MapPin, Users, Printer, ShieldAlert, Settings, ShieldCheck } from 'lucide-react';

const ROLE_META = {
  superadmin: { label: 'Super Admin', badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/40', icon: '👑' },
  admin:       { label: 'Administrador', badge: 'bg-sky-500/20 text-sky-300 border border-sky-500/40', icon: '🛡️' },
  asignador:   { label: 'Asignador de Zonas', badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40', icon: '📍' },
  validador:   { label: 'Validador de Crédito', badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40', icon: '✅' },
  analista:    { label: 'Analista de Investigaciones', badge: 'bg-teal-500/20 text-teal-300 border border-teal-500/40', icon: '📊' },
  investigador:{ label: 'Investigador en Campo', badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/40', icon: '🔍' },
  auditor:     { label: 'Auditor', badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/40', icon: '📋' },
};

export default function Sidebar({ user }) {
  const userRole = (user?.rol || '').toLowerCase();
  const roleMeta = ROLE_META[userRole] || { label: userRole, badge: 'bg-slate-700 text-slate-300', icon: '👤' };

  const canViewMap = ['superadmin', 'admin', 'asignador', 'validador'].includes(userRole);
  const canViewAudit = ['superadmin', 'admin', 'auditor'].includes(userRole);
  const canViewSettings = ['superadmin', 'admin'].includes(userRole);
  const canViewSupervisionAnalistas = ['superadmin', 'admin', 'supervisor_analistas'].includes(userRole);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/investigaciones', label: 'Investigaciones', icon: FileText },
    canViewSupervisionAnalistas && { to: '/supervision-analistas', label: 'Auditoría Analistas', icon: ShieldCheck },
    canViewMap && { to: '/mapa', label: 'Mapa GPS', icon: MapPin },
    { to: '/investigadores', label: 'Investigadores', icon: Users },
    canViewAudit && { to: '/auditoria', label: 'Bitácora', icon: ShieldAlert },
    canViewSettings && { to: '/ajustes', label: 'Ajustes', icon: Settings },
  ].filter(Boolean);

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 no-print min-h-[calc(100vh-4rem)]">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          Menú Principal
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isAudit = item.to === '/auditoria';
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? isAudit
                      ? 'bg-rose-600/80 text-white shadow-lg shadow-rose-600/20'
                      : 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Tarjeta de Perfil / Rol */}
      <div className="space-y-3">
        {/* Badge de Rol RBAC */}
        <div className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 ${roleMeta.badge}`}>
          <span>{roleMeta.icon}</span>
          <span>{roleMeta.label}</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5 text-sky-400" />
            <span>Formatos Oficiales</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Soporte completo para impresión de <strong>Formato Solicitante</strong> y <strong>Formato Aval</strong>.
          </p>
        </div>
      </div>
    </aside>
  );
}
