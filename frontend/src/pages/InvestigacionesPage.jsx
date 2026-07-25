import React, { useEffect, useState } from 'react';
import { fetchInvestigaciones, fetchInvestigadores, asignarInvestigador } from '../services/api';
import { Search, Filter, Eye, UserPlus, MapPin, CheckCircle, Clock, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function InvestigacionesPage() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal Asignar
  const [selectedInv, setSelectedInv] = useState(null);
  const [investigadores, setInvestigadores] = useState([]);
  const [selectedInvestigadorId, setSelectedInvestigadorId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadInvestigaciones();
  }, [page, estado]);

  async function loadInvestigaciones() {
    setLoading(true);
    try {
      const res = await fetchInvestigaciones({
        page,
        limit: 25,
        estado,
        buscar,
      });
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Error cargando investigaciones:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    loadInvestigaciones();
  }

  async function openAssignModal(inv) {
    setSelectedInv(inv);
    try {
      const invs = await fetchInvestigadores();
      setInvestigadores(invs || []);
      if (invs.length > 0) setSelectedInvestigadorId(invs[0].id);
    } catch (err) {
      console.error('Error cargando investigadores:', err);
    }
  }

  async function handleAssignSubmit() {
    if (!selectedInv || !selectedInvestigadorId) return;
    setAssigning(true);
    try {
      await asignarInvestigador(selectedInv.id_sif_research, selectedInvestigadorId);
      setSelectedInv(null);
      loadInvestigaciones();
    } catch (err) {
      alert('Error asignando investigador: ' + err.message);
    } finally {
      setAssigning(false);
    }
  }

  const totalPages = Math.ceil(total / 25) || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Investigaciones Domiciliarias</h2>
          <p className="text-slate-400 text-sm">Administración y asignación de estudios a Solicitantes y Avales.</p>
        </div>

        {/* Search & Filter Bar */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por nombre, folio..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-sky-500 w-64"
            />
          </div>

          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-sky-500"
          >
            <option value="">Todos los Estados</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="EN_PROCESO">En Proceso</option>
            <option value="COMPLETADA">Completadas</option>
          </select>
        </form>
      </div>

      {/* Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">ID / Folio</th>
                <th className="px-5 py-3.5">Tipo Sujeto</th>
                <th className="px-5 py-3.5">Nombre del Socio</th>
                <th className="px-5 py-3.5">Domicilio Registrado</th>
                <th className="px-5 py-3.5">Investigador Asignado</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500">
                    Cargando catálogo de investigaciones...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500">
                    No se encontraron registros de investigación.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id_sif_research} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-4 font-mono font-semibold text-slate-200">
                      <div>#{row.id_sif_research}</div>
                      <div className="text-[11px] text-slate-500 font-sans">Sol: {row.solicitud_folio || 'N/A'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                        row.tipo_sujeto === 'CLIENTE'
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      }`}>
                        {row.tipo_sujeto === 'CLIENTE' ? 'Solicitante' : 'Aval'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-white">
                      {row.sujeto_nombre || 'Socio Desconocido'}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-300">
                      <div className="flex items-center gap-1 font-medium text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {row.calle ? `${row.calle} #${row.numero_exterior || ''}` : 'Sin Calle'}
                      </div>
                      <div className="text-[11px] text-slate-500 pl-4">CP: {row.codigo_postal || 'N/A'}</div>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {row.investigador_nombre ? (
                        <span className="text-slate-200 font-medium">{row.investigador_nombre}</span>
                      ) : (
                        <span className="text-slate-500 italic">Sin Asignar</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        row.estado === 'COMPLETADA'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : row.estado === 'EN_PROCESO'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {row.estado}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <button
                        onClick={() => openAssignModal(row)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-sky-600 text-sky-400 hover:text-white text-xs font-semibold transition"
                        title="Asignar Investigador"
                      >
                        <UserPlus className="w-3.5 h-3.5 inline mr-1" />
                        Asignar
                      </button>

                      <Link
                        to={`/investigaciones/${row.id_sif_research}`}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition inline-flex items-center gap-1 shadow-md shadow-sky-600/20"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver Formato
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Mostrando página <span className="text-white font-semibold">{page}</span> de <span className="text-white font-semibold">{totalPages}</span> ({total.toLocaleString()} totales)
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {selectedInv && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Asignar Investigador en Campo</h3>
            <p className="text-xs text-slate-400">
              Selecciona al investigador responsable para la visita de <strong className="text-white">{selectedInv.sujeto_nombre}</strong>.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Investigador:</label>
              <select
                value={selectedInvestigadorId}
                onChange={(e) => setSelectedInvestigadorId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {investigadores.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.rol})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setSelectedInv(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancelar
              </button>
              <button
                disabled={assigning}
                onClick={handleAssignSubmit}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition shadow-lg shadow-sky-600/30"
              >
                {assigning ? 'Asignando...' : 'Confirmar Asignación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
