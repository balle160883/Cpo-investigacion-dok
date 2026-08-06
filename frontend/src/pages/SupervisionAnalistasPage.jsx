import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Calendar, 
  UserCheck, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Search, 
  FileText, 
  RefreshCw,
  TrendingUp,
  UserX
} from 'lucide-react';
import { fetchAuditoriaAnalistas, fetchInvestigadores } from '../services/api';

export default function SupervisionAnalistasPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    pendientes_de_aprobar: 0,
    historial: [],
    resumenAnalistas: [],
  });
  const [analistas, setAnalistas] = useState([]);
  
  // Filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [analistaSeleccionado, setAnalistaSeleccionado] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    cargarAnalistasYDatos();
  }, []);

  async function cargarAnalistasYDatos() {
    setLoading(true);
    try {
      // Cargar lista de usuarios para filtro
      const invs = await fetchInvestigadores().catch(() => []);
      const filtradosAnalistas = invs.filter(u => 
        (u.rol || '').toLowerCase() === 'analista' || 
        (u.rol || '').toLowerCase() === 'admin' || 
        (u.rol || '').toLowerCase() === 'superadmin'
      );
      setAnalistas(filtradosAnalistas);

      await aplicarFiltro();
    } catch (err) {
      console.error('Error cargando auditoría de analistas:', err);
    } finally {
      setLoading(false);
    }
  }

  async function aplicarFiltro() {
    setLoading(true);
    try {
      const res = await fetchAuditoriaAnalistas({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        analista_id: analistaSeleccionado,
      });
      setData(res || { pendientes_de_aprobar: 0, historial: [], resumenAnalistas: [] });
    } catch (err) {
      console.error('Error al filtrar auditoría de analistas:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleResetFiltros() {
    setFechaInicio('');
    setFechaFin('');
    setAnalistaSeleccionado('TODOS');
    setBusqueda('');
    fetchAuditoriaAnalistas({}).then(res => {
      setData(res || { pendientes_de_aprobar: 0, historial: [], resumenAnalistas: [] });
    });
  }

  function formatFechaHora(fechaStr) {
    if (!fechaStr) return 'N/A';
    const d = new Date(fechaStr);
    if (isNaN(d)) return fechaStr;
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  // Filtrar historial local por texto de búsqueda
  const historialFiltrado = data.historial.filter(item => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      (item.sujeto_nombre || '').toLowerCase().includes(q) ||
      (item.solicitud_folio || '').toLowerCase().includes(q) ||
      (item.analista_nombre || '').toLowerCase().includes(q) ||
      String(item.id_sif_research).includes(q)
    );
  });

  const totalAprobadas = data.historial.filter(h => h.estado === 'APROBADA_FINAL').length;
  const totalDevueltas = data.historial.filter(h => h.estado === 'DEVUELTA_A_VALIDADOR').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-teal-400" />
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Supervisión & Auditoría de Analistas
            </h2>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Módulo de administración exclusiva de <strong>Norma Lizette Bermejo Palos</strong> para auditar dictámenes, aprobaciones definitivas y devoluciones por rango de fechas.
          </p>
        </div>

        <button
          onClick={cargarAnalistasYDatos}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition flex items-center gap-2 border border-slate-700 self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-teal-400" /> Actualizar Datos
        </button>
      </div>

      {/* BARRA DE FILTROS POR FECHA Y ANALISTA */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-teal-400 tracking-wider">
          <Filter className="w-4 h-4" /> Filtros de Auditoría por Fecha & Analista
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> Fecha Inicial (Desde)
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> Fecha Final (Hasta)
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-slate-500" /> Analista Específico
            </label>
            <select
              value={analistaSeleccionado}
              onChange={(e) => setAnalistaSeleccionado(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            >
              <option value="TODOS">Todos los Analistas</option>
              {analistas.map((an) => (
                <option key={an.id} value={an.id}>
                  {an.nombre} ({an.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={aplicarFiltro}
              className="flex-1 py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-teal-600/20"
            >
              <Filter className="w-4 h-4" /> Aplicar Filtro
            </button>
            <button
              onClick={handleResetFiltros}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition"
              title="Limpiar Filtros"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* TARJETAS KPI DE ACTIVIDAD */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Pendientes de Aprobar */}
        <div className="bg-slate-900 border border-amber-500/30 p-5 rounded-2xl flex items-center justify-between shadow-xl">
          <div>
            <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">Pendientes de Aprobar (En Cola)</div>
            <div className="text-3xl font-extrabold text-white mt-1">{data.pendientes_de_aprobar}</div>
            <div className="text-[11px] text-slate-400 mt-1">Estudios validados esperando revisión final</div>
          </div>
          <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-500/30 text-amber-400">
            <Clock className="w-7 h-7" />
          </div>
        </div>

        {/* Total Aprobadas Definitivamente */}
        <div className="bg-slate-900 border border-teal-500/30 p-5 rounded-2xl flex items-center justify-between shadow-xl">
          <div>
            <div className="text-xs text-teal-400 font-bold uppercase tracking-wider">Aprobadas Definitivamente</div>
            <div className="text-3xl font-extrabold text-white mt-1">{totalAprobadas}</div>
            <div className="text-[11px] text-slate-400 mt-1">Aprobadas por los analistas en este periodo</div>
          </div>
          <div className="p-3 bg-teal-500/20 rounded-2xl border border-teal-500/30 text-teal-400">
            <CheckCircle2 className="w-7 h-7" />
          </div>
        </div>

        {/* Total Devueltas */}
        <div className="bg-slate-900 border border-orange-500/30 p-5 rounded-2xl flex items-center justify-between shadow-xl">
          <div>
            <div className="text-xs text-orange-400 font-bold uppercase tracking-wider">Devueltas a Corrección</div>
            <div className="text-3xl font-extrabold text-white mt-1">{totalDevueltas}</div>
            <div className="text-[11px] text-slate-400 mt-1">Devueltas al validador con observaciones</div>
          </div>
          <div className="p-3 bg-orange-500/20 rounded-2xl border border-orange-500/30 text-orange-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* RESUMEN DE PRODUCTIVIDAD POR ANALISTA */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 text-teal-400" /> Resumen de Productividad por Analista
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {data.resumenAnalistas.length} Analista(s) Registrado(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Analista</th>
                <th className="px-5 py-3">Correo Electrónico</th>
                <th className="px-5 py-3 text-center">Aprobaciones Definitivas</th>
                <th className="px-5 py-3 text-center">Devueltas a Validador</th>
                <th className="px-5 py-3 text-center">Total Dictaminadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.resumenAnalistas.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-6 text-slate-500">
                    No se encontraron analistas registrados.
                  </td>
                </tr>
              ) : (
                data.resumenAnalistas.map((an) => {
                  const apr = parseInt(an.aprobadas_final || 0);
                  const dev = parseInt(an.devueltas_validador || 0);
                  const tot = apr + dev;
                  return (
                    <tr key={an.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-3.5 font-bold text-white flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-teal-400" />
                        {an.nombre || 'Analista'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">{an.email || 'N/A'}</td>
                      <td className="px-5 py-3.5 text-center font-bold text-teal-400">{apr}</td>
                      <td className="px-5 py-3.5 text-center font-bold text-orange-400">{dev}</td>
                      <td className="px-5 py-3.5 text-center font-extrabold text-white bg-slate-950/40">{tot}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETALLE INALTERABLE DE HISTORIAL Y AUDITORÍA */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4">
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
            <FileText className="w-4 h-4 text-teal-400" /> Bitácora Inalterable de Actividad Revalidada
          </h3>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar socio, folio..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-teal-500 w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Folio / Crédito</th>
                <th className="px-5 py-3">Sucursal Origen</th>
                <th className="px-5 py-3">Solicitante</th>
                <th className="px-5 py-3">Analista Responsable</th>
                <th className="px-5 py-3">Fecha / Hora Revalidación</th>
                <th className="px-5 py-3">Estado Final</th>
                <th className="px-5 py-3">Observaciones del Analista</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-500">
                    Cargando auditoría de analistas...
                  </td>
                </tr>
              ) : historialFiltrado.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-500">
                    No se encontraron registros de revalidación en el rango de fechas seleccionado.
                  </td>
                </tr>
              ) : (
                historialFiltrado.map((h) => (
                  <tr key={h.id_sif_research} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-3.5 font-mono font-semibold text-slate-200">
                      #{h.id_sif_research}
                      <div className="text-[10px] text-slate-500">Folio: {h.solicitud_folio || 'N/A'}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-1 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10px] font-bold inline-flex items-center gap-1">
                        🏢 {h.sucursal_id ? (String(h.sucursal_id) === '13' ? 'Sucursal 13 (Oblatos)' : `Sucursal #${h.sucursal_id}`) : 'Sucursal Matriz'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-white">{h.sujeto_nombre || 'Socio'}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-200">
                      {h.analista_nombre || 'Analista'}
                      <div className="text-[10px] text-slate-500">{h.analista_email || ''}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300 font-mono">{formatFechaHora(h.fecha_revalidacion)}</td>
                    <td className="px-5 py-3.5">
                      {h.estado === 'APROBADA_FINAL' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                          ✅ APROBADA FINAL
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40">
                          🔄 DEVUELTA AL VALIDADOR
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px] max-w-xs truncate" title={h.comentarios_revalidacion}>
                      {h.comentarios_revalidacion || <span className="italic text-slate-600">Sin comentarios</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/investigaciones/${h.id_sif_research}`}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 text-[11px] font-semibold transition inline-flex items-center gap-1 border border-sky-500/30"
                      >
                        Ver Estudio
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
