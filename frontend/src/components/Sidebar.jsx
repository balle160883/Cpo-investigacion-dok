import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, MapPin, Users, Printer } from 'lucide-react';

export default function Sidebar({ user }) {
  const userRole = (user?.rol || '').toLowerCase();
  const allowedRolesForMap = ['superadmin', 'asignador', 'validador'];
  const canViewMap = allowedRolesForMap.includes(userRole);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/investigaciones', label: 'Investigaciones', icon: FileText },
    canViewMap && { to: '/mapa', label: 'Mapa GPS', icon: MapPin },
    { to: '/investigadores', label: 'Investigadores', icon: Users },
  ].filter(Boolean);

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 no-print min-h-[calc(100vh-4rem)]">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          Menú Principal
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
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

      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800 text-xs text-slate-400 space-y-2">
        <div className="font-semibold text-slate-300 flex items-center gap-1.5">
          <Printer className="w-3.5 h-3.5 text-sky-400" />
          <span>Formatos Oficiales</span>
        </div>
        <p className="text-[11px] text-slate-400">
          Soporte completo para impresión de <strong>Formato Solicitante</strong> y <strong>Formato Aval</strong>.
        </p>
      </div>
    </aside>
  );
}
