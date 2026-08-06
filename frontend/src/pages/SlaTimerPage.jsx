import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Timer, 
  Calendar, 
  Filter, 
  Search, 
  RefreshCw, 
  ChevronRight, 
  Building2, 
  UserCheck, 
  ShieldCheck, 
  FileText, 
  X,
  Hourglass
} from 'lucide-react';
import { fetchSlaStats } from '../services/api';
import { formatNombreSucursal } from '../utils/formatters';

export default function SlaTimerPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    resumenKpi: {
      totalCreditos: 0,
      optimos: 0,
      advertencias: 0,
      excedidos: 0,
      promedioHorasGlobal: 0,
      porcentajeSla: 100,
    },
    creditos: [],
  });

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState('TODAS');
  const [estadoSlaFiltro, setEstadoSlaFiltro] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [selectedCreditoTimeline, setSelectedCreditoTimeline] = useState(null);

  // Ticker de 1 segundo para actualizar cronómetros activos en vivo
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cargarDatosSla = async () => {
    setLoading(true);
    try {
      const params = {};
      if (fechaInicio) params.fecha_inicio = fechaInicio;
      if (fechaFin) params.fecha_fin = fechaFin;
      if (sucursalSeleccionada !== 'TODAS') params.sucursal_id = sucursalSeleccionada;
      if (estadoSlaFiltro !== 'TODOS') params.estado_sla = estadoSlaFiltro;

      const res = await fetchSlaStats(params);
      setData(res);
    } catch (err) {
      console.error('Error al cargar tiempos SLA:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatosSla();
  }, []);

  const handleResetFiltros = () => {
    setFechaInicio('');
    setFechaFin('');
    setSucursalSeleccionada('TODAS');
    setEstadoSlaFiltro('TODOS');
    setBusqueda('');
  };

  // Formatea horas en Días, Horas y Minutos
  const formatTiempoTranscurrido = (createdDateStr, finalDateStr) => {
    const start = new Date(createdDateStr).getTime();
    const end = finalDateStr ? new Date(finalDateStr).getTime() : currentTime;
    const diffMs = Math.max(0, end - start);

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const mins = totalMinutes % 60;

    if (days > 0) {
      return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
    }
    return `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
  };

  const formatFechaHora = (fechaStr) => {
    if (!fechaStr) return 'Pendiente ⏳';
    return new Date(fechaStr).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const creditosFiltrados = data.creditos.filter((c) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      (c.sujeto_nombre || '').toLowerCase().includes(q) ||
      (c.solicitud_folio || '').toLowerCase().includes(q) ||
      String(c.id_sif_research).includes(q) ||
      formatNombreSucursal(c.sucursal_id).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Timer className="w-8 h-8 text-sky-400 animate-pulse" />
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Cronómetro SLA & Auditoría de Tiempos
            </h2>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Monitoreo en tiempo real del ciclo de atención del crédito desde su captura en Sucursal hasta su dictamen final.
          </p>
        </div>

        <button
          onClick={cargarDatosSla}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition flex items-center gap-2 border border-slate-700 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 text-sky-400 ${loading ? 'animate-spin' : ''}`} /> Actualizar Tiempos
        </button>
      </div>

      {/* TARJETAS KPI GLOBAL DE RENDIMIENTO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Promedio Global */}
        <div className="bg-slate-900 border border-sky-500/30 p-5 rounded-2xl flex items-center justify-between shadow-xl">
          <div>
            <div className="text-xs text-sky-400 font-bold uppercase tracking-wider">Promedio de Atención</div>
            <div className="text-3xl font-extrabold text-white mt-1">
              {data.resumenKpi.promedioHorasGlobal} <span className="text-sm font-normal text-slate-400">hrs/crédito</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">SLA Global del Proceso</div>
          </div>
          <div className="p-3 bg-sky-500/20 rounded-2xl border border-sky-500/30 text-sky-400">
            <Hourglass className="w-7 h-7" />
          </div>
        </div>

        {/* Óptimos (< 24h) */}
        <div className="bg-slate-900 border border-emerald-500/30 p-5 rounded-2xl flex items-center justify-between shadow-xl">
          <div>
            <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">🟢 Dentro de Meta SLA (&lt;24h)</div>
            <div className="text-3xl font-extrabold text-white mt-1">
              {data.resumenKpi.optimos} <span className="text-xs text-emerald-400 font-normal">({data.resumenKpi.porcentajeSla}%)</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Atención oportuna</div>
          </div>
          <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-7 h-7" />
          </div>
        </div>

        {/* Advertencia (24-48h) */}
        <div className="bg-slate-900 border border-amber-500/30 p-5 rounded-2xl flex items-center justify-between shadow-xl">
          <div>
            <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">🟡 Atención Requerida (24-48h)</div>
            <div className="text-3xl font-extrabold text-white mt-1">{data.resumenKpi.advertencias}</div>
            <div className="text-[11px] text-slate-400 mt-1">En zona de riesgo SLA</div>
          </div>
          <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-500/30 text-amber-400">
            <Clock className="w-7 h-7" />
          </div>
        </div>

        {/* Excedidos (> 48h) */}
        <div className="bg-slate-900 border border-rose-500/30 p-5 rounded-2xl flex items-center justify-between shadow-xl">
          <div>
            <div className="text-xs text-rose-400 font-bold uppercase tracking-wider">🔴 Fuera de Meta (&gt;48h)</div>
            <div className="text-3xl font-extrabold text-white mt-1">{data.resumenKpi.excedidos}</div>
            <div className="text-[11px] text-slate-400 mt-1">Créditos demorados</div>
          </div>
          <div className="p-3 bg-rose-500/20 rounded-2xl border border-rose-500/30 text-rose-400">
            <AlertTriangle className="w-7 h-7 animate-bounce" />
          </div>
        </div>
      </div>

      {/* FILTROS Y BARRA DE BÚSQUEDA */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-sky-400 tracking-wider">
          <Filter className="w-4 h-4" /> Filtros de Auditoría SLA
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Estatus de SLA</label>
            <select
              value={estadoSlaFiltro}
              onChange={(e) => setEstadoSlaFiltro(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="TODOS">Todos los Créditos</option>
              <option value="OPTIMO">🟢 Dentro de Meta (&lt;24h)</option>
              <option value="ADVERTENCIA">🟡 En Advertencia (24h-48h)</option>
              <option value="EXCEDIDO">🔴 Fuera de Meta (&gt;48h)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Fecha Registro (Desde)</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Fecha Registro (Hasta)</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={cargarDatosSla}
              className="flex-1 py-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-sky-600/20"
            >
              <Filter className="w-4 h-4" /> Aplicar Filtros
            </button>
            <button
              onClick={handleResetFiltros}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE CRÓNOMETRO Y CRÉDITOS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Timer className="w-4 h-4 text-sky-400" /> Monitoreo y Cronómetro de Créditos ({creditosFiltrados.length})
          </h3>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar socio, folio o sucursal..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500 w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Crédito / Folio</th>
                <th className="px-5 py-3">Sucursal Origen</th>
                <th className="px-5 py-3">Solicitante</th>
                <th className="px-5 py-3">Registro Sucursal</th>
                <th className="px-5 py-3">Cronómetro SLA</th>
                <th className="px-5 py-3">Estatus Proceso</th>
                <th className="px-5 py-3 text-right">Línea de Tiempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500">
                    Cargando auditoría de tiempos SLA...
                  </td>
                </tr>
              ) : creditosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500">
                    No se encontraron registros de crédito con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                creditosFiltrados.map((c) => {
                  const tiempoStr = formatTiempoTranscurrido(c.fecha_creacion_sif, c.fecha_revalidacion);
                  const isOptimo = c.estado_sla === 'OPTIMO';
                  const isAdvertencia = c.estado_sla === 'ADVERTENCIA';

                  return (
                    <tr key={c.id_sif_research} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-4 font-mono font-semibold text-slate-200">
                        #{c.id_sif_research}
                        <div className="text-[10px] text-slate-500">Folio: {c.solicitud_folio || 'N/A'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm">
                          🏢 {formatNombreSucursal(c.sucursal_id)}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-white">
                        {c.sujeto_nombre || 'Socio'}
                        <div className="text-[10px] text-slate-400 font-normal">{c.tipo_sujeto}</div>
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-300">
                        {formatFechaHora(c.fecha_creacion_sif)}
                      </td>
                      <td className="px-5 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold border shadow-md ${
                          isOptimo
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : isAdvertencia
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                        }`}>
                          <Timer className="w-3.5 h-3.5" />
                          <span>{tiempoStr}</span>
                          {!c.finalizado && <span className="text-[9px] uppercase px-1 bg-slate-800 rounded">EN VIVO</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {c.finalizado ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                            ✅ DICTAMEN FINALIZADO
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            ⏳ EN PROCESO
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setSelectedCreditoTimeline(c)}
                          className="px-3 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 text-xs font-semibold transition inline-flex items-center gap-1 border border-sky-500/30"
                        >
                          ⏱️ Ver Fases
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL INTERACTIVO DE LÍNEA DE TIEMPO AUDITADA */}
      {selectedCreditoTimeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Timer className="w-6 h-6 text-sky-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Línea de Tiempo Auditada — Crédito #{selectedCreditoTimeline.id_sif_research}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sucursal: <strong>{formatNombreSucursal(selectedCreditoTimeline.sucursal_id)}</strong> | Socio: <strong>{selectedCreditoTimeline.sujeto_nombre}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCreditoTimeline(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Cronómetro Total Badge */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-semibold">Tiempo Total Acumulado</span>
                  <div className="text-2xl font-extrabold text-sky-400 font-mono mt-0.5">
                    {formatTiempoTranscurrido(selectedCreditoTimeline.fecha_creacion_sif, selectedCreditoTimeline.fecha_revalidacion)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 uppercase font-semibold">Evaluación SLA</span>
                  <div className="mt-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      selectedCreditoTimeline.estado_sla === 'OPTIMO'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : selectedCreditoTimeline.estado_sla === 'ADVERTENCIA'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {selectedCreditoTimeline.estado_sla}
                    </span>
                  </div>
                </div>
              </div>

              {/* FASES DEL CICLO DE VIDA */}
              <div className="space-y-4 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-slate-800">
                {/* FASE 1 */}
                <div className="relative flex items-start gap-4 pl-8">
                  <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-sky-500 border-2 border-slate-900" />
                  <div className="flex-1 bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>Fase 1: Registro en Sucursal</span>
                      <span className="text-sky-400 font-mono">{selectedCreditoTimeline.hrs_fase1_asignacion || 0} hrs</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Fecha captura: {formatFechaHora(selectedCreditoTimeline.fecha_creacion_sif)}
                    </p>
                  </div>
                </div>

                {/* FASE 2 */}
                <div className="relative flex items-start gap-4 pl-8">
                  <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                    selectedCreditoTimeline.fecha_asignacion ? 'bg-indigo-500' : 'bg-slate-700'
                  }`} />
                  <div className="flex-1 bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>Fase 2: Asignación e Investigación en Campo</span>
                      <span className="text-indigo-400 font-mono">{selectedCreditoTimeline.hrs_fase2_campo || 0} hrs</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Investigador: <strong>{selectedCreditoTimeline.investigador_nombre || 'No asignado'}</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Asignado: {formatFechaHora(selectedCreditoTimeline.fecha_asignacion)} | Cumplido: {formatFechaHora(selectedCreditoTimeline.fecha_cumplimiento)}
                    </p>
                  </div>
                </div>

                {/* FASE 3 */}
                <div className="relative flex items-start gap-4 pl-8">
                  <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                    selectedCreditoTimeline.fecha_validacion ? 'bg-amber-500' : 'bg-slate-700'
                  }`} />
                  <div className="flex-1 bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>Fase 3: Validación por Crédito</span>
                      <span className="text-amber-400 font-mono">{selectedCreditoTimeline.hrs_fase3_credito || 0} hrs</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Validador: <strong>{selectedCreditoTimeline.validador_nombre || 'En espera de validación'}</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Validado: {formatFechaHora(selectedCreditoTimeline.fecha_validacion)}
                    </p>
                  </div>
                </div>

                {/* FASE 4 */}
                <div className="relative flex items-start gap-4 pl-8">
                  <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                    selectedCreditoTimeline.fecha_revalidacion ? 'bg-emerald-500' : 'bg-slate-700'
                  }`} />
                  <div className="flex-1 bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>Fase 4: Revalidación Final por Analista</span>
                      <span className="text-emerald-400 font-mono">{selectedCreditoTimeline.hrs_fase4_analista || 0} hrs</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Analista: <strong>{selectedCreditoTimeline.analista_nombre || 'En espera de revalidación'}</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Dictamen Final: {formatFechaHora(selectedCreditoTimeline.fecha_revalidacion)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setSelectedCreditoTimeline(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Cerrar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
