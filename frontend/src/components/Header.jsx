import React from 'react';
import { ShieldCheck, UserCheck, Activity, Bell } from 'lucide-react';

export default function Header() {
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
          <span>BD Dokploy Conectada (31.97.144.6:5437)</span>
        </div>

        <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition">
          <Bell className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sky-400 text-sm">
            CO
          </div>
          <div className="text-left hidden md:block">
            <div className="text-xs font-semibold text-slate-200">Administrador CPO</div>
            <div className="text-[10px] text-slate-400">Supervisión General</div>
          </div>
        </div>
      </div>
    </header>
  );
}
