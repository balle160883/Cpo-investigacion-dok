import React from 'react';
import { ShieldCheck, Activity, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Header({ user: propUser, onLogout: propLogout }) {
  const { user: contextUser, logout: contextLogout, theme, toggleTheme } = useAuth();
  const user = propUser || contextUser;
  const handleLogout = propLogout || contextLogout;

  const userName = user?.nombre || user?.email || 'Superadministrador';
  const userRole = user?.rol || 'superadmin';

  return (
    <header className="h-16 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 no-print">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            Caja Oblatos <span className="text-xs bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full font-mono border border-sky-500/30">CPO-INV</span>
          </h1>
          <p className="text-xs text-slate-400">Departamento de Investigaciones Domiciliarias</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>BD Dokploy Conectada</span>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700/50 flex items-center gap-1.5 text-xs font-semibold"
          title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Oscuro</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-sky-600 flex items-center justify-center font-bold text-white text-xs">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="text-left hidden md:block">
            <div className="text-xs font-semibold text-slate-200">{userName}</div>
            <div className="text-[10px] text-sky-400 uppercase font-mono">{userRole}</div>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition ml-1"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
