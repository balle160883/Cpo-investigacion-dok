import React, { useEffect, useState } from 'react';
import { fetchStats, fetchInvestigaciones } from '../services/api';
import { Files, Clock, CheckCircle2, AlertCircle, Users, ChevronRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    total: 18147,
    completadas: 0,
    en_proceso: 0,
    pendientes: 18147,
    investigadores_activos: 3,
  });
  const [recientes, setRecientes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, invData] = await Promise.all([
          fetchStats(),
          fetchInvestigaciones({ limit: 6 }),
        ]);
        setStats(statsData);
        setRecientes(invData.data || []);
      } catch (err) {
        console.error('Error cargando dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const cards = [
    {
      title: 'Total Investigaciones',
      value: stats.total.toLocaleString(),
      icon: Files,
      color: 'from-sky-500 to-blue-600',
      badge: 'Registros SIF',
    },
    {
      title: 'Completadas',
      value: stats.completadas.toLocaleString(),
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-600',
      badge: 'Con Dictamen',
    },
    {
      title: 'En Proceso',
      value: stats.en_proceso.toLocaleString(),
      icon: Clock,
      color: 'from-amber-500 to-orange-600',
      badge: 'Asignadas',
    },
    {
      title: 'Pendientes por Asignar',
      value: stats.pendientes.toLocaleString(),
      icon: AlertCircle,
      color: 'from-rose-500 to-pink-600',
      badge: 'Por Visitar',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Panel de Administración de Investigaciones</h2>
        <p className="text-slate-400 text-sm">Monitoreo de visitas domiciliarias, asignación a campo y dictámenes oficiales.</p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-[#10172a] grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">{card.title}</span>
                <div className={`p-2 rounded-xl bg-gradient-to-br ${card.color} text-white shadow-md`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white mb-1 font-heading">{card.value}</div>
              <span className="inline-block text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
                {card.badge}
              </span>
            </div>
          );
        })}
      </div>

      {/* Content Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recientes List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Files className="w-4 h-4 text-sky-400" />
              Investigaciones Recientes
            </h3>
            <Link to="/investigaciones" className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1">
              Ver todas <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Cargando datos de Dokploy...</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {recientes.map((item) => (
                <div key={item.id_sif_research} className="py-3 flex items-center justify-between hover:bg-slate-800/30 px-2 rounded-xl transition">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      item.tipo_sujeto === 'CLIENTE' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    }`}>
                      {item.tipo_sujeto === 'CLIENTE' ? 'SOL' : 'AVL'}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-200">{item.sujeto_nombre || 'Socio Sin Nombre'}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span>Folio: {item.solicitud_folio || item.id_sif_research}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {item.calle ? `${item.calle} #${item.numero_exterior || ''}` : 'Sin dirección'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      item.estado === 'COMPLETADA'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : item.estado === 'EN_PROCESO'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {item.estado}
                    </span>
                    <Link
                      to={`/investigaciones/${item.id_sif_research}`}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Info & Investigators Panel */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              Investigadores en Campo
            </h3>
            <p className="text-xs text-slate-400">Personal activo registrado para captura de visitas y geolocalización.</p>

            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Carlos Mendoza</div>
                  <div className="text-[11px] text-slate-400">Investigador Zonas Centro / Oblatos</div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Elena Torres</div>
                  <div className="text-[11px] text-slate-400">Investigadora Zonas Sur / Tlaquepaque</div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              </div>
            </div>

            <Link
              to="/investigadores"
              className="block w-full py-2 text-center rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold transition"
            >
              Gestionar Investigadores
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
