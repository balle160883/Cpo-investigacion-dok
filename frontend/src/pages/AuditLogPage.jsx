import React, { useEffect, useState } from 'react';
import { fetchAuditLog } from '../services/api';
import { ShieldAlert, Clock, User, Cpu, Globe, ChevronLeft, ChevronRight, Filter, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const ACCION_LABELS = {
  ASIGNAR_INVESTIGADOR: { label: 'Asignación', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  LOGIN: { label: 'Inicio de Sesión', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  GUARDAR_EVIDENCIA: { label: 'Evidencia Guardada', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  ACTUALIZAR_ESTADO: { label: 'Cambio de Estado', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  EDITAR_INVESTIGACION: { label: 'Edición', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
};

function AccionBadge({ accion }) {
  const meta = ACCION_LABELS[accion] || { label: accion, color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${meta.color}`}>
      {meta.label}
    </span>
  );
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filtroAccion, setFiltroAccion] = useState('');
  const [acciones, setAcciones] = useState([]);
  const limit = 50;

  async function cargar(p = 1, accion = filtroAccion) {
    setLoading(true);
    try {
      const params = { page: p, limit };
      if (accion) params.accion = accion;
      const data = await fetchAuditLog(params);
      setEntries(data.data || []);
      setTotalPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar(1);
    // Cargar tipos de acciones para el filtro
    import('../services/api').then(({ fetchAuditAcciones }) => {
      fetchAuditAcciones().then(setAcciones).catch(() => {});
    });
  }, []);

  function handleFiltro(e) {
    setFiltroAccion(e.target.value);
    setPage(1);
    cargar(1, e.target.value);
  }

  function formatFecha(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            Bitácora de Auditoría
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Registro inalterable de {total.toLocaleString()} eventos del sistema
          </p>
        </div>
        <div className="flex gap-2">
          {/* Filtro por Acción */}
          <div className="relative">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <select
              value={filtroAccion}
              onChange={handleFiltro}
              className="pl-8 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="">Todas las acciones</option>
              {acciones.map((a) => (
                <option key={a.accion} value={a.accion}>
                  {ACCION_LABELS[a.accion]?.label || a.accion} ({a.total})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => cargar(page)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 inline mr-1" />Fecha / Hora
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <User className="w-3.5 h-3.5 inline mr-1" />Usuario
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Acción
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Recurso / ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <Globe className="w-3.5 h-3.5 inline mr-1" />IP
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <Cpu className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                    Cargando bitácora...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>No hay eventos registrados aún.</p>
                    <p className="text-xs mt-1">Los eventos aparecerán aquí cuando los usuarios realicen acciones en el sistema.</p>
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                      {formatFecha(e.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200 font-medium text-xs">{e.usuario_nombre || '—'}</div>
                      <div className="text-slate-500 text-[10px]">{e.usuario_rol}</div>
                    </td>
                    <td className="px-4 py-3">
                      <AccionBadge accion={e.accion} />
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      <span className="font-medium text-slate-300">{e.recurso || '—'}</span>
                      {e.recurso_id && <span className="ml-1 text-slate-500">#{e.recurso_id}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate" title={e.descripcion}>
                      {e.descripcion || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                      {e.ip_origen || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {e.resultado === 'exito' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-800/20">
            <span className="text-xs text-slate-500">
              Página {page} de {totalPages} · {total.toLocaleString()} registros totales
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => { setPage(page - 1); cargar(page - 1); }}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-40 hover:bg-slate-700 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setPage(page + 1); cargar(page + 1); }}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 disabled:opacity-40 hover:bg-slate-700 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
