import React, { useEffect, useState } from 'react';
import { fetchInvestigadores } from '../services/api';
import { UserCheck, Shield, Phone, Mail, Plus } from 'lucide-react';

export default function InvestigadoresPage() {
  const [investigadores, setInvestigadores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchInvestigadores();
        setInvestigadores(res || []);
      } catch (err) {
        console.error('Error cargando investigadores:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Investigadores de Campo</h2>
          <p className="text-slate-400 text-sm">Personal autorizado para captura de datos y visitas domiciliarias en la App Móvil.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500">Cargando catálogo...</div>
        ) : (
          investigadores.map((inv) => (
            <div key={inv.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center font-bold text-white text-lg shadow-md">
                  {inv.nombre.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-white">{inv.nombre}</div>
                  <div className="text-xs text-sky-400 font-medium capitalize">{inv.rol}</div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 border-t border-slate-800/80 pt-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>{inv.email}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>{inv.telefono || 'Sin teléfono'}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ACTIVO
                </span>
                <span className="text-[11px] text-slate-500">ID #{inv.id}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
