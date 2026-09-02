import React, { useEffect, useState } from 'react';
import { fetchInvestigaciones, fetchInvestigadores, asignarInvestigador, asignarInvestigadorLote, fetchColoniasActivas, fetchSucursalesActivas } from '../services/api';
import { Search, Eye, UserPlus, MapPin, FileText, ChevronLeft, ChevronRight, ShieldCheck, CheckSquare, Square, Users, X, MapPinned, ChevronDown, Building2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import ChecklistDocumentalModal from '../components/ChecklistDocumentalModal';
import NotificacionesInterareasModal from '../components/NotificacionesInterareasModal';
import AgendaVisitasModal from '../components/AgendaVisitasModal';
import PrevalidacionContactoModal from '../components/PrevalidacionContactoModal';
import { formatNombreSucursal, esAval, getEtiquetaSujeto, getEtiquetaSujetoUpper, getBadgeSujetoProps, formatFechaHoraCaptura } from '../utils/formatters';

// Helper: formatea fecha en DD/Mon/AAAA
function formatFechaCorta(fechaStr) {
  if (!fechaStr) return '—';
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const d = new Date(fechaStr);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2,'0')}/${meses[d.getMonth()]}/${d.getFullYear()}`;
}

export default function InvestigacionesPage() {
  const auth = useAuth();
  const userRole = (() => {
    if (auth?.user?.rol) return auth.user.rol.toLowerCase();
    try { return (JSON.parse(localStorage.getItem('cpo_user') || '{}').rol || '').toLowerCase(); } catch { return ''; }
  })();
  const isAnalista = userRole === 'analista';

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('');
  const [loading, setLoading] = useState(true);

  // Filtro por colonia
  const [colonias, setColonias] = useState([]);
  const [coloniaSeleccionada, setColoniaSeleccionada] = useState('');
  const [coloniaDropdownOpen, setColoniaDropdownOpen] = useState(false);
  const [loadingColonias, setLoadingColonias] = useState(false);

  // Filtro por sucursal
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState('');
  const [sucursalDropdownOpen, setSucursalDropdownOpen] = useState(false);
  const [loadingSucursales, setLoadingSucursales] = useState(false);

  // Selección múltiple (checkboxes)
  const [selectedIds, setSelectedIds] = useState([]);

  // Modales: Expediente, Notificaciones, Agenda Dinámica y Prevalidación Domicilio/Contacto
  const [docModalSolicitudId, setDocModalSolicitudId] = useState(null);
  const [notifModalSolicitudId, setNotifModalSolicitudId] = useState(null);
  const [agendaModalInvId, setAgendaModalInvId] = useState(null);
  const [contactoModalPersonaId, setContactoModalPersonaId] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'success' });

  // Modal Asignar (individual)
  const [selectedInv, setSelectedInv] = useState(null);
  const [investigadores, setInvestigadores] = useState([]);
  const [selectedInvestigadorId, setSelectedInvestigadorId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Modal Asignar Lote
  const [loteModalOpen, setLoteModalOpen] = useState(false);
  const [loteInvestigadorId, setLoteInvestigadorId] = useState('');
  const [assigningLote, setAssigningLote] = useState(false);

  useEffect(() => {
    loadInvestigaciones();
  }, [page, estado, coloniaSeleccionada, sucursalSeleccionada]);

  // Debounce para búsqueda al escribir
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadInvestigaciones();
    }, 350);
    return () => clearTimeout(timer);
  }, [buscar]);

  useEffect(() => {
    loadColonias();
    loadSucursales();
  }, []);

  async function loadColonias() {
    setLoadingColonias(true);
    try {
      const cols = await fetchColoniasActivas();
      setColonias(cols || []);
    } catch (err) {
      console.error('Error cargando colonias:', err);
    } finally {
      setLoadingColonias(false);
    }
  }

  async function loadSucursales() {
    setLoadingSucursales(true);
    try {
      const sucs = await fetchSucursalesActivas();
      setSucursales(sucs || []);
    } catch (err) {
      console.error('Error cargando sucursales:', err);
    } finally {
      setLoadingSucursales(false);
    }
  }

  async function loadInvestigaciones() {
    setLoading(true);
    setSelectedIds([]); // limpiar selección al cambiar de página/filtro
    try {
      const params = { page, limit: 25, estado, buscar };
      if (coloniaSeleccionada) params.colonia = coloniaSeleccionada;
      if (sucursalSeleccionada) params.sucursal = sucursalSeleccionada;
      const res = await fetchInvestigaciones(params);
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Error cargando investigaciones:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    if (e && e.preventDefault) e.preventDefault();
    setPage(1);
    loadInvestigaciones();
  }

  async function openAssignModal(inv) {
    setSelectedInv(inv);
    try {
      const invs = await fetchInvestigadores();
      setInvestigadores(invs || []);
      if (inv.investigador_id && (invs || []).some(i => String(i.id) === String(inv.investigador_id))) {
        setSelectedInvestigadorId(String(inv.investigador_id));
      } else if (invs && invs.length > 0) {
        setSelectedInvestigadorId(String(invs[0].id));
      }
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
      setToast({ message: `Investigador asignado con éxito a la investigación #${selectedInv.id_sif_research}`, type: 'success' });
      loadInvestigaciones();
    } catch (err) {
      setToast({ message: 'Error asignando investigador: ' + err.message, type: 'error' });
    } finally {
      setAssigning(false);
    }
  }

  // ── Selección múltiple ──────────────────────────────────────────────────────
  function toggleSelectId(id) {
    const idStr = String(id);
    setSelectedIds((prev) =>
      prev.includes(idStr) ? prev.filter((item) => item !== idStr) : [...prev, idStr]
    );
  }

  function toggleSeleccionarTodos() {
    const todosIds = data.map((r) => String(r.id_sif_research));
    const todasSel = todosIds.every((id) => selectedIds.includes(id));
    if (todasSel) {
      setSelectedIds((prev) => prev.filter((id) => !todosIds.includes(id)));
    } else {
      setSelectedIds((prev) => {
        const nuevos = todosIds.filter((id) => !prev.includes(id));
        return [...prev, ...nuevos];
      });
    }
  }

  const todasSeleccionadas = data.length > 0 && data.every((r) => selectedIds.includes(String(r.id_sif_research)));
  const algunaSeleccionada = data.some((r) => selectedIds.includes(String(r.id_sif_research)));

  // ── Modal asignar lote ──────────────────────────────────────────────────────
  async function openLoteModal() {
    if (selectedIds.length === 0) {
      setToast({ message: 'Selecciona al menos una investigación antes de asignar.', type: 'warning' });
      return;
    }
    try {
      const invs = await fetchInvestigadores();
      setInvestigadores(invs || []);
      if (invs && invs.length > 0) setLoteInvestigadorId(String(invs[0].id));
    } catch (err) {
      console.error('Error cargando investigadores:', err);
    }
    setLoteModalOpen(true);
  }

  async function handleLoteSubmit() {
    if (selectedIds.length === 0 || !loteInvestigadorId) return;
    setAssigningLote(true);
    try {
      const res = await asignarInvestigadorLote(selectedIds, loteInvestigadorId);
      setLoteModalOpen(false);
      setSelectedIds([]);
      setToast({ message: res.message || `${selectedIds.length} investigaciones asignadas con éxito.`, type: 'success' });
      loadInvestigaciones();
      loadColonias();
    } catch (err) {
      setToast({ message: 'Error asignando en lote: ' + err.message, type: 'error' });
    } finally {
      setAssigningLote(false);
    }
  }

  // Colonia activa del filtro (objeto completo con conteos)
  const coloniaObj = colonias.find((c) => c.colonia === coloniaSeleccionada);
  // Sucursal activa del filtro
  const sucursalObj = sucursales.find((s) => String(s.sucursal_id) === String(sucursalSeleccionada));

  function exportarAExcel() {
    if (!data || data.length === 0) {
      setToast({ message: 'No hay datos de investigaciones para exportar.', type: 'warning' });
      return;
    }

    const headers = [
      'ID Investigación (SIF)',
      'Folio Solicitud',
      'Sucursal de Captación',
      'Tipo Sujeto',
      'Nombre Completo Socio',
      'Monto Solicitado',
      'Calle y Número',
      'Colonia',
      'Municipio',
      'Estado',
      'Investigador Asignado',
      'Estatus Estudio',
      'Fecha Asignación',
      'Fecha Cumplimiento',
    ];

    const rows = data.map((r) => [
      r.id_sif_research,
      r.solicitud_folio || 'N/A',
      `"${formatNombreSucursal(r.sucursal_id, r.sucursal_nombre)}"`,
      getEtiquetaSujetoUpper(r),
      `"${(r.sujeto_nombre || '').replace(/"/g, '""')}"`,
      `$${parseFloat(r.monto_solicitado || 0).toFixed(2)}`,
      `"${(r.calle ? `${r.calle} #${r.numero_exterior || ''}` : 'Sin Calle').replace(/"/g, '""')}"`,
      `"${(r.colonia || 'Sin Colonia').replace(/"/g, '""')}"`,
      `"${(r.municipio || 'Guadalajara').replace(/"/g, '""')}"`,
      `"${(r.estado_provincia || 'Jalisco').replace(/"/g, '""')}"`,
      `"${(r.investigador_nombre || 'Sin Asignar').replace(/"/g, '""')}"`,
      r.estado || 'PENDIENTE',
      r.fecha_asignacion ? new Date(r.fecha_asignacion).toLocaleDateString('es-MX') : 'Sin Asignar',
      r.fecha_cumplimiento ? new Date(r.fecha_cumplimiento).toLocaleDateString('es-MX') : 'En Proceso',
    ]);

    const csvText = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reporte_Investigaciones_CPO_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToast({ message: `Exportados ${data.length} registros exitosamente a Excel / CSV`, type: 'success' });
  }

  const totalPages = Math.ceil(total / 25) || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isAnalista ? '📊 Investigaciones Validadas — Revisión' : 'Investigaciones Domiciliarias'}
          </h2>
          <p className="text-slate-400 text-sm">
            {isAnalista
              ? 'Vista de solo lectura. Aquí aparecen únicamente las investigaciones que ya fueron aprobadas por el Validador.'
              : 'Administración, asignación y exportación de estudios a Solicitantes y Avales.'}
          </p>
        </div>

        {/* Search & Filter Bar — ocultar botones de acción para Analista */}
        <div className="flex flex-wrap items-center gap-2">
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

            {/* El Analista solo ve sus investigaciones VALIDADAS — no tiene filtro de estado */}
            {!isAnalista && (
              <select
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-sky-500"
              >
                <option value="">Activas (Cola de trabajo)</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="EN_PROCESO">En Proceso</option>
                <option value="COMPLETADA">Completadas en Campo</option>
                <option value="VALIDADA">Validadas / Visto Bueno ✅</option>
                <option value="RECHAZADA">Rechazadas ❌</option>
                <option value="TODAS">Ver Todas (Histórico Completo)</option>
              </select>
            )}
          </form>

          {!isAnalista && (
            <button
              onClick={exportarAExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition flex items-center gap-1.5"
              title="Exportar listado actual a Excel / CSV"
            >
              <FileText className="w-4 h-4" /> Exportar a Excel
            </button>
          )}
        </div>
      </div>

      {/* Banner informativo para Analista */}
      {isAnalista && (
        <div className="flex items-center gap-3 bg-teal-900/40 border border-teal-700/60 rounded-xl px-4 py-3 text-teal-300 text-sm">
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          <span>
            <strong>Modo Solo Lectura — Analista.</strong> Solo puedes consultar el formato completo de las investigaciones que el Validador ya aprobó. No puedes crear, modificar ni validar investigaciones.
          </span>
        </div>
      )}


      {/* ── Filtro por Colonia + Acciones Masivas (solo no-analista) ─────── */}
      {!isAnalista && (
        <div className="flex flex-wrap items-center gap-3">

          {/* Selector de Sucursal de Captación */}
          <div className="relative">
            <button
              onClick={() => { setSucursalDropdownOpen((prev) => !prev); setColoniaDropdownOpen(false); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                sucursalSeleccionada
                  ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
              title="Filtrar investigaciones por sucursal de captación"
            >
              <Building2 className="w-4 h-4 text-sky-400" />
              {sucursalSeleccionada
                ? <>Sucursal: <strong className="ml-1">{formatNombreSucursal(sucursalSeleccionada, sucursalObj?.sucursal_nombre)}</strong>
                    {sucursalObj && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                        {sucursalObj.total}
                      </span>
                    )}
                  </>
                : 'Filtrar por Sucursal'}
              <ChevronDown className="w-3.5 h-3.5 ml-1 text-slate-400" />
            </button>

            {sucursalDropdownOpen && (
              <div
                className="absolute top-full left-0 mt-2 z-40 bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl w-80 max-h-72 overflow-y-auto"
                onMouseLeave={() => setSucursalDropdownOpen(false)}
              >
                <div className="p-2 border-b border-slate-800 text-[11px] text-slate-400 font-semibold uppercase tracking-wider px-4 py-2.5 flex items-center justify-between">
                  <span>Sucursales con casos activos</span>
                  <span className="text-[10px] text-sky-400 font-normal">{sucursales.length} sucursales</span>
                </div>
                <button
                  onClick={() => { setSucursalSeleccionada(''); setPage(1); setSucursalDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-800 transition ${!sucursalSeleccionada ? 'text-sky-400 font-bold' : 'text-slate-300'}`}
                >
                  <span>🏢 Ver todas las sucursales</span>
                  {!sucursalSeleccionada && <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded-full">activo</span>}
                </button>
                {loadingSucursales ? (
                  <div className="text-center py-6 text-slate-500 text-xs">Cargando sucursales...</div>
                ) : sucursales.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">Sin sucursales disponibles</div>
                ) : (
                  sucursales.map((suc) => {
                    const isSel = String(sucursalSeleccionada) === String(suc.sucursal_id);
                    return (
                      <button
                        key={suc.sucursal_id}
                        onClick={() => { setSucursalSeleccionada(String(suc.sucursal_id)); setPage(1); setSucursalDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-800 transition ${
                          isSel ? 'text-sky-400 font-bold bg-sky-500/10' : 'text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">#{suc.sucursal_id}</span>
                          <span className="truncate">{formatNombreSucursal(suc.sucursal_id, suc.sucursal_nombre)}</span>
                        </span>
                        <div className="flex gap-1 shrink-0 ml-2">
                          <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">
                            {suc.total}
                          </span>
                          {parseInt(suc.sin_asignar) > 0 && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">
                              {suc.sin_asignar}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Botón limpiar filtro sucursal */}
          {sucursalSeleccionada && (
            <button
              onClick={() => { setSucursalSeleccionada(''); setPage(1); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold border border-slate-700 transition"
              title="Quitar filtro de sucursal"
            >
              <X className="w-3.5 h-3.5" /> Quitar sucursal
            </button>
          )}

          {/* Selector de Colonia */}
          <div className="relative">
            <button
              onClick={() => { setColoniaDropdownOpen((prev) => !prev); setSucursalDropdownOpen(false); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                coloniaSeleccionada
                  ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
              title="Filtrar investigaciones por colonia"
            >
              <MapPinned className="w-4 h-4" />
              {coloniaSeleccionada
                ? <>Colonia: <strong className="ml-1">{coloniaSeleccionada}</strong>
                    {coloniaObj && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                        {coloniaObj.total}
                      </span>
                    )}
                  </>
                : 'Filtrar por Colonia'}
              <ChevronDown className="w-3.5 h-3.5 ml-1 text-slate-400" />
            </button>

            {coloniaDropdownOpen && (
              <div
                className="absolute top-full left-0 mt-2 z-40 bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl w-80 max-h-72 overflow-y-auto"
                onMouseLeave={() => setColoniaDropdownOpen(false)}
              >
                <div className="p-2 border-b border-slate-800 text-[11px] text-slate-400 font-semibold uppercase tracking-wider px-4 py-2.5">
                  Colonias con casos activos
                </div>
                <button
                  onClick={() => { setColoniaSeleccionada(''); setPage(1); setColoniaDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-800 transition ${!coloniaSeleccionada ? 'text-sky-400 font-bold' : 'text-slate-300'}`}
                >
                  <span>🗺️ Ver todas las colonias</span>
                  {!coloniaSeleccionada && <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded-full">activo</span>}
                </button>
                {loadingColonias ? (
                  <div className="text-center py-6 text-slate-500 text-xs">Cargando colonias...</div>
                ) : colonias.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">Sin colonias disponibles</div>
                ) : (
                  colonias.map((col) => (
                    <button
                      key={col.colonia}
                      onClick={() => { setColoniaSeleccionada(col.colonia); setPage(1); setColoniaDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-800 transition ${
                        coloniaSeleccionada === col.colonia ? 'text-sky-400 font-bold bg-sky-500/10' : 'text-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {col.colonia}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">
                          {col.total} total
                        </span>
                        {parseInt(col.sin_asignar) > 0 && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">
                            {col.sin_asignar} sin asignar
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Botón limpiar filtro colonia */}
          {coloniaSeleccionada && (
            <button
              onClick={() => { setColoniaSeleccionada(''); setPage(1); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold border border-slate-700 transition"
              title="Quitar filtro de colonia"
            >
              <X className="w-3.5 h-3.5" /> Quitar colonia
            </button>
          )}

          {selectedIds.length > 0 && <div className="h-6 w-px bg-slate-700" />}

          {/* Botón Asignar Seleccionadas */}
          {selectedIds.length > 0 && (
            <button
              onClick={openLoteModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-lg shadow-sky-600/30 transition"
            >
              <Users className="w-4 h-4" />
              Asignar {selectedIds.length} seleccionada{selectedIds.length !== 1 ? 's' : ''}
            </button>
          )}

          {selectedIds.length > 0 && (
            <button
              onClick={() => setSelectedIds([])}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold border border-slate-700 transition"
              title="Limpiar selección"
            >
              <X className="w-3.5 h-3.5" /> Limpiar selección
            </button>
          )}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                {/* Columna Checkbox — solo para no-analistas */}
                {!isAnalista && (
                  <th className="px-4 py-3.5 w-10">
                    <button
                      onClick={toggleSeleccionarTodos}
                      title={todasSeleccionadas ? 'Deseleccionar todas' : 'Seleccionar todas en esta página'}
                      className="text-slate-400 hover:text-sky-400 transition"
                    >
                      {todasSeleccionadas
                        ? <CheckSquare className="w-4 h-4 text-sky-400" />
                        : algunaSeleccionada
                          ? <CheckSquare className="w-4 h-4 text-sky-400/50" />
                          : <Square className="w-4 h-4" />
                      }
                    </button>
                  </th>
                )}
                <th className="px-5 py-3.5">ID / Folio</th>
                <th className="px-5 py-3.5">Tipo Sujeto</th>
                <th className="px-5 py-3.5">Nombre del Socio</th>
                <th className="px-5 py-3.5">Domicilio y Colonia</th>
                <th className="px-5 py-3.5">Investigador Asignado</th>
                <th className="px-5 py-3.5">Vigencia Visita</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={isAnalista ? 8 : 9} className="text-center py-12 text-slate-500">
                    Cargando catálogo de investigaciones...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={isAnalista ? 8 : 9} className="text-center py-12 text-slate-500">
                    {coloniaSeleccionada
                      ? `No se encontraron investigaciones en la colonia "${coloniaSeleccionada}".`
                      : 'No se encontraron registros de investigación.'}
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const isChecked = selectedIds.includes(String(row.id_sif_research));
                  const rowBadge = getBadgeSujetoProps(row);
                  return (
                    <tr key={row.id_sif_research} className={`hover:bg-slate-800/30 transition ${isChecked ? 'bg-sky-500/5 border-l-2 border-sky-500' : ''}`}>
                      {/* Checkbox */}
                      {!isAnalista && (
                        <td className="px-4 py-4">
                          <button
                            onClick={() => toggleSelectId(row.id_sif_research)}
                            className="text-slate-500 hover:text-sky-400 transition"
                            title={isChecked ? 'Deseleccionar' : 'Seleccionar'}
                          >
                            {isChecked
                              ? <CheckSquare className="w-4 h-4 text-sky-400" />
                              : <Square className="w-4 h-4" />
                            }
                          </button>
                        </td>
                      )}
                      <td className="px-5 py-4 font-mono font-semibold text-slate-200">
                      <div>#{row.id_sif_research}</div>
                      <div className="text-[11px] text-slate-500 font-sans">Sol: {row.solicitud_folio || 'N/A'}</div>
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm" title={`Sucursal de Captación: ${formatNombreSucursal(row.sucursal_id, row.sucursal_nombre)}`}>
                          🏢 Suc. {formatNombreSucursal(row.sucursal_id, row.sucursal_nombre)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-300 font-sans font-medium" title="Fecha y Hora de captura por la sucursal (Horario local de la sucursal)">
                        <span className="text-sky-400">📅</span>
                        <span>
                          {formatFechaHoraCaptura(row.created_at || row.fecha_asignacion, row.sucursal_id)}
                        </span>
                      </div>
                      {row.paquete_total > 1 && (
                        <div className="mt-1">
                          {row.paquete_completo ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" title="Todas las investigaciones de este crédito fueron completadas">
                              🟢 Paquete {row.paquete_completadas}/{row.paquete_total}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30" title="Esperando visitas a avales o solicitante">
                              ⏳ Paquete {row.paquete_completadas}/{row.paquete_total}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase inline-flex items-center gap-1 ${rowBadge.badgeClass}`}>
                        <span>{rowBadge.icon}</span>
                        <span>{rowBadge.label}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">
                        {row.sujeto_nombre || 'Socio Desconocido'}
                      </div>
                      {/* ALERTA DE INCONSISTENCIA EN DATOS DE PERSONAS / POSTGRESQL */}
                      {row.tiene_inconsistencias ? (
                        <div className="mt-1.5 flex items-start gap-1">
                          <button
                            onClick={() => setContactoModalPersonaId(row.persona_id_sif || row.id_sif_research)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition text-left ${
                              row.nivel_inconsistencia === 'ALTA'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                            }`}
                            title={`Inconsistencias detectadas en PostgreSQL:\n• ${row.inconsistencias ? row.inconsistencias.join('\n• ') : 'Datos pendientes'}\n\nHaz clic para prevalidar/corregir`}
                          >
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>
                              {row.nivel_inconsistencia === 'ALTA' ? '⚠️ Inconsistencia Crítica' : '⚠️ Inconsistencia de Datos'}
                            </span>
                            <span className="text-[9px] underline opacity-80 ml-0.5">Revisar</span>
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium opacity-80" title="Información validada y consistente en PostgreSQL">
                            <CheckCircle2 className="w-3 h-3" /> Datos completos
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-300">
                      <div className="flex items-center gap-1 font-medium text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {row.calle ? `${row.calle} #${row.numero_exterior || ''}` : 'Sin Calle'}
                      </div>
                      <div className="text-[11px] text-sky-400 font-semibold pl-4">
                        🏡 {row.colonia ? `Col. ${row.colonia}` : 'Sin Colonia'}, {row.municipio || 'Guadalajara'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {row.investigador_nombre ? (
                        <span className="text-slate-200 font-medium">{row.investigador_nombre}</span>
                      ) : (
                        <span className="text-slate-500 italic">Sin Asignar</span>
                      )}
                    </td>

                    {/* COLUMNA VIGENCIA 90 DÍAS */}
                    <td className="px-5 py-4 text-xs">
                      {row.visita_vigente ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 text-[10px] font-bold">
                            <ShieldCheck className="w-3 h-3" />
                            Vigente hasta {formatFechaCorta(row.visita_vigente_hasta)}
                          </span>
                          <Link
                            to={`/investigaciones/${row.visita_previa_id}`}
                            className="text-[10px] text-sky-500 hover:text-sky-300 underline pl-0.5"
                          >
                            Ver visita #{row.visita_previa_id}
                          </Link>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-[10px] italic">Sin visita previa</span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        row.estado === 'APROBADA_FINAL'
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold'
                          : row.estado === 'DEVUELTA_A_VALIDADOR'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold'
                          : row.estado === 'VALIDADA'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold'
                          : row.estado === 'RECHAZADA'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold'
                          : row.estado === 'COMPLETADA'
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                          : row.estado === 'EN_PROCESO'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {row.estado === 'APROBADA_FINAL' ? '✅✅ APROBADA FINAL'
                          : row.estado === 'DEVUELTA_A_VALIDADOR' ? '🔄 DEVUELTA'
                          : row.estado === 'VALIDADA' ? 'VALIDADA ✅'
                          : row.estado === 'RECHAZADA' ? 'RECHAZADA ❌'
                          : row.estado}
                      </span>
                      {/* Dictamen/Observaciones del Validador */}
                      {row.validador_nombre && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-teal-400" title={`Validador: ${row.validador_nombre}${row.comentarios_validacion ? ` — "${row.comentarios_validacion}"` : ''}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                          <span className="truncate max-w-[130px]">Val: {row.validador_nombre}</span>
                        </div>
                      )}
                      {row.comentarios_validacion && (
                        <div className="mt-0.5 text-[10px] text-slate-400 italic truncate max-w-[150px]" title={`Dictamen Validador: "${row.comentarios_validacion}"`}>
                          💬 "{row.comentarios_validacion}"
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right space-x-2">
                      {!isAnalista && (
                        <button
                          onClick={() => openAssignModal(row)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-sky-600 text-sky-400 hover:text-white text-xs font-semibold transition"
                          title="Asignar Investigador"
                        >
                          <UserPlus className="w-3.5 h-3.5 inline mr-1" />
                          Asignar
                        </button>
                      )}

                      <button
                        onClick={() => setDocModalSolicitudId(row.solicitud_id_sif || row.id_sif_research)}
                        className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition inline-flex items-center gap-1"
                        title="Ver Expediente Digital y Semáforo Documental"
                      >
                        📁 Expediente
                      </button>

                      <button
                        onClick={() => setNotifModalSolicitudId(row.solicitud_id_sif || row.id_sif_research)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition inline-flex items-center gap-1"
                        title="Comunicación Interáreas y Requerimientos"
                      >
                        💬 Notificaciones
                      </button>

                      <button
                        onClick={() => setAgendaModalInvId(row.id_sif_research)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition inline-flex items-center gap-1"
                        title="Agenda Dinámica y Control de Visitas"
                      >
                        📅 Agenda
                      </button>

                      <button
                        onClick={() => setContactoModalPersonaId(row.persona_id_sif || row.id_sif_research)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition inline-flex items-center gap-1"
                        title="Prevalidación de Domicilio y Semáforo de Contacto"
                      >
                        🏡 Domicilio
                      </button>

                      <Link
                        to={`/investigaciones/${row.id_sif_research}`}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition inline-flex items-center gap-1 shadow-md shadow-sky-600/20"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {isAnalista ? 'Consultar' : 'Ver Formato'}
                      </Link>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            {selectedIds.length > 0 && (
              <span className="mr-4 text-sky-400 font-semibold">
                ✓ {selectedIds.length} seleccionada{selectedIds.length !== 1 ? 's' : ''}
              </span>
            )}
            Mostrando página <span className="text-white font-semibold">{page}</span> de{' '}
            <span className="text-white font-semibold">{totalPages}</span> ({total.toLocaleString()} totales)
            {coloniaSeleccionada && (
              <span className="ml-2 text-sky-400">— Colonia: <strong>{coloniaSeleccionada}</strong></span>
            )}
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

      {/* Modal Expediente Documental con Semáforo */}
      {docModalSolicitudId && (
        <ChecklistDocumentalModal
          solicitudId={docModalSolicitudId}
          tipoCredito="GENERAL"
          onClose={() => setDocModalSolicitudId(null)}
        />
      )}

      {/* Modal Notificaciones Interáreas */}
      {notifModalSolicitudId && (
        <NotificacionesInterareasModal
          solicitudId={notifModalSolicitudId}
          onClose={() => setNotifModalSolicitudId(null)}
        />
      )}

      {/* Modal Prevalidación Domicilio y Semáforo Contacto */}
      {contactoModalPersonaId && (
        <PrevalidacionContactoModal
          personaIdSif={contactoModalPersonaId}
          onClose={() => setContactoModalPersonaId(null)}
        />
      )}

      {/* Modal Agenda Dinámica */}
      {agendaModalInvId && (
        <AgendaVisitasModal
          investigacionId={agendaModalInvId}
          onClose={() => setAgendaModalInvId(null)}
        />
      )}

      {/* Assignment Modal */}
      {selectedInv && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Asignar Investigador en Campo</h3>
            <p className="text-xs text-slate-400">
              Selecciona al investigador responsable para la visita de <strong className="text-white">{selectedInv.sujeto_nombre}</strong>.
            </p>

            {/* ADVERTENCIA DE INCONSISTENCIA PARA EL ASIGNADOR */}
            {selectedInv.tiene_inconsistencias && (
              <div className={`p-3.5 rounded-xl border space-y-2 text-xs ${
                selectedInv.nivel_inconsistencia === 'ALTA'
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                  : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
              }`}>
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>⚠️ Alerta: Inconsistencia en Datos del Socio</span>
                </div>
                <p className="text-[11px] opacity-90">
                  Se detectaron las siguientes inconsistencias en la ficha de PostgreSQL:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1 font-medium">
                  {selectedInv.inconsistencias && selectedInv.inconsistencias.map((inc, i) => (
                    <li key={i}>{inc}</li>
                  ))}
                </ul>
                <div className="pt-1 flex items-center justify-between text-[11px]">
                  <span className="italic opacity-80">Puedes asignar sabiendo esto o corregirlo antes:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const pId = selectedInv.persona_id_sif || selectedInv.id_sif_research;
                      setSelectedInv(null);
                      setContactoModalPersonaId(pId);
                    }}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold transition ml-2 shrink-0"
                  >
                    Corregir Datos
                  </button>
                </div>
              </div>
            )}

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
                {assigning ? 'Asignando...' : selectedInv.tiene_inconsistencias ? 'Asignar de Todos Modos' : 'Confirmar Asignación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Barra de Acción Masiva Fija (cuando hay selección) ───────── */}
      {!isAnalista && selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4
                        bg-slate-900/95 backdrop-blur-md border border-sky-500/40 rounded-2xl
                        px-6 py-3 shadow-2xl shadow-sky-900/40 ring-1 ring-sky-500/20">
          <div className="flex items-center gap-2 text-sm text-white font-semibold">
            <CheckSquare className="w-5 h-5 text-sky-400" />
            <span>{selectedIds.length} investigación{selectedIds.length !== 1 ? 'es' : ''} seleccionada{selectedIds.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="h-5 w-px bg-slate-600" />
          <button
            onClick={openLoteModal}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold transition shadow-lg shadow-sky-600/30"
          >
            <Users className="w-4 h-4" /> Asignar a Investigador
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="text-slate-400 hover:text-white transition"
            title="Cancelar selección"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── Modal Asignar Lote ─────────────────────────────────────────── */}
      {loteModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl ring-1 ring-sky-500/20">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-400" />
                  Asignación en Lote
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Se asignarán{' '}
                  <span className="text-sky-300 font-bold">{selectedIds.length} investigación{selectedIds.length !== 1 ? 'es' : ''}</span>
                  {coloniaSeleccionada && (
                    <> de la colonia <span className="text-sky-300 font-bold">{coloniaSeleccionada}</span></>
                  )}{' '}
                  al investigador seleccionado.
                </p>
              </div>
              <button onClick={() => setLoteModalOpen(false)} className="text-slate-500 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen de IDs seleccionados */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 max-h-28 overflow-y-auto">
              <div className="text-[11px] text-slate-500 font-semibold mb-1.5 uppercase tracking-wider">
                Investigaciones seleccionadas
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedIds.map((id) => (
                  <span key={id} className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 text-[11px] font-mono border border-sky-500/30">
                    #{id}
                  </span>
                ))}
              </div>
            </div>

            {/* Selector de investigador */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Investigador a asignar:</label>
              <select
                value={loteInvestigadorId}
                onChange={(e) => setLoteInvestigadorId(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {investigadores.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} — {i.rol}
                  </option>
                ))}
              </select>
            </div>

            {/* Aviso si existen inconsistencias en el lote */}
            {(() => {
              const conInconsistencia = data.filter(d => selectedIds.includes(String(d.id_sif_research)) && d.tiene_inconsistencias);
              if (conInconsistencia.length === 0) return null;
              return (
                <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-500/40 rounded-xl px-4 py-3 text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">
                      {conInconsistencia.length} de {selectedIds.length} investigaciones seleccionadas presentan inconsistencias en los datos del socio.
                    </strong>
                    <span className="text-[11px] opacity-80">
                      Como asignador, puedes proceder y asignarlas sabiendo de antemano estos detalles.
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Aviso de sincronización móvil */}
            <div className="flex items-start gap-2 bg-sky-500/10 border border-sky-500/20 rounded-xl px-4 py-3 text-sky-300 text-xs">
              <span className="text-base">⚡</span>
              <span>
                Las investigaciones aparecerán <strong>inmediatamente</strong> en la aplicación móvil del investigador al actualizar su lista de trabajo.
              </span>
            </div>

            {/* Botones */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => setLoteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
              >
                Cancelar
              </button>
              <button
                disabled={assigningLote || !loteInvestigadorId}
                onClick={handleLoteSubmit}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-bold transition shadow-lg shadow-sky-600/30"
              >
                {assigningLote ? 'Asignando...' : `Confirmar Asignación (${selectedIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificación Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'success' })}
      />
    </div>
  );
}
