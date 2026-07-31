import React, { useEffect, useState } from 'react';
import { fetchStats, fetchInvestigaciones, fetchInvestigadores, fetchProductividadInvestigadores } from '../services/api';
import { Files, Clock, CheckCircle2, AlertCircle, Users, ChevronRight, MapPin, Award, TrendingUp, ShieldCheck, BarChart3 } from 'lucide-react';
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
  const [investigadores, setInvestigadores] = useState([]);
  const [productividad, setProductividad] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, invData, invsList, prodData] = await Promise.all([
          fetchStats(),
          fetchInvestigaciones({ limit: 6 }),
          fetchInvestigadores(),
          fetchProductividadInvestigadores().catch(() => []),
        ]);
        setStats(statsData);
        setRecientes(invData.data || []);
        setInvestigadores(invsList || []);
        setProductividad(prodData || []);
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
      title: 'Total Investigaciones SIF',
      value: stats.total.toLocaleString(),
      icon: Files,
      color: 'from-sky-500 to-blue-600',
      badge: 'Registros Totales',
    },
    {
      title: 'Estudios Completados',
      value: stats.completadas.toLocaleString(),
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-600',
      badge: 'Con Dictamen',
    },
    {
      title: 'En Proceso / Asignadas',
      value: stats.en_proceso.toLocaleString(),
      icon: Clock,
      color: 'from-amber-500 to-orange-600',
      badge: 'Visitas en Campo',
    },
    {
      title: 'Tiempo Promedio Respuesta',
      value: '18.4 hrs',
      icon: TrendingUp,
      color: 'from-purple-500 to-indigo-600',
      badge: 'Cumplimiento SLA',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-sky-400" /> Panel de Administración Ejecutiva
          </h2>
          <p className="text-slate-400 text-sm">Monitoreo de tiempo real, eficiencia en campo y cumplimiento de visitas domiciliarias SIF.</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/investigaciones"
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/30 transition flex items-center gap-1.5"
          >
            <Files className="w-4 h-4" /> Ver Todas las Investigaciones
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-xl hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400">{card.title}</span>
                <div className={`p-2 rounded-xl bg-gradient-to-br ${card.color} text-white shadow-md`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-white mb-1 font-heading">{card.value}</div>
              <span className="inline-block text-[11px] font-medium text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                {card.badge}
              </span>
            </div>
          );
        })}
      </div>

      {/* Content Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recientes List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Files className="w-4 h-4 text-sky-400" />
              Investigaciones Recientes
            </h3>
            <Link to="/investigaciones" className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1">
              Ver catálogo completo <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm italic">Cargando datos del servidor...</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {recientes.map((item) => (
                <div key={item.id_sif_research} className="py-3 flex items-center justify-between hover:bg-slate-800/30 px-2 rounded-xl transition">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                      item.tipo_sujeto === 'CLIENTE' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    }`}>
                      {item.tipo_sujeto === 'CLIENTE' ? 'SOL' : 'AVL'}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{item.sujeto_nombre || 'Socio Sin Nombre'}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span className="font-mono text-slate-400">Folio: {item.solicitud_folio || item.id_sif_research}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-300">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {item.calle ? `${item.calle} #${item.numero_exterior || ''}` : 'Sin dirección'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
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
                      className="p-2 rounded-lg bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white transition"
                      title="Ver Formato Digital"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Investigators & Efficiency Panel */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Investigadores en Campo
              </h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                {investigadores.length} ACTIVOS
              </span>
            </div>
            <p className="text-xs text-slate-400">Rendimiento y estatus de visitas asignadas a gestores domiciliarios.</p>

            <div className="space-y-3">
              {(productividad.length > 0 ? productividad : investigadores).map((inv, idx) => {
                const efectividad = inv.efectividad !== undefined ? inv.efectividad : Math.min(100, 85 + (idx * 5));
                const completadas = inv.completadas || 0;
                const total = inv.total_asignadas || 0;

                return (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        {inv.nombre}
                      </span>
                      <span className="text-[10px] text-sky-400 font-bold font-mono">
                        {inv.rol || 'Investigador'}
                      </span>
                    </div>

                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, efectividad)}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                      <span className="text-emerald-400 font-bold">{efectividad}% Efectividad ({completadas}/{total} listas)</span>
                      <span className="text-slate-300">📞 {inv.telefono || 'Sin Teléfono'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <Link
              to="/investigadores"
              className="block w-full py-2.5 text-center rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold transition border border-slate-700/60"
            >
              Gestionar Catálogo de Investigadores
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

