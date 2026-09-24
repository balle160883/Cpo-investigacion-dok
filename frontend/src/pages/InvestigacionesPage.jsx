import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { fetchInvestigaciones, fetchInvestigadores, asignarInvestigador, asignarInvestigadorLote, asignarAnalistaCredito, asignarAnalistaLote, asignarAnalistaPorSucursales, fetchColoniasActivas, fetchSucursalesActivas, eliminarInvestigacionApi } from '../services/api';
import { Search, Eye, UserPlus, MapPin, FileText, ChevronLeft, ChevronRight, ShieldCheck, CheckSquare, Square, Users, X, MapPinned, ChevronDown, Building2, AlertTriangle, CheckCircle2, UserCheck, Lock, Trash2 } from 'lucide-react';
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
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const d = new Date(fechaStr);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${meses[d.getMonth()]}/${d.getFullYear()}`;
}

export default function InvestigacionesPage() {
  const auth = useAuth();
  const userRole = (() => {
    if (auth?.user?.rol) return auth.user.rol.toLowerCase();
    try { return (JSON.parse(localStorage.getItem('cpo_user') || '{}').rol || '').toLowerCase(); } catch { return ''; }
  })();
  const userName = (() => {
    if (auth?.user?.nombre) return auth.user.nombre.toLowerCase();
    try { return (JSON.parse(localStorage.getItem('cpo_user') || '{}').nombre || '').toLowerCase(); } catch { return ''; }
  })();
  const userEmail = (() => {
    if (auth?.user?.email) return auth.user.email.toLowerCase();
    try { return (JSON.parse(localStorage.getItem('cpo_user') || '{}').email || '').toLowerCase(); } catch { return ''; }
  })();
  const isNormaBermejo = userName.includes('norma') || userName.includes('bermejo') || userEmail.includes('norma') || userEmail.includes('bermejo');
  const isAnalista = userRole === 'analista' && !isNormaBermejo;
  // Solo administradores y asignadores pueden asignar investigadores de campo. Norma Bermejo y analistas NO asignan visitas.
  const canAssign = ['superadmin', 'admin', 'asignador'].some(r => userRole.includes(r)) && !isNormaBermejo && userRole !== 'analista';
  // Norma Lizette Bermejo y coordinadores/administradores pueden asignar analistas a los préstamos validados
  const canAssignAnalista = isNormaBermejo || ['superadmin', 'admin', 'coordinadora_analistas', 'coordinador_analistas', 'gerente_analistas'].some(r => userRole.includes(r));
  // Permiso para seleccionar con checkboxes: asignadores de campo O asignadores de analistas
  const canSelectCheckboxes = canAssign || canAssignAnalista;
  // Solo los usuarios con rol de validador (o superadmin) pueden eliminar investigaciones
  const canDeleteInv = userRole.includes('validador') || userRole === 'superadmin';

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState(isNormaBermejo ? 'TODAS' : '');
  const [loading, setLoading] = useState(true);

  // Modal Asignar Analista a Crédito (cuando todas las investigaciones están validadas)
  const [analistaModalCredito, setAnalistaModalCredito] = useState(null);
  const [analistasDisponibles, setAnalistasDisponibles] = useState([]);
  const [selectedAnalistaId, setSelectedAnalistaId] = useState('');
  const [assigningAnalista, setAssigningAnalista] = useState(false);

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

  // Modal Asignar Lote Investigador
  const [loteModalOpen, setLoteModalOpen] = useState(false);
  const [loteInvestigadorId, setLoteInvestigadorId] = useState('');
  const [assigningLote, setAssigningLote] = useState(false);

  // Modal Asignar Lote Analistas
  const [loteAnalistaModalOpen, setLoteAnalistaModalOpen] = useState(false);
  const [loteAnalistaId, setLoteAnalistaId] = useState('');
  const [assigningLoteAnalista, setAssigningLoteAnalista] = useState(false);

  // Modal Asignar por Sucursal a Analista
  const [asignarPorSucursalModalOpen, setAsignarPorSucursalModalOpen] = useState(false);
  const [sucursalesSeleccionadasParaAnalista, setSucursalesSeleccionadasParaAnalista] = useState([]);
  const [sucursalAnalistaId, setSucursalAnalistaId] = useState('');
  const [reasignarExistentes, setReasignarExistentes] = useState(false);
  const [assigningPorSucursales, setAssigningPorSucursales] = useState(false);

  // Modal Eliminar / Cancelar Investigación (Exclusivo Validador)
  const [deletingInv, setDeletingInv] = useState(null);
  const [deleteMotivo, setDeleteMotivo] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!deletingInv) return;
    setIsDeleting(true);
    try {
      await eliminarInvestigacionApi(deletingInv.id_sif_research, deleteMotivo);
      setToast({ message: `Investigación Folio: ${deletingInv.id_sif_research} eliminada exitosamente.`, type: 'success' });
      setDeletingInv(null);
      setDeleteMotivo('');
      loadInvestigaciones();
    } catch (err) {
      setToast({ message: err.message || 'Error al eliminar la investigación.', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  }

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

  async function openAsignarAnalistaModal(row) {
    setAnalistaModalCredito(row);
    setSelectedAnalistaId(row.analista_id ? String(row.analista_id) : '');
    try {
      const todos = await fetchInvestigadores();
      // Filtrar analistas activos o administradores
      const soloAnalistas = (todos || []).filter(u =>
        (u.rol || '').toLowerCase().includes('analista') ||
        (u.rol || '').toLowerCase().includes('admin')
      );
      setAnalistasDisponibles(soloAnalistas);
      if (!row.analista_id && soloAnalistas.length > 0) {
        setSelectedAnalistaId(String(soloAnalistas[0].id));
      }
    } catch (e) {
      console.error('Error cargando lista de analistas:', e);
    }
  }

  async function handleConfirmAsignarAnalista() {
    if (!analistaModalCredito || !selectedAnalistaId) return;
    setAssigningAnalista(true);
    try {
      const res = await asignarAnalistaCredito({
        solicitud_id_sif: analistaModalCredito.solicitud_id_sif,
        investigacion_id: analistaModalCredito.id_sif_research,
        analista_id: selectedAnalistaId,
      });
      setToast({
        message: res.message || 'Analista asignado con éxito al préstamo',
        type: 'success',
      });
      setAnalistaModalCredito(null);
      await loadInvestigaciones();
    } catch (err) {
      setToast({
        message: err.message || 'Error al asignar analista',
        type: 'error',
      });
    } finally {
      setAssigningAnalista(false);
    }
  }

  async function handleAssignSubmit() {
    if (!selectedInv || !selectedInvestigadorId) return;
    setAssigning(true);
    try {
      await asignarInvestigador(selectedInv.id_sif_research, selectedInvestigadorId);
      setSelectedInv(null);
      setToast({ message: `Investigador asignado con éxito a la investigación Folio: ${selectedInv.id_sif_research}`, type: 'success' });
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

  // ── Modal asignar analistas en lote ─────────────────────────────────────────
  async function openLoteAnalistaModal() {
    if (selectedIds.length === 0) {
      setToast({ message: 'Selecciona al menos un crédito antes de asignar analista.', type: 'warning' });
      return;
    }
    try {
      const todos = await fetchInvestigadores();
      const soloAnalistas = (todos || []).filter((u) =>
        (u.rol || '').toLowerCase().includes('analista') ||
        (u.rol || '').toLowerCase().includes('admin')
      );
      setAnalistasDisponibles(soloAnalistas);
      if (soloAnalistas && soloAnalistas.length > 0) {
        setLoteAnalistaId(String(soloAnalistas[0].id));
      }
    } catch (err) {
      console.error('Error cargando catálogo de analistas:', err);
    }
    setLoteAnalistaModalOpen(true);
  }

  async function handleLoteAnalistaSubmit() {
    if (selectedIds.length === 0 || !loteAnalistaId) return;
    setAssigningLoteAnalista(true);
    try {
      const res = await asignarAnalistaLote({
        investigacion_ids: selectedIds,
        analista_id: loteAnalistaId,
      });
      setLoteAnalistaModalOpen(false);
      setSelectedIds([]);
      setToast({
        message: res.message || `${res.asignadas_count || selectedIds.length} crédito(s) asignados al analista con éxito.`,
        type: 'success',
      });
      loadInvestigaciones();
    } catch (err) {
      setToast({
        message: err.message || 'Error al asignar analista en lote',
        type: 'error',
      });
    } finally {
      setAssigningLoteAnalista(false);
    }
  }

  // ── Modal asignar analista por sucursales completas ─────────────────────────
  async function openAsignarPorSucursalesModal() {
    try {
      const todos = await fetchInvestigadores();
      const soloAnalistas = (todos || []).filter((u) =>
        (u.rol || '').toLowerCase().includes('analista') ||
        (u.rol || '').toLowerCase().includes('admin')
      );
      setAnalistasDisponibles(soloAnalistas);
      if (soloAnalistas && soloAnalistas.length > 0) {
        setSucursalAnalistaId(String(soloAnalistas[0].id));
      }
      await loadSucursales();
    } catch (err) {
      console.error('Error preparando modal de asignación por sucursal:', err);
    }
    // Si ya había una sucursal filtrada activa, preseleccionarla
    if (sucursalSeleccionada) {
      setSucursalesSeleccionadasParaAnalista([String(sucursalSeleccionada)]);
    } else {
      setSucursalesSeleccionadasParaAnalista([]);
    }
    setAsignarPorSucursalModalOpen(true);
  }

  function toggleSucursalSeleccionadaParaAnalista(id) {
    const idStr = String(id);
    setSucursalesSeleccionadasParaAnalista((prev) =>
      prev.includes(idStr) ? prev.filter((item) => item !== idStr) : [...prev, idStr]
    );
  }

  function toggleTodasSucursalesParaAnalista() {
    const todasIds = sucursales.map((s) => String(s.sucursal_id));
    const estanTodas = todasIds.length > 0 && todasIds.every((id) => sucursalesSeleccionadasParaAnalista.includes(id));
    if (estanTodas) {
      setSucursalesSeleccionadasParaAnalista([]);
    } else {
      setSucursalesSeleccionadasParaAnalista(todasIds);
    }
  }

  async function handleConfirmAsignarPorSucursales() {
    if (sucursalesSeleccionadasParaAnalista.length === 0 || !sucursalAnalistaId) return;
    setAssigningPorSucursales(true);
    try {
      const res = await asignarAnalistaPorSucursales({
        sucursal_ids: sucursalesSeleccionadasParaAnalista,
        analista_id: sucursalAnalistaId,
        reasignar_existentes: reasignarExistentes,
      });
      setAsignarPorSucursalModalOpen(false);
      setToast({
        message: res.message || `${res.total_asignados || 0} crédito(s) asignados al analista exitosamente.`,
        type: 'success',
      });
      loadInvestigaciones();
      loadSucursales();
    } catch (err) {
      setToast({
        message: err.message || 'Error al asignar analista por sucursales',
        type: 'error',
      });
    } finally {
      setAssigningPorSucursales(false);
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
      <div className={clsx('flex', 'flex-col', 'md:flex-row', 'md:items-center', 'justify-between', 'gap-4')}>
        <div>
          <h2 className={clsx('text-2xl', 'font-bold', 'text-white', 'tracking-tight')}>
            {isNormaBermejo
              ? 'Todas las Investigaciones Domiciliarias'
              : isAnalista
                ? '📊 Mis Investigaciones Asignadas — Revisión'
                : 'Investigaciones Domiciliarias'}
          </h2>
          <p className={clsx('text-slate-400', 'text-sm')}>
            {isNormaBermejo
              ? 'Vista global de todas las investigaciones sin restricción de estado para Norma Lizette Bermejo Palos.'
              : isAnalista
                ? 'Aquí aparecen únicamente las investigaciones validadas que tu supervisora te ha asignado para revisión y dictamen.'
                : 'Administración, asignación y exportación de estudios a Solicitantes y Avales.'}
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className={clsx('flex', 'flex-wrap', 'items-center', 'gap-2')}>
          <form onSubmit={handleSearch} className={clsx('flex', 'items-center', 'gap-2')}>
            <div className="relative">
              <Search className={clsx('w-4', 'h-4', 'text-slate-500', 'absolute', 'left-3', 'top-3')} />
              <input
                type="text"
                placeholder="Buscar por nombre, folio..."
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                className={clsx('pl-9', 'pr-4', 'py-2', 'rounded-xl', 'bg-slate-900', 'border', 'border-slate-800', 'text-sm', 'text-slate-200', 'focus:outline-none', 'focus:border-sky-500', 'w-64')}
              />
            </div>

            {/* Selector de estado: Norma y no-analistas pueden filtrar cualquier estado libremente */}
            {(!isAnalista || isNormaBermejo) && (
              <select
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value);
                  setPage(1);
                }}
                className={clsx('px-3', 'py-2', 'rounded-xl', 'bg-slate-900', 'border', 'border-slate-800', 'text-sm', 'text-slate-300', 'focus:outline-none', 'focus:border-sky-500')}
              >
                <option value="">Activas (Cola de trabajo - Últimos 90 días)</option>
                <option value="TODAS">Ver Todas (Histórico Completo)</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="EN_PROCESO">En Proceso</option>
                <option value="COMPLETADA">Completadas en Campo</option>
                <option value="VALIDADA">Validadas / Visto Bueno ✅</option>
                <option value="RECHAZADA">Rechazadas ❌</option>
                <option value="CANCELADA">Canceladas / Eliminadas 🗑️</option>
              </select>
            )}
          </form>

          {(!isAnalista || isNormaBermejo) && (
            <button
              onClick={exportarAExcel}
              className={clsx('px-3.5', 'py-2', 'rounded-xl', 'bg-emerald-600', 'hover:bg-emerald-500', 'text-white', 'text-xs', 'font-semibold', 'shadow-lg', 'shadow-emerald-600/20', 'transition', 'flex', 'items-center', 'gap-1.5')}
              title="Exportar listado actual a Excel / CSV"
            >
              <FileText className={clsx('w-4', 'h-4')} /> Exportar a Excel
            </button>
          )}

          {canAssignAnalista && (
            <button
              onClick={openAsignarPorSucursalesModal}
              className={clsx('px-3.5', 'py-2', 'rounded-xl', 'bg-indigo-600', 'hover:bg-indigo-500', 'text-white', 'text-xs', 'font-semibold', 'shadow-lg', 'shadow-indigo-600/30', 'transition', 'flex', 'items-center', 'gap-1.5')}
              title="Asignar en bloque créditos validados de sucursales a un analista"
            >
              <Building2 className={clsx('w-4', 'h-4')} /> Asignar por Sucursal
            </button>
          )}
        </div>
      </div>

      {/* Banner informativo para Norma Bermejo */}
      {isNormaBermejo && (
        <div className={clsx('flex', 'items-center', 'gap-3', 'bg-sky-950/40', 'border', 'border-sky-700/60', 'rounded-xl', 'px-4', 'py-3', 'text-sky-300', 'text-sm')}>
          <ShieldCheck className={clsx('w-5', 'h-5', 'flex-shrink-0', 'text-sky-400')} />
          <span>
            <strong>Acceso Global Habilitado (Norma Lizette Bermejo Palos):</strong> Cuentas con visibilidad total de todas las investigaciones del sistema en cualquier estado (Pendiente, En Proceso, Completada, Validada o Rechazada).
          </span>
        </div>
      )}

      {/* Banner informativo para Analista */}
      {isAnalista && !isNormaBermejo && (
        <div className={clsx('flex', 'items-center', 'gap-3', 'bg-teal-900/40', 'border', 'border-teal-700/60', 'rounded-xl', 'px-4', 'py-3', 'text-teal-300', 'text-sm')}>
          <ShieldCheck className={clsx('w-5', 'h-5', 'flex-shrink-0')} />
          <span>
            <strong>Modo Solo Lectura — Analista:</strong> Solo puedes consultar el formato de las investigaciones validadas asignadas a tu cuenta por supervisión.
          </span>
        </div>
      )}


      {/* ── Filtro por Colonia + Acciones Masivas (solo no-analista) ─────── */}
      {!isAnalista && (
        <div className={clsx('flex', 'flex-wrap', 'items-center', 'gap-3')}>

          {/* Selector de Sucursal de Captación */}
          <div className="relative">
            <button
              onClick={() => { setSucursalDropdownOpen((prev) => !prev); setColoniaDropdownOpen(false); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${sucursalSeleccionada
                  ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              title="Filtrar investigaciones por sucursal de captación"
            >
              <Building2 className={clsx('w-4', 'h-4', 'text-sky-400')} />
              {sucursalSeleccionada
                ? <>Sucursal: <strong className="ml-1">{formatNombreSucursal(sucursalSeleccionada, sucursalObj?.sucursal_nombre)}</strong>
                  {sucursalObj && (
                    <span className={clsx('ml-1.5', 'px-1.5', 'py-0.5', 'rounded-full', 'bg-sky-500/20', 'text-sky-300', 'text-[10px]', 'font-bold')}>
                      {sucursalObj.total}
                    </span>
                  )}
                </>
                : 'Filtrar por Sucursal'}
              <ChevronDown className={clsx('w-3.5', 'h-3.5', 'ml-1', 'text-slate-400')} />
            </button>

            {sucursalDropdownOpen && (
              <div
                className={clsx('absolute', 'top-full', 'left-0', 'mt-2', 'z-40', 'bg-slate-950', 'border', 'border-slate-700', 'rounded-2xl', 'shadow-2xl', 'w-80', 'max-h-72', 'overflow-y-auto')}
                onMouseLeave={() => setSucursalDropdownOpen(false)}
              >
                <div className={clsx('p-2', 'border-b', 'border-slate-800', 'text-[11px]', 'text-slate-400', 'font-semibold', 'uppercase', 'tracking-wider', 'px-4', 'py-2.5', 'flex', 'items-center', 'justify-between')}>
                  <span>Sucursales con casos activos</span>
                  <span className={clsx('text-[10px]', 'text-sky-400', 'font-normal')}>{sucursales.length} sucursales</span>
                </div>
                <button
                  onClick={() => { setSucursalSeleccionada(''); setPage(1); setSucursalDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-800 transition ${!sucursalSeleccionada ? 'text-sky-400 font-bold' : 'text-slate-300'}`}
                >
                  <span>🏢 Ver todas las sucursales</span>
                  {!sucursalSeleccionada && <span className={clsx('text-[10px]', 'bg-sky-500/20', 'text-sky-300', 'px-1.5', 'py-0.5', 'rounded-full')}>activo</span>}
                </button>
                {loadingSucursales ? (
                  <div className={clsx('text-center', 'py-6', 'text-slate-500', 'text-xs')}>Cargando sucursales...</div>
                ) : sucursales.length === 0 ? (
                  <div className={clsx('text-center', 'py-6', 'text-slate-500', 'text-xs')}>Sin sucursales disponibles</div>
                ) : (
                  sucursales.map((suc) => {
                    const isSel = String(sucursalSeleccionada) === String(suc.sucursal_id);
                    return (
                      <button
                        key={suc.sucursal_id}
                        onClick={() => { setSucursalSeleccionada(String(suc.sucursal_id)); setPage(1); setSucursalDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-800 transition ${isSel ? 'text-sky-400 font-bold bg-sky-500/10' : 'text-slate-300'
                          }`}
                      >
                        <span className={clsx('flex', 'items-center', 'gap-2', 'truncate')}>
                          <span className={clsx('text-[10px]', 'font-mono', 'font-bold', 'px-1.5', 'py-0.5', 'rounded', 'bg-slate-800', 'text-slate-400', 'border', 'border-slate-700', 'shrink-0')}>#{suc.sucursal_id}</span>
                          <span className="truncate">{formatNombreSucursal(suc.sucursal_id, suc.sucursal_nombre)}</span>
                        </span>
                        <div className={clsx('flex', 'gap-1', 'shrink-0', 'ml-2')}>
                          <span className={clsx('text-[10px]', 'bg-slate-700', 'text-slate-300', 'px-1.5', 'py-0.5', 'rounded-full')}>
                            {suc.total}
                          </span>
                          {parseInt(suc.sin_asignar) > 0 && (
                            <span className={clsx('text-[10px]', 'bg-amber-500/20', 'text-amber-300', 'px-1.5', 'py-0.5', 'rounded-full')}>
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
              className={clsx('flex', 'items-center', 'gap-1.5', 'px-3', 'py-2', 'rounded-xl', 'bg-slate-800', 'hover:bg-slate-700', 'text-slate-400', 'hover:text-white', 'text-xs', 'font-semibold', 'border', 'border-slate-700', 'transition')}
              title="Quitar filtro de sucursal"
            >
              <X className={clsx('w-3.5', 'h-3.5')} /> Quitar sucursal
            </button>
          )}

          {/* Selector de Colonia */}
          <div className="relative">
            <button
              onClick={() => { setColoniaDropdownOpen((prev) => !prev); setSucursalDropdownOpen(false); }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${coloniaSeleccionada
                  ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              title="Filtrar investigaciones por colonia"
            >
              <MapPinned className={clsx('w-4', 'h-4')} />
              {coloniaSeleccionada
                ? <>Colonia: <strong className="ml-1">{coloniaSeleccionada}</strong>
                  {coloniaObj && (
                    <span className={clsx('ml-1.5', 'px-1.5', 'py-0.5', 'rounded-full', 'bg-sky-500/20', 'text-sky-300', 'text-[10px]', 'font-bold')}>
                      {coloniaObj.total}
                    </span>
                  )}
                </>
                : 'Filtrar por Colonia'}
              <ChevronDown className={clsx('w-3.5', 'h-3.5', 'ml-1', 'text-slate-400')} />
            </button>

            {coloniaDropdownOpen && (
              <div
                className={clsx('absolute', 'top-full', 'left-0', 'mt-2', 'z-40', 'bg-slate-950', 'border', 'border-slate-700', 'rounded-2xl', 'shadow-2xl', 'w-80', 'max-h-72', 'overflow-y-auto')}
                onMouseLeave={() => setColoniaDropdownOpen(false)}
              >
                <div className={clsx('p-2', 'border-b', 'border-slate-800', 'text-[11px]', 'text-slate-400', 'font-semibold', 'uppercase', 'tracking-wider', 'px-4', 'py-2.5')}>
                  Colonias con casos activos
                </div>
                <button
                  onClick={() => { setColoniaSeleccionada(''); setPage(1); setColoniaDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-800 transition ${!coloniaSeleccionada ? 'text-sky-400 font-bold' : 'text-slate-300'}`}
                >
                  <span>🗺️ Ver todas las colonias</span>
                  {!coloniaSeleccionada && <span className={clsx('text-[10px]', 'bg-sky-500/20', 'text-sky-300', 'px-1.5', 'py-0.5', 'rounded-full')}>activo</span>}
                </button>
                {loadingColonias ? (
                  <div className={clsx('text-center', 'py-6', 'text-slate-500', 'text-xs')}>Cargando colonias...</div>
                ) : colonias.length === 0 ? (
                  <div className={clsx('text-center', 'py-6', 'text-slate-500', 'text-xs')}>Sin colonias disponibles</div>
                ) : (
                  colonias.map((col) => (
                    <button
                      key={col.colonia}
                      onClick={() => { setColoniaSeleccionada(col.colonia); setPage(1); setColoniaDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-800 transition ${coloniaSeleccionada === col.colonia ? 'text-sky-400 font-bold bg-sky-500/10' : 'text-slate-300'
                        }`}
                    >
                      <span className={clsx('flex', 'items-center', 'gap-2')}>
                        <MapPin className={clsx('w-3.5', 'h-3.5', 'text-slate-500', 'shrink-0')} />
                        {col.colonia}
                      </span>
                      <div className={clsx('flex', 'gap-1', 'shrink-0')}>
                        <span className={clsx('text-[10px]', 'bg-slate-700', 'text-slate-300', 'px-1.5', 'py-0.5', 'rounded-full')}>
                          {col.total} total
                        </span>
                        {parseInt(col.sin_asignar) > 0 && (
                          <span className={clsx('text-[10px]', 'bg-amber-500/20', 'text-amber-300', 'px-1.5', 'py-0.5', 'rounded-full')}>
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
              className={clsx('flex', 'items-center', 'gap-1.5', 'px-3', 'py-2', 'rounded-xl', 'bg-slate-800', 'hover:bg-slate-700', 'text-slate-400', 'hover:text-white', 'text-xs', 'font-semibold', 'border', 'border-slate-700', 'transition')}
              title="Quitar filtro de colonia"
            >
              <X className={clsx('w-3.5', 'h-3.5')} /> Quitar colonia
            </button>
          )}

          {canSelectCheckboxes && selectedIds.length > 0 && <div className={clsx('h-6', 'w-px', 'bg-slate-700')} />}

          {/* Botón Asignar Investigador de campo en lote */}
          {canAssign && selectedIds.length > 0 && (
            <button
              onClick={openLoteModal}
              className={clsx('flex', 'items-center', 'gap-2', 'px-4', 'py-2', 'rounded-xl', 'bg-sky-600', 'hover:bg-sky-500', 'text-white', 'text-xs', 'font-bold', 'shadow-lg', 'shadow-sky-600/30', 'transition')}
              title="Asignar visitas a investigador de campo"
            >
              <Users className={clsx('w-4', 'h-4')} />
              Asignar {selectedIds.length} a Investigador
            </button>
          )}

          {/* Botón Asignar Analista en lote */}
          {canAssignAnalista && selectedIds.length > 0 && (
            <button
              onClick={openLoteAnalistaModal}
              className={clsx('flex', 'items-center', 'gap-2', 'px-4', 'py-2', 'rounded-xl', 'bg-indigo-600', 'hover:bg-indigo-500', 'text-white', 'text-xs', 'font-bold', 'shadow-lg', 'shadow-indigo-600/30', 'transition')}
              title="Asignar préstamos seleccionados a un analista"
            >
              <UserCheck className={clsx('w-4', 'h-4')} />
              Asignar {selectedIds.length} a Analista
            </button>
          )}

          {canSelectCheckboxes && selectedIds.length > 0 && (
            <button
              onClick={() => setSelectedIds([])}
              className={clsx('flex', 'items-center', 'gap-1.5', 'px-3', 'py-2', 'rounded-xl', 'bg-slate-800', 'hover:bg-slate-700', 'text-slate-400', 'hover:text-white', 'text-xs', 'font-semibold', 'border', 'border-slate-700', 'transition')}
              title="Limpiar selección"
            >
              <X className={clsx('w-3.5', 'h-3.5')} /> Limpiar selección
            </button>
          )}
        </div>
      )}

      {/* Data Table */}
      <div className={clsx('bg-slate-900', 'border', 'border-slate-800', 'rounded-2xl', 'overflow-hidden', 'shadow-xl')}>
        <div className="overflow-x-auto">
          <table className={clsx('w-full', 'text-left', 'text-sm', 'text-slate-300')}>
            <thead className={clsx('bg-slate-950/60', 'text-xs', 'text-slate-400', 'uppercase', 'tracking-wider', 'border-b', 'border-slate-800')}>
              <tr>
                {/* Columna Checkbox — para quienes pueden asignar investigadores o analistas */}
                {canSelectCheckboxes && (
                  <th className={clsx('px-4', 'py-3.5', 'w-10')}>
                    <button
                      onClick={toggleSeleccionarTodos}
                      title={todasSeleccionadas ? 'Deseleccionar todas' : 'Seleccionar todas en esta página'}
                      className={clsx('text-slate-400', 'hover:text-sky-400', 'transition')}
                    >
                      {todasSeleccionadas
                        ? <CheckSquare className={clsx('w-4', 'h-4', 'text-sky-400')} />
                        : algunaSeleccionada
                          ? <CheckSquare className={clsx('w-4', 'h-4', 'text-sky-400/50')} />
                          : <Square className={clsx('w-4', 'h-4')} />
                      }
                    </button>
                  </th>
                )}
                <th className={clsx('px-5', 'py-3.5')}>Folio</th>
                <th className={clsx('px-5', 'py-3.5')}>Tipo Sujeto</th>
                <th className={clsx('px-5', 'py-3.5')}>Nombre del Socio</th>
                <th className={clsx('px-5', 'py-3.5')}>Domicilio y Colonia</th>
                <th className={clsx('px-5', 'py-3.5')}>Investigador Asignado</th>
                <th className={clsx('px-5', 'py-3.5')}>Vigencia Visita</th>
                <th className={clsx('px-5', 'py-3.5')}>Estado</th>
                <th className={clsx('px-5', 'py-3.5', 'text-right')}>Acciones</th>
              </tr>
            </thead>
            <tbody className={clsx('divide-y', 'divide-slate-800/60')}>
              {loading ? (
                <tr>
                  <td colSpan={canSelectCheckboxes ? 9 : 8} className={clsx('text-center', 'py-12', 'text-slate-500')}>
                    Cargando catálogo de investigaciones...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={canSelectCheckboxes ? 9 : 8} className={clsx('text-center', 'py-12', 'text-slate-500')}>
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
                      {canSelectCheckboxes && (
                        <td className={clsx('px-4', 'py-4')}>
                          <button
                            onClick={() => toggleSelectId(row.id_sif_research)}
                            className={clsx('text-slate-500', 'hover:text-sky-400', 'transition')}
                            title={isChecked ? 'Deseleccionar' : 'Seleccionar'}
                          >
                            {isChecked
                              ? <CheckSquare className={clsx('w-4', 'h-4', 'text-sky-400')} />
                              : <Square className={clsx('w-4', 'h-4')} />
                            }
                          </button>
                        </td>
                      )}
                      <td className={clsx('px-5', 'py-4', 'font-mono', 'font-semibold', 'text-slate-200')}>
                        <div className="text-white font-bold">Folio: {row.id_sif_research}</div>
                        <div className={clsx('text-[11px]', 'text-slate-500', 'font-sans')}>Sol: {row.solicitud_folio || 'N/A'}</div>
                        <div className="mt-1">
                          <span className={clsx('inline-flex', 'items-center', 'gap-1', 'px-2', 'py-0.5', 'rounded-md', 'text-[10px]', 'font-bold', 'bg-sky-500/20', 'text-sky-300', 'border', 'border-sky-500/40', 'shadow-sm')} title={`Sucursal de Captación: ${formatNombreSucursal(row.sucursal_id, row.sucursal_nombre)}`}>
                            🏢 Suc. {formatNombreSucursal(row.sucursal_id, row.sucursal_nombre)}
                          </span>
                        </div>
                        <div className={clsx('mt-1.5', 'flex', 'items-center', 'gap-1', 'text-[11px]', 'text-slate-300', 'font-sans', 'font-medium')} title="Fecha y Hora de captura por la sucursal (Horario local de la sucursal)">
                          <span className="text-sky-400">📅</span>
                          <span>
                            {formatFechaHoraCaptura(row.created_at || row.fecha_asignacion, row.sucursal_id)}
                          </span>
                        </div>
                        {row.paquete_total > 1 && (
                          <div className="mt-1">
                            {row.paquete_completo ? (
                              <span className={clsx('px-1.5', 'py-0.5', 'rounded', 'text-[10px]', 'font-bold', 'bg-emerald-500/20', 'text-emerald-300', 'border', 'border-emerald-500/30')} title="Todas las investigaciones de este crédito fueron completadas">
                                🟢 Paquete {row.paquete_completadas}/{row.paquete_total}
                              </span>
                            ) : (
                              <span className={clsx('px-1.5', 'py-0.5', 'rounded', 'text-[10px]', 'font-bold', 'bg-amber-500/20', 'text-amber-300', 'border', 'border-amber-500/30')} title="Esperando visitas a avales o solicitante">
                                ⏳ Paquete {row.paquete_completadas}/{row.paquete_total}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className={clsx('px-5', 'py-4')}>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase inline-flex items-center gap-1 ${rowBadge.badgeClass}`}>
                          <span>{rowBadge.icon}</span>
                          <span>{rowBadge.label}</span>
                        </span>
                      </td>
                      <td className={clsx('px-5', 'py-4')}>
                        <div className={clsx('font-semibold', 'text-white')}>
                          {row.sujeto_nombre || 'Socio Desconocido'}
                        </div>
                        {/* ALERTA DE INCONSISTENCIA EN DATOS DE PERSONAS / POSTGRESQL */}
                        {row.tiene_inconsistencias ? (
                          <div className={clsx('mt-1.5', 'flex', 'items-start', 'gap-1')}>
                            <button
                              onClick={() => setContactoModalPersonaId(row.persona_id_sif || row.id_sif_research)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition text-left ${row.nivel_inconsistencia === 'ALTA'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                }`}
                              title={`Inconsistencias detectadas en PostgreSQL:\n• ${row.inconsistencias ? row.inconsistencias.join('\n• ') : 'Datos pendientes'}\n\nHaz clic para prevalidar/corregir`}
                            >
                              <AlertTriangle className={clsx('w-3', 'h-3', 'shrink-0')} />
                              <span>
                                {row.nivel_inconsistencia === 'ALTA' ? '⚠️ Inconsistencia Crítica' : '⚠️ Inconsistencia de Datos'}
                              </span>
                              <span className={clsx('text-[9px]', 'underline', 'opacity-80', 'ml-0.5')}>Revisar</span>
                            </button>
                          </div>
                        ) : (
                          <div className="mt-1">
                            <span className={clsx('inline-flex', 'items-center', 'gap-1', 'text-[10px]', 'text-emerald-400', 'font-medium', 'opacity-80')} title="Información validada y consistente en PostgreSQL">
                              <CheckCircle2 className={clsx('w-3', 'h-3')} /> Datos completos
                            </span>
                          </div>
                        )}
                      </td>
                      <td className={clsx('px-5', 'py-4', 'text-xs', 'text-slate-300')}>
                        <div className={clsx('flex', 'items-center', 'gap-1', 'font-medium', 'text-slate-200')}>
                          <MapPin className={clsx('w-3.5', 'h-3.5', 'text-slate-500', 'shrink-0')} />
                          {row.calle ? `${row.calle} #${row.numero_exterior || ''}` : 'Sin Calle'}
                        </div>
                        <div className={clsx('text-[11px]', 'text-sky-400', 'font-semibold', 'pl-4')}>
                          🏡 {row.colonia ? `Col. ${row.colonia}` : 'Sin Colonia'}, {row.municipio || 'Guadalajara'}
                        </div>
                      </td>
                      <td className={clsx('px-5', 'py-4', 'text-xs')}>
                        {row.investigador_nombre ? (
                          <div>
                            <span className={clsx('text-slate-200', 'font-medium')}>{row.investigador_nombre}</span>
                            {row.fecha_asignacion && (
                              <div className={clsx('text-[10px]', 'text-slate-400', 'mt-0.5', 'flex', 'items-center', 'gap-1')} title="Fecha y hora de asignación al investigador">
                                <span className={clsx('text-sky-400', 'font-semibold')}>📅 Asig:</span>
                                <span className={clsx('font-mono', 'text-slate-300')}>{formatFechaHoraCaptura(row.fecha_asignacion, row.sucursal_id)}</span>
                              </div>
                            )}
                            {row.fecha_cumplimiento && (
                              <div className={clsx('text-[10px]', 'text-emerald-400', 'mt-0.5', 'flex', 'items-center', 'gap-1')} title="Fecha y hora en que el investigador terminó la investigación">
                                <span className="font-semibold">🏁 Fin campo:</span>
                                <span className={clsx('font-mono', 'text-emerald-300')}>{formatFechaHoraCaptura(row.fecha_cumplimiento, row.sucursal_id)}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className={clsx('text-slate-500', 'italic')}>Sin Asignar</span>
                        )}
                        {/* Analista Asignado */}
                        <div className={clsx('mt-2', 'pt-1.5', 'border-t', 'border-slate-800/80')}>
                          <div className={clsx('flex', 'items-center', 'gap-1')}>
                            <span className={clsx('text-[10px]', 'text-slate-400', 'font-medium')}>Analista:</span>
                            {row.analista_nombre ? (
                              <span className={clsx('inline-flex', 'items-center', 'gap-1', 'px-1.5', 'py-0.5', 'rounded', 'bg-indigo-500/20', 'text-indigo-300', 'border', 'border-indigo-500/30', 'text-[10px]', 'font-semibold')} title={`Analista Asignado al Crédito: ${row.analista_nombre}`}>
                                👨‍💼 {row.analista_nombre}
                              </span>
                            ) : (
                              <span className={clsx('text-[10px]', 'text-slate-500', 'italic')}>Sin analista</span>
                            )}
                          </div>
                          {row.fecha_asignacion_analista && (
                            <div className={clsx('text-[10px]', 'text-indigo-300/80', 'mt-0.5', 'flex', 'items-center', 'gap-1')} title="Fecha y hora en que se turnó al analista">
                              <span className="font-semibold">🕒 Turnado:</span>
                              <span className="font-mono">{formatFechaHoraCaptura(row.fecha_asignacion_analista, row.sucursal_id)}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* COLUMNA VIGENCIA 90 DÍAS */}
                      <td className={clsx('px-5', 'py-4', 'text-xs')}>
                        {row.visita_vigente ? (
                          <div className={clsx('flex', 'flex-col', 'gap-1')}>
                            <span className={clsx('inline-flex', 'items-center', 'gap-1', 'px-2', 'py-1', 'rounded-full', 'bg-emerald-500/15', 'text-emerald-400', 'border', 'border-emerald-500/25', 'text-[10px]', 'font-bold')}>
                              <ShieldCheck className={clsx('w-3', 'h-3')} />
                              Vigente hasta {formatFechaCorta(row.visita_vigente_hasta)}
                            </span>
                            <Link
                              to={`/investigaciones/${row.visita_previa_id}`}
                              className={clsx('text-[10px]', 'text-sky-500', 'hover:text-sky-300', 'underline', 'pl-0.5')}
                            >
                              Ver visita #{row.visita_previa_id}
                            </Link>
                          </div>
                        ) : (
                          <span className={clsx('text-slate-600', 'text-[10px]', 'italic')}>Sin visita previa</span>
                        )}
                      </td>

                      <td className={clsx('px-5', 'py-4')}>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${row.estado === 'APROBADA_FINAL'
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold'
                            : row.estado === 'DEVUELTA_A_VALIDADOR'
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold'
                              : row.estado === 'VALIDADA'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold'
                                : row.estado === 'RECHAZADA'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold'
                                  : row.estado === 'REAGENDADA'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold animate-pulse'
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
                                  : row.estado === 'REAGENDADA' ? '🔄 REAGENDADA (CITA/FOLIO)'
                                    : row.estado}
                        </span>
                        {row.estado === 'REAGENDADA' && row.observaciones_sif && (
                          <div className={clsx('mt-1', 'text-[10px]', 'text-purple-300', 'italic', 'truncate', 'max-w-[170px]')} title={row.observaciones_sif}>
                            📌 {row.observaciones_sif}
                          </div>
                        )}
                        {/* Dictamen/Observaciones del Validador */}
                        {row.validador_nombre && (
                          <div className={clsx('mt-1', 'flex', 'items-center', 'gap-1', 'text-[10px]', 'text-teal-400')} title={`Validador: ${row.validador_nombre}${row.comentarios_validacion ? ` — "${row.comentarios_validacion}"` : ''}`}>
                            <span className={clsx('w-1.5', 'h-1.5', 'rounded-full', 'bg-teal-400')}></span>
                            <span className={clsx('truncate', 'max-w-[130px]')}>Val: {row.validador_nombre}</span>
                          </div>
                        )}
                        {row.fecha_validacion && (
                          <div className={clsx('mt-0.5', 'text-[10px]', 'text-teal-300/90', 'flex', 'items-center', 'gap-1')} title="Fecha y hora de validación por el validador de crédito">
                            <span className="font-semibold">🕒 Validado:</span>
                            <span className="font-mono">{formatFechaHoraCaptura(row.fecha_validacion, row.sucursal_id)}</span>
                          </div>
                        )}
                        {row.comentarios_validacion && (
                          <div className={clsx('mt-0.5', 'text-[10px]', 'text-slate-400', 'italic', 'truncate', 'max-w-[150px]')} title={`Dictamen Validador: "${row.comentarios_validacion}"`}>
                            💬 "{row.comentarios_validacion}"
                          </div>
                        )}
                      </td>

                      <td className={clsx('px-5', 'py-4', 'text-right', 'space-x-2')}>
                        {/* Botón Asignar Investigador de campo (solo perfiles autorizados) */}
                        {canAssign && (
                          <button
                            onClick={() => openAssignModal(row)}
                            className={clsx('px-2.5', 'py-1.5', 'rounded-lg', 'bg-slate-800', 'hover:bg-sky-600', 'text-sky-400', 'hover:text-white', 'text-xs', 'font-semibold', 'transition')}
                            title="Asignar Investigador en campo"
                          >
                            <UserPlus className={clsx('w-3.5', 'h-3.5', 'inline', 'mr-1')} />
                            Asignar
                          </button>
                        )}

                        {/* Botón Asignar Analista: solo si el 100% de las investigaciones del préstamo están validadas por el Validador */}
                        {canAssignAnalista && (
                          row.paquete_todo_validado ? (
                            <button
                              onClick={() => openAsignarAnalistaModal(row)}
                              className={clsx('px-2.5', 'py-1.5', 'rounded-lg', 'bg-indigo-600', 'hover:bg-indigo-500', 'text-white', 'text-xs', 'font-semibold', 'transition', 'inline-flex', 'items-center', 'gap-1', 'shadow-md', 'shadow-indigo-600/20')}
                              title={row.analista_nombre ? `Reasignar Analista (Actual: ${row.analista_nombre})` : 'Asignar Analista a este préstamo (Todas las investigaciones validadas)'}
                            >
                              <UserCheck className={clsx('w-3.5', 'h-3.5')} />
                              {row.analista_nombre ? 'Cambiar Analista' : 'Asignar Analista'}
                            </button>
                          ) : (
                            <button
                              disabled
                              className={clsx('px-2.5', 'py-1.5', 'rounded-lg', 'bg-slate-800/80', 'text-slate-500', 'border', 'border-slate-700/50', 'text-xs', 'font-medium', 'cursor-not-allowed', 'inline-flex', 'items-center', 'gap-1', 'opacity-70')}
                              title={`No se puede asignar analista: aún faltan investigaciones por validar por el Validador (${row.paquete_validadas || 0}/${row.paquete_total || 1} validadas)`}
                            >
                              <Lock className={clsx('w-3.5', 'h-3.5', 'text-slate-500')} />
                              <span>Analista ({row.paquete_validadas || 0}/{row.paquete_total || 1})</span>
                            </button>
                          )
                        )}

                        <button
                          onClick={() => setDocModalSolicitudId(row.solicitud_id_sif || row.id_sif_research)}
                          className={clsx('px-2.5', 'py-1.5', 'rounded-lg', 'bg-purple-600/20', 'hover:bg-purple-600/30', 'text-purple-300', 'border', 'border-purple-500/30', 'text-xs', 'font-semibold', 'transition', 'inline-flex', 'items-center', 'gap-1')}
                          title="Ver Expediente Digital y Semáforo Documental"
                        >
                          📁 Expediente
                        </button>

                        <button
                          onClick={() => setNotifModalSolicitudId(row.solicitud_id_sif || row.id_sif_research)}
                          className={clsx('px-2.5', 'py-1.5', 'rounded-lg', 'bg-blue-600/20', 'hover:bg-blue-600/30', 'text-blue-300', 'border', 'border-blue-500/30', 'text-xs', 'font-semibold', 'transition', 'inline-flex', 'items-center', 'gap-1')}
                          title="Comunicación Interáreas y Requerimientos"
                        >
                          💬 Notificaciones
                        </button>

                        <button
                          onClick={() => setAgendaModalInvId(row.id_sif_research)}
                          className={clsx('px-2.5', 'py-1.5', 'rounded-lg', 'bg-emerald-600/20', 'hover:bg-emerald-600/30', 'text-emerald-300', 'border', 'border-emerald-500/30', 'text-xs', 'font-semibold', 'transition', 'inline-flex', 'items-center', 'gap-1')}
                          title="Agenda Dinámica y Control de Visitas"
                        >
                          📅 Agenda
                        </button>

                        <button
                          onClick={() => setContactoModalPersonaId(row.persona_id_sif || row.id_sif_research)}
                          className={clsx('px-2.5', 'py-1.5', 'rounded-lg', 'bg-amber-600/20', 'hover:bg-amber-600/30', 'text-amber-300', 'border', 'border-amber-500/30', 'text-xs', 'font-semibold', 'transition', 'inline-flex', 'items-center', 'gap-1')}
                          title="Prevalidación de Domicilio y Semáforo de Contacto"
                        >
                          🏡 Domicilio
                        </button>

                        <Link
                          to={`/investigaciones/${row.id_sif_research}`}
                          className={clsx('px-2.5', 'py-1.5', 'rounded-lg', 'bg-sky-600', 'hover:bg-sky-500', 'text-white', 'text-xs', 'font-semibold', 'transition', 'inline-flex', 'items-center', 'gap-1', 'shadow-md', 'shadow-sky-600/20')}
                        >
                          <Eye className={clsx('w-3.5', 'h-3.5')} />
                          {isAnalista ? 'Consultar' : 'Ver Formato'}
                        </Link>

                        {canDeleteInv && row.estado !== 'CANCELADA' && (
                          <button
                            onClick={() => {
                              setDeletingInv(row);
                              setDeleteMotivo('');
                            }}
                            className={clsx('px-2.5', 'py-1.5', 'rounded-lg', 'bg-rose-600/20', 'hover:bg-rose-600/40', 'text-rose-300', 'hover:text-rose-100', 'border', 'border-rose-500/30', 'text-xs', 'font-semibold', 'transition', 'inline-flex', 'items-center', 'gap-1', 'shadow-sm')}
                            title="Eliminar / Cancelar investigación (Exclusivo Validador)"
                          >
                            <Trash2 className={clsx('w-3.5', 'h-3.5')} />
                            Eliminar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className={clsx('px-5', 'py-3', 'bg-slate-950/60', 'border-t', 'border-slate-800', 'flex', 'items-center', 'justify-between', 'text-xs', 'text-slate-400')}>
          <div>
            {selectedIds.length > 0 && (
              <span className={clsx('mr-4', 'text-sky-400', 'font-semibold')}>
                ✓ {selectedIds.length} seleccionada{selectedIds.length !== 1 ? 's' : ''}
              </span>
            )}
            Mostrando página <span className={clsx('text-white', 'font-semibold')}>{page}</span> de{' '}
            <span className={clsx('text-white', 'font-semibold')}>{totalPages}</span> ({total.toLocaleString()} totales)
            {coloniaSeleccionada && (
              <span className={clsx('ml-2', 'text-sky-400')}>— Colonia: <strong>{coloniaSeleccionada}</strong></span>
            )}
          </div>
          <div className={clsx('flex', 'items-center', 'gap-2')}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className={clsx('p-1.5', 'rounded-lg', 'bg-slate-800', 'hover:bg-slate-700', 'disabled:opacity-40', 'transition')}
            >
              <ChevronLeft className={clsx('w-4', 'h-4')} />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className={clsx('p-1.5', 'rounded-lg', 'bg-slate-800', 'hover:bg-slate-700', 'disabled:opacity-40', 'transition')}
            >
              <ChevronRight className={clsx('w-4', 'h-4')} />
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

      {/* ── Modal Asignar Analista al Préstamo (Solo cuando todo está validado) ── */}
      {canAssignAnalista && analistaModalCredito && (
        <div className={clsx('fixed', 'inset-0', 'bg-black/80', 'backdrop-blur-sm', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4')}>
          <div className={clsx('bg-slate-900', 'border', 'border-indigo-500/50', 'rounded-2xl', 'max-w-lg', 'w-full', 'p-6', 'space-y-5', 'shadow-2xl', 'ring-1', 'ring-indigo-500/30')}>
            {/* Header del Modal */}
            <div className={clsx('flex', 'items-start', 'justify-between', 'border-b', 'border-slate-800', 'pb-4')}>
              <div className={clsx('flex', 'items-center', 'gap-3')}>
                <div className={clsx('p-2.5', 'bg-indigo-500/20', 'text-indigo-400', 'rounded-xl', 'border', 'border-indigo-500/30')}>
                  <UserCheck className={clsx('w-6', 'h-6')} />
                </div>
                <div>
                  <h3 className={clsx('text-lg', 'font-bold', 'text-white')}>Asignar Analista al Crédito</h3>
                  <p className={clsx('text-xs', 'text-slate-400')}>
                    Préstamo Folio: <strong className="text-white">#{analistaModalCredito.solicitud_folio || analistaModalCredito.solicitud_id_sif}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAnalistaModalCredito(null)}
                className={clsx('text-slate-400', 'hover:text-white', 'p-1', 'rounded-lg', 'hover:bg-slate-800', 'transition')}
              >
                <X className={clsx('w-5', 'h-5')} />
              </button>
            </div>

            {/* Resumen del crédito y paquete */}
            <div className={clsx('bg-slate-950/70', 'border', 'border-slate-800', 'rounded-xl', 'p-4', 'space-y-2.5', 'text-xs', 'text-slate-300')}>
              <div className={clsx('flex', 'justify-between', 'items-center')}>
                <span className="text-slate-400">Socio Titular:</span>
                <strong className={clsx('text-white', 'text-sm')}>{analistaModalCredito.sujeto_nombre}</strong>
              </div>
              <div className={clsx('flex', 'justify-between', 'items-center')}>
                <span className="text-slate-400">Monto Solicitado:</span>
                <span className={clsx('text-emerald-400', 'font-semibold', 'font-mono')}>
                  ${Number(analistaModalCredito.monto_solicitado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className={clsx('flex', 'justify-between', 'items-center')}>
                <span className="text-slate-400">Sucursal de Captación:</span>
                <span className="text-slate-200">{formatNombreSucursal(analistaModalCredito.sucursal_id, analistaModalCredito.sucursal_nombre)}</span>
              </div>
              {analistaModalCredito.analista_nombre && (
                <div className={clsx('flex', 'justify-between', 'items-center', 'pt-1')}>
                  <span className="text-slate-400">Analista Actual:</span>
                  <span className={clsx('text-indigo-300', 'font-medium')}>👨‍💼 {analistaModalCredito.analista_nombre}</span>
                </div>
              )}
              <div className={clsx('flex', 'justify-between', 'items-center', 'pt-2.5', 'border-t', 'border-slate-800/80')}>
                <span className={clsx('text-slate-400', 'font-medium')}>Condición de Validador:</span>
                <span className={clsx('inline-flex', 'items-center', 'gap-1', 'px-2.5', 'py-1', 'rounded-full', 'text-[11px]', 'font-bold', 'bg-emerald-500/20', 'text-emerald-300', 'border', 'border-emerald-500/40')}>
                  <CheckCircle2 className={clsx('w-3.5', 'h-3.5')} />
                  100% de Investigaciones Validadas ({analistaModalCredito.paquete_validadas}/{analistaModalCredito.paquete_total})
                </span>
              </div>
            </div>

            {/* Formulario de Selección */}
            <div className="space-y-2">
              <label className={clsx('text-xs', 'font-semibold', 'text-slate-300', 'flex', 'items-center', 'justify-between')}>
                <span>Seleccionar Analista</span>
                <span className={clsx('text-[11px]', 'text-indigo-400', 'font-normal')}>{analistasDisponibles.length} analistas activos</span>
              </label>
              <select
                value={selectedAnalistaId}
                onChange={(e) => setSelectedAnalistaId(e.target.value)}
                className={clsx('w-full', 'px-3.5', 'py-2.5', 'rounded-xl', 'bg-slate-950', 'border', 'border-slate-700', 'text-sm', 'text-slate-200', 'focus:outline-none', 'focus:border-indigo-500')}
              >
                {analistasDisponibles.length === 0 ? (
                  <option value="">Cargando analistas...</option>
                ) : (
                  analistasDisponibles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} ({a.email})
                    </option>
                  ))
                )}
              </select>
              <p className={clsx('text-[11px]', 'text-slate-400')}>
                Al asignar, este analista asumirá la responsabilidad de la revisión final del paquete y dictamen de este crédito.
              </p>
            </div>

            {/* Footer con botones */}
            <div className={clsx('flex', 'items-center', 'justify-end', 'gap-3', 'pt-3', 'border-t', 'border-slate-800')}>
              <button
                type="button"
                onClick={() => setAnalistaModalCredito(null)}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-slate-800', 'hover:bg-slate-700', 'text-slate-300', 'text-xs', 'font-semibold', 'transition')}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={assigningAnalista || !selectedAnalistaId}
                onClick={handleConfirmAsignarAnalista}
                className={clsx('px-5', 'py-2', 'rounded-xl', 'bg-indigo-600', 'hover:bg-indigo-500', 'disabled:bg-indigo-900/50', 'disabled:text-indigo-400/50', 'text-white', 'text-xs', 'font-bold', 'transition', 'shadow-lg', 'shadow-indigo-600/30', 'flex', 'items-center', 'gap-2')}
              >
                <UserCheck className={clsx('w-4', 'h-4')} />
                {assigningAnalista ? 'Asignando Analista...' : 'Confirmar Asignación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {canAssign && selectedInv && (
        <div className={clsx('fixed', 'inset-0', 'bg-black/70', 'backdrop-blur-sm', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4')}>
          <div className={clsx('bg-slate-900', 'border', 'border-slate-800', 'rounded-2xl', 'max-w-md', 'w-full', 'p-6', 'space-y-4', 'shadow-2xl')}>
            <h3 className={clsx('text-lg', 'font-bold', 'text-white')}>Asignar Investigador en Campo</h3>
            <p className={clsx('text-xs', 'text-slate-400')}>
              Selecciona al investigador responsable para la visita de <strong className="text-white">{selectedInv.sujeto_nombre}</strong>.
            </p>

            {/* ADVERTENCIA DE INCONSISTENCIA PARA EL ASIGNADOR */}
            {selectedInv.tiene_inconsistencias && (
              <div className={`p-3.5 rounded-xl border space-y-2 text-xs ${selectedInv.nivel_inconsistencia === 'ALTA'
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                  : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                }`}>
                <div className={clsx('flex', 'items-center', 'gap-2', 'font-bold', 'text-sm')}>
                  <AlertTriangle className={clsx('w-4', 'h-4', 'shrink-0', 'text-amber-400')} />
                  <span>⚠️ Alerta: Inconsistencia en Datos del Socio</span>
                </div>
                <p className={clsx('text-[11px]', 'opacity-90')}>
                  Se detectaron las siguientes inconsistencias en la ficha de PostgreSQL:
                </p>
                <ul className={clsx('list-disc', 'list-inside', 'space-y-0.5', 'text-[11px]', 'pl-1', 'font-medium')}>
                  {selectedInv.inconsistencias && selectedInv.inconsistencias.map((inc, i) => (
                    <li key={i}>{inc}</li>
                  ))}
                </ul>
                <div className={clsx('pt-1', 'flex', 'items-center', 'justify-between', 'text-[11px]')}>
                  <span className={clsx('italic', 'opacity-80')}>Puedes asignar sabiendo esto o corregirlo antes:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const pId = selectedInv.persona_id_sif || selectedInv.id_sif_research;
                      setSelectedInv(null);
                      setContactoModalPersonaId(pId);
                    }}
                    className={clsx('px-2.5', 'py-1', 'bg-amber-500/20', 'hover:bg-amber-500/30', 'text-amber-300', 'border', 'border-amber-500/40', 'rounded-lg', 'font-bold', 'transition', 'ml-2', 'shrink-0')}
                  >
                    Corregir Datos
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className={clsx('text-xs', 'font-semibold', 'text-slate-300')}>Investigador:</label>
              <select
                value={selectedInvestigadorId}
                onChange={(e) => setSelectedInvestigadorId(e.target.value)}
                className={clsx('w-full', 'p-2.5', 'rounded-xl', 'bg-slate-950', 'border', 'border-slate-800', 'text-sm', 'text-slate-200', 'focus:outline-none', 'focus:border-sky-500')}
              >
                {investigadores.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.rol})
                  </option>
                ))}
              </select>
            </div>

            <div className={clsx('flex', 'items-center', 'justify-end', 'gap-3', 'pt-3')}>
              <button
                onClick={() => setSelectedInv(null)}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-slate-800', 'hover:bg-slate-700', 'text-slate-300', 'text-xs', 'font-semibold', 'transition')}
              >
                Cancelar
              </button>
              <button
                disabled={assigning}
                onClick={handleAssignSubmit}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-sky-600', 'hover:bg-sky-500', 'text-white', 'text-xs', 'font-semibold', 'transition', 'shadow-lg', 'shadow-sky-600/30')}
              >
                {assigning ? 'Asignando...' : selectedInv.tiene_inconsistencias ? 'Asignar de Todos Modos' : 'Confirmar Asignación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Barra de Acción Masiva Fija (cuando hay selección) ───────── */}
      {canSelectCheckboxes && selectedIds.length > 0 && (
        <div className={clsx('fixed', 'bottom-6', 'left-1/2', '-translate-x-1/2', 'z-40', 'flex', 'items-center', 'gap-4', 'bg-slate-900/95', 'backdrop-blur-md', 'border', 'border-indigo-500/40', 'rounded-2xl', 'px-6', 'py-3', 'shadow-2xl', 'shadow-slate-950/80', 'ring-1', 'ring-indigo-500/20')}>
          <div className={clsx('flex', 'items-center', 'gap-2', 'text-sm', 'text-white', 'font-semibold')}>
            <CheckSquare className={clsx('w-5', 'h-5', 'text-indigo-400')} />
            <span>{selectedIds.length} crédito{selectedIds.length !== 1 ? 's' : ''} seleccionado{selectedIds.length !== 1 ? 's' : ''}</span>
          </div>
          <div className={clsx('h-5', 'w-px', 'bg-slate-600')} />
          {canAssign && (
            <button
              onClick={openLoteModal}
              className={clsx('flex', 'items-center', 'gap-2', 'px-3.5', 'py-1.5', 'rounded-xl', 'bg-sky-600', 'hover:bg-sky-500', 'text-white', 'text-sm', 'font-bold', 'transition', 'shadow-lg', 'shadow-sky-600/30')}
            >
              <Users className={clsx('w-4', 'h-4')} /> Asignar a Investigador
            </button>
          )}
          {canAssignAnalista && (
            <button
              onClick={openLoteAnalistaModal}
              className={clsx('flex', 'items-center', 'gap-2', 'px-3.5', 'py-1.5', 'rounded-xl', 'bg-indigo-600', 'hover:bg-indigo-500', 'text-white', 'text-sm', 'font-bold', 'transition', 'shadow-lg', 'shadow-indigo-600/30')}
            >
              <UserCheck className={clsx('w-4', 'h-4')} /> Asignar a Analista
            </button>
          )}
          <button
            onClick={() => setSelectedIds([])}
            className={clsx('text-slate-400', 'hover:text-white', 'transition', 'ml-1')}
            title="Cancelar selección"
          >
            <X className={clsx('w-5', 'h-5')} />
          </button>
        </div>
      )}

      {/* ── Modal Asignar Lote Investigador ────────────────────────────── */}
      {canAssign && loteModalOpen && (
        <div className={clsx('fixed', 'inset-0', 'bg-black/70', 'backdrop-blur-sm', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4')}>
          <div className={clsx('bg-slate-900', 'border', 'border-slate-700', 'rounded-2xl', 'max-w-lg', 'w-full', 'p-6', 'space-y-5', 'shadow-2xl', 'ring-1', 'ring-sky-500/20')}>
            {/* Header */}
            <div className={clsx('flex', 'items-start', 'justify-between')}>
              <div>
                <h3 className={clsx('text-lg', 'font-bold', 'text-white', 'flex', 'items-center', 'gap-2')}>
                  <Users className={clsx('w-5', 'h-5', 'text-sky-400')} />
                  Asignación en Lote a Investigador
                </h3>
                <p className={clsx('text-xs', 'text-slate-400', 'mt-1')}>
                  Se asignarán{' '}
                  <span className={clsx('text-sky-300', 'font-bold')}>{selectedIds.length} investigación{selectedIds.length !== 1 ? 'es' : ''}</span>
                  {coloniaSeleccionada && (
                    <> de la colonia <span className={clsx('text-sky-300', 'font-bold')}>{coloniaSeleccionada}</span></>
                  )}{' '}
                  al investigador seleccionado.
                </p>
              </div>
              <button onClick={() => setLoteModalOpen(false)} className={clsx('text-slate-500', 'hover:text-white', 'transition')}>
                <X className={clsx('w-5', 'h-5')} />
              </button>
            </div>

            {/* Resumen de IDs seleccionados */}
            <div className={clsx('bg-slate-950', 'border', 'border-slate-800', 'rounded-xl', 'px-4', 'py-3', 'max-h-28', 'overflow-y-auto')}>
              <div className={clsx('text-[11px]', 'text-slate-500', 'font-semibold', 'mb-1.5', 'uppercase', 'tracking-wider')}>
                Investigaciones seleccionadas
              </div>
              <div className={clsx('flex', 'flex-wrap', 'gap-1.5')}>
                {selectedIds.map((id) => (
                  <span key={id} className={clsx('px-2', 'py-0.5', 'rounded-full', 'bg-sky-500/15', 'text-sky-300', 'text-[11px]', 'font-mono', 'border', 'border-sky-500/30')}>
                    Folio: {id}
                  </span>
                ))}
              </div>
            </div>

            {/* Selector de investigador */}
            <div className="space-y-2">
              <label className={clsx('text-xs', 'font-semibold', 'text-slate-300')}>Investigador a asignar:</label>
              <select
                value={loteInvestigadorId}
                onChange={(e) => setLoteInvestigadorId(e.target.value)}
                className={clsx('w-full', 'p-3', 'rounded-xl', 'bg-slate-950', 'border', 'border-slate-700', 'text-sm', 'text-slate-200', 'focus:outline-none', 'focus:border-sky-500')}
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
                <div className={clsx('flex', 'items-start', 'gap-2', 'bg-amber-950/40', 'border', 'border-amber-500/40', 'rounded-xl', 'px-4', 'py-3', 'text-amber-300', 'text-xs')}>
                  <AlertTriangle className={clsx('w-4', 'h-4', 'shrink-0', 'text-amber-400', 'mt-0.5')} />
                  <div>
                    <strong className={clsx('block', 'font-semibold')}>
                      {conInconsistencia.length} de {selectedIds.length} investigaciones seleccionadas presentan inconsistencias en los datos del socio.
                    </strong>
                    <span className={clsx('text-[11px]', 'opacity-80')}>
                      Como asignador, puedes proceder y asignarlas sabiendo de antemano estos detalles.
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Aviso de sincronización móvil */}
            <div className={clsx('flex', 'items-start', 'gap-2', 'bg-sky-500/10', 'border', 'border-sky-500/20', 'rounded-xl', 'px-4', 'py-3', 'text-sky-300', 'text-xs')}>
              <span className="text-base">⚡</span>
              <span>
                Las investigaciones aparecerán <strong>inmediatamente</strong> en la aplicación móvil del investigador al actualizar su lista de trabajo.
              </span>
            </div>

            {/* Botones */}
            <div className={clsx('flex', 'items-center', 'justify-end', 'gap-3', 'pt-1')}>
              <button
                onClick={() => setLoteModalOpen(false)}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-slate-800', 'hover:bg-slate-700', 'text-slate-300', 'text-sm', 'font-semibold', 'transition')}
              >
                Cancelar
              </button>
              <button
                disabled={assigningLote || !loteInvestigadorId}
                onClick={handleLoteSubmit}
                className={clsx('px-5', 'py-2', 'rounded-xl', 'bg-sky-600', 'hover:bg-sky-500', 'disabled:opacity-50', 'text-white', 'text-sm', 'font-bold', 'transition', 'shadow-lg', 'shadow-sky-600/30')}
              >
                {assigningLote ? 'Asignando...' : `Confirmar Asignación (${selectedIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Asignar Lote Analistas ─────────────────────────────── */}
      {canAssignAnalista && loteAnalistaModalOpen && (
        <div className={clsx('fixed', 'inset-0', 'bg-black/80', 'backdrop-blur-sm', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4')}>
          <div className={clsx('bg-slate-900', 'border', 'border-indigo-500/50', 'rounded-2xl', 'max-w-lg', 'w-full', 'p-6', 'space-y-5', 'shadow-2xl', 'ring-1', 'ring-indigo-500/30')}>
            {/* Header */}
            <div className={clsx('flex', 'items-start', 'justify-between', 'border-b', 'border-slate-800', 'pb-4')}>
              <div className={clsx('flex', 'items-center', 'gap-3')}>
                <div className={clsx('p-2.5', 'bg-indigo-500/20', 'text-indigo-400', 'rounded-xl', 'border', 'border-indigo-500/30')}>
                  <UserCheck className={clsx('w-6', 'h-6')} />
                </div>
                <div>
                  <h3 className={clsx('text-lg', 'font-bold', 'text-white')}>Asignación Masiva a Analista</h3>
                  <p className={clsx('text-xs', 'text-slate-400', 'mt-0.5')}>
                    {sucursalSeleccionada
                      ? `Sucursal: ${formatNombreSucursal(sucursalSeleccionada, sucursalObj?.sucursal_nombre)}`
                      : 'Asignación de créditos seleccionados a un analista'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLoteAnalistaModalOpen(false)}
                className={clsx('text-slate-400', 'hover:text-white', 'p-1', 'rounded-lg', 'hover:bg-slate-800', 'transition')}
              >
                <X className={clsx('w-5', 'h-5')} />
              </button>
            </div>

            {/* Análisis del lote seleccionado */}
            {(() => {
              const rowsSeleccionadas = data.filter(d => selectedIds.includes(String(d.id_sif_research)));
              const listosParaAsignar = rowsSeleccionadas.filter(d => d.paquete_todo_validado);
              const pendientesValidar = rowsSeleccionadas.filter(d => !d.paquete_todo_validado);

              return (
                <div className="space-y-3">
                  {/* Resumen numérico */}
                  <div className={clsx('grid', 'grid-cols-2', 'gap-2', 'text-xs')}>
                    <div className={clsx('p-3', 'bg-slate-950/70', 'border', 'border-slate-800', 'rounded-xl')}>
                      <span className={clsx('text-slate-400', 'block', 'mb-1')}>Préstamos Seleccionados:</span>
                      <strong className={clsx('text-white', 'text-base', 'font-mono')}>{selectedIds.length}</strong>
                    </div>
                    <div className={clsx('p-3', 'bg-indigo-950/30', 'border', 'border-indigo-500/30', 'rounded-xl')}>
                      <span className={clsx('text-indigo-300', 'block', 'mb-1')}>Listos (100% Validados):</span>
                      <strong className={clsx('text-emerald-400', 'text-base', 'font-mono', 'flex', 'items-center', 'gap-1')}>
                        <CheckCircle2 className={clsx('w-4', 'h-4')} /> {listosParaAsignar.length}
                      </strong>
                    </div>
                  </div>

                  {/* Advertencia si hay no validados */}
                  {pendientesValidar.length > 0 && (
                    <div className={clsx('flex', 'items-start', 'gap-2.5', 'bg-amber-950/40', 'border', 'border-amber-500/40', 'rounded-xl', 'p-3.5', 'text-xs', 'text-amber-200')}>
                      <AlertTriangle className={clsx('w-5', 'h-5', 'shrink-0', 'text-amber-400', 'mt-0.5')} />
                      <div>
                        <strong className={clsx('font-semibold', 'block')}>
                          {pendientesValidar.length} préstamo(s) aún no completan el visto bueno del Validador:
                        </strong>
                        <p className={clsx('text-[11px]', 'text-amber-300/80', 'mt-1')}>
                          Por regla de negocio, un analista solo puede dictaminar expedientes cuyas investigaciones de campo estén 100% validadas. El sistema asignará los <strong>{listosParaAsignar.length}</strong> listos y omitirá los pendientes.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Resumen de Socios seleccionados */}
                  <div className={clsx('bg-slate-950', 'border', 'border-slate-800', 'rounded-xl', 'px-4', 'py-3', 'max-h-32', 'overflow-y-auto', 'space-y-1.5', 'text-xs')}>
                    <div className={clsx('text-[11px]', 'text-slate-400', 'font-semibold', 'uppercase', 'tracking-wider', 'mb-2')}>
                      Detalle de solicitudes seleccionadas ({rowsSeleccionadas.length})
                    </div>
                    {rowsSeleccionadas.map((r) => (
                      <div key={r.id_sif_research} className={clsx('flex', 'items-center', 'justify-between', 'py-1', 'border-b', 'border-slate-900', 'last:border-0')}>
                        <span className={clsx('text-slate-300', 'truncate', 'max-w-[240px]')}>
                          <strong className="text-white">Folio: {r.id_sif_research}</strong> — {r.sujeto_nombre}
                        </span>
                        {r.paquete_todo_validado ? (
                          <span className={clsx('px-2', 'py-0.5', 'rounded-full', 'text-[10px]', 'font-bold', 'bg-emerald-500/20', 'text-emerald-300', 'border', 'border-emerald-500/30')}>
                            Validado ✅
                          </span>
                        ) : (
                          <span className={clsx('px-2', 'py-0.5', 'rounded-full', 'text-[10px]', 'font-bold', 'bg-slate-800', 'text-amber-400', 'border', 'border-amber-500/30')}>
                            Faltan visitas ({r.paquete_validadas || 0}/{r.paquete_total || 1})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Selector de Analista */}
            <div className="space-y-2">
              <label className={clsx('text-xs', 'font-semibold', 'text-slate-300', 'flex', 'items-center', 'justify-between')}>
                <span>Analista Responsable:</span>
                <span className={clsx('text-[11px]', 'text-indigo-400', 'font-normal')}>{analistasDisponibles.length} analistas activos</span>
              </label>
              <select
                value={loteAnalistaId}
                onChange={(e) => setLoteAnalistaId(e.target.value)}
                className={clsx('w-full', 'px-3.5', 'py-2.5', 'rounded-xl', 'bg-slate-950', 'border', 'border-slate-700', 'text-sm', 'text-slate-200', 'focus:outline-none', 'focus:border-indigo-500')}
              >
                {analistasDisponibles.length === 0 ? (
                  <option value="">Cargando catálogo de analistas...</option>
                ) : (
                  analistasDisponibles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} — {a.rol} ({a.email})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Botones de acción */}
            <div className={clsx('flex', 'items-center', 'justify-end', 'gap-3', 'pt-3', 'border-t', 'border-slate-800')}>
              <button
                type="button"
                onClick={() => setLoteAnalistaModalOpen(false)}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-slate-800', 'hover:bg-slate-700', 'text-slate-300', 'text-xs', 'font-semibold', 'transition')}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={assigningLoteAnalista || !loteAnalistaId}
                onClick={handleLoteAnalistaSubmit}
                className={clsx('px-5', 'py-2', 'rounded-xl', 'bg-indigo-600', 'hover:bg-indigo-500', 'disabled:bg-indigo-900/50', 'disabled:text-indigo-400/50', 'text-white', 'text-xs', 'font-bold', 'transition', 'shadow-lg', 'shadow-indigo-600/30', 'flex', 'items-center', 'gap-2')}
              >
                <UserCheck className={clsx('w-4', 'h-4')} />
                {assigningLoteAnalista ? 'Asignando Analista en Lote...' : 'Confirmar Asignación en Lote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Asignar por Sucursal a Analista ──────────────────────── */}
      {canAssignAnalista && asignarPorSucursalModalOpen && (
        <div className={clsx('fixed', 'inset-0', 'bg-black/80', 'backdrop-blur-sm', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4')}>
          <div className={clsx('bg-slate-900', 'border', 'border-indigo-500/50', 'rounded-2xl', 'max-w-2xl', 'w-full', 'p-6', 'space-y-5', 'shadow-2xl', 'ring-1', 'ring-indigo-500/30')}>
            {/* Header */}
            <div className={clsx('flex', 'items-start', 'justify-between', 'border-b', 'border-slate-800', 'pb-4')}>
              <div className={clsx('flex', 'items-center', 'gap-3')}>
                <div className={clsx('p-2.5', 'bg-indigo-500/20', 'text-indigo-400', 'rounded-xl', 'border', 'border-indigo-500/30')}>
                  <Building2 className={clsx('w-6', 'h-6')} />
                </div>
                <div>
                  <h3 className={clsx('text-lg', 'font-bold', 'text-white')}>Asignar Analista por Sucursal</h3>
                  <p className={clsx('text-xs', 'text-slate-400', 'mt-0.5')}>
                    Selecciona una o varias sucursales para asignar en bloque sus créditos con visto bueno del Validador.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAsignarPorSucursalModalOpen(false)}
                className={clsx('text-slate-400', 'hover:text-white', 'p-1', 'rounded-lg', 'hover:bg-slate-800', 'transition')}
              >
                <X className={clsx('w-5', 'h-5')} />
              </button>
            </div>

            {/* Selector de Sucursales */}
            <div className="space-y-2">
              <div className={clsx('flex', 'items-center', 'justify-between', 'text-xs')}>
                <span className={clsx('font-semibold', 'text-slate-300')}>
                  Sucursales de Captación ({sucursales.length})
                </span>
                <button
                  type="button"
                  onClick={toggleTodasSucursalesParaAnalista}
                  className={clsx('text-indigo-400', 'hover:text-indigo-300', 'font-semibold', 'transition')}
                >
                  {sucursales.length > 0 && sucursales.every((s) => sucursalesSeleccionadasParaAnalista.includes(String(s.sucursal_id)))
                    ? 'Deseleccionar todas'
                    : 'Seleccionar todas'}
                </button>
              </div>

              <div className={clsx('grid', 'grid-cols-1', 'sm:grid-cols-2', 'gap-2', 'max-h-56', 'overflow-y-auto', 'p-1', 'border', 'border-slate-800', 'rounded-xl', 'bg-slate-950/60')}>
                {sucursales.length === 0 ? (
                  <div className={clsx('col-span-2', 'text-center', 'py-6', 'text-slate-500', 'text-xs')}>
                    Cargando sucursales...
                  </div>
                ) : (
                  sucursales.map((suc) => {
                    const isSelected = sucursalesSeleccionadasParaAnalista.includes(String(suc.sucursal_id));
                    const listasCount = parseInt(suc.listas_analista || 0, 10);
                    const totalValidados = parseInt(suc.total_validados || 0, 10);

                    return (
                      <div
                        key={suc.sucursal_id}
                        onClick={() => toggleSucursalSeleccionadaParaAnalista(suc.sucursal_id)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition select-none ${isSelected
                            ? 'bg-indigo-500/15 border-indigo-500/60 shadow-sm shadow-indigo-500/10'
                            : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/60'
                          }`}
                      >
                        <div className={clsx('flex', 'items-center', 'gap-2.5', 'truncate')}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => { }} // controlado por el contenedor
                            className={clsx('rounded', 'border-slate-700', 'text-indigo-600', 'focus:ring-indigo-500', 'h-4', 'w-4', 'bg-slate-950')}
                          />
                          <div className="truncate">
                            <div className={clsx('text-xs', 'font-bold', 'text-white', 'truncate')}>
                              {formatNombreSucursal(suc.sucursal_id, suc.sucursal_nombre)}
                            </div>
                            <div className={clsx('text-[10px]', 'text-slate-400', 'font-mono')}>
                              Sucursal #{suc.sucursal_id}
                            </div>
                          </div>
                        </div>

                        <div className={clsx('flex', 'flex-col', 'items-end', 'shrink-0', 'ml-2')}>
                          {listasCount > 0 ? (
                            <span className={clsx('px-2', 'py-0.5', 'rounded-full', 'text-[10px]', 'font-bold', 'bg-emerald-500/20', 'text-emerald-300', 'border', 'border-emerald-500/30')}>
                              {listasCount} listo{listasCount !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className={clsx('px-2', 'py-0.5', 'rounded-full', 'text-[10px]', 'font-medium', 'bg-slate-800', 'text-slate-400', 'border', 'border-slate-700/50')}>
                              0 listos
                            </span>
                          )}
                          {totalValidados > 0 && totalValidados !== listasCount && (
                            <span className={clsx('text-[9px]', 'text-slate-500', 'mt-0.5')} title="Total validados en esta sucursal">
                              ({totalValidados} validados)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Opciones y Selector de Analista */}
            <div className={clsx('grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-4', 'pt-1')}>
              <div className="space-y-2">
                <label className={clsx('text-xs', 'font-semibold', 'text-slate-300', 'flex', 'items-center', 'justify-between')}>
                  <span>Analista Destinatario</span>
                  <span className={clsx('text-[11px]', 'text-indigo-400', 'font-normal')}>
                    {analistasDisponibles.length} activos
                  </span>
                </label>
                <select
                  value={sucursalAnalistaId}
                  onChange={(e) => setSucursalAnalistaId(e.target.value)}
                  className={clsx('w-full', 'px-3.5', 'py-2.5', 'rounded-xl', 'bg-slate-950', 'border', 'border-slate-700', 'text-sm', 'text-slate-200', 'focus:outline-none', 'focus:border-indigo-500')}
                >
                  {analistasDisponibles.length === 0 ? (
                    <option value="">Cargando analistas...</option>
                  ) : (
                    analistasDisponibles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre} — {a.rol}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className={clsx('flex', 'flex-col', 'justify-end')}>
                <label className={clsx('flex', 'items-start', 'gap-2.5', 'p-2.5', 'bg-slate-950/60', 'border', 'border-slate-800', 'rounded-xl', 'cursor-pointer', 'hover:bg-slate-950', 'transition')}>
                  <input
                    type="checkbox"
                    checked={reasignarExistentes}
                    onChange={(e) => setReasignarExistentes(e.target.checked)}
                    className={clsx('rounded', 'border-slate-700', 'text-indigo-600', 'focus:ring-indigo-500', 'h-4', 'w-4', 'mt-0.5', 'bg-slate-900')}
                  />
                  <div>
                    <span className={clsx('text-xs', 'font-semibold', 'text-slate-200', 'block')}>
                      Reasignar créditos existentes
                    </span>
                    <span className={clsx('text-[11px]', 'text-slate-400', 'block')}>
                      Si se activa, también cambiará los créditos que ya tenían analista.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Resumen dinámico */}
            {(() => {
              const sucursalesSel = sucursales.filter((s) =>
                sucursalesSeleccionadasParaAnalista.includes(String(s.sucursal_id))
              );
              const totalEstimado = sucursalesSel.reduce((acc, s) => {
                const count = reasignarExistentes
                  ? parseInt(s.total_validados || 0, 10)
                  : parseInt(s.listas_analista || 0, 10);
                return acc + count;
              }, 0);
              const analistaSel = analistasDisponibles.find((a) => String(a.id) === String(sucursalAnalistaId));

              return (
                <div className={clsx('bg-indigo-950/30', 'border', 'border-indigo-500/30', 'rounded-xl', 'p-3.5', 'flex', 'items-center', 'justify-between', 'text-xs')}>
                  <div>
                    <span className={clsx('text-slate-400', 'block')}>Créditos listos a asignar:</span>
                    <strong className={clsx('text-white', 'text-base', 'font-mono', 'flex', 'items-center', 'gap-1.5', 'mt-0.5')}>
                      <CheckCircle2 className={clsx('w-4', 'h-4', 'text-emerald-400')} />
                      {totalEstimado} crédito{totalEstimado !== 1 ? 's' : ''} en {sucursalesSeleccionadasParaAnalista.length} sucursal{sucursalesSeleccionadasParaAnalista.length !== 1 ? 'es' : ''}
                    </strong>
                  </div>
                  {analistaSel && (
                    <div className="text-right">
                      <span className={clsx('text-slate-400', 'block')}>Analista asignado:</span>
                      <span className={clsx('text-indigo-300', 'font-bold', 'mt-0.5', 'block', 'truncate', 'max-w-[200px]')}>
                        👨‍💼 {analistaSel.nombre}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Botones de acción */}
            <div className={clsx('flex', 'items-center', 'justify-end', 'gap-3', 'pt-3', 'border-t', 'border-slate-800')}>
              <button
                type="button"
                onClick={() => setAsignarPorSucursalModalOpen(false)}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-slate-800', 'hover:bg-slate-700', 'text-slate-300', 'text-xs', 'font-semibold', 'transition')}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  assigningPorSucursales ||
                  sucursalesSeleccionadasParaAnalista.length === 0 ||
                  !sucursalAnalistaId
                }
                onClick={handleConfirmAsignarPorSucursales}
                className={clsx('px-5', 'py-2', 'rounded-xl', 'bg-indigo-600', 'hover:bg-indigo-500', 'disabled:bg-indigo-900/50', 'disabled:text-indigo-400/50', 'text-white', 'text-xs', 'font-bold', 'transition', 'shadow-lg', 'shadow-indigo-600/30', 'flex', 'items-center', 'gap-2')}
              >
                <Building2 className={clsx('w-4', 'h-4')} />
                {assigningPorSucursales ? 'Asignando por Sucursales...' : 'Confirmar Asignación por Sucursal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación de Investigación (Exclusivo Validador) */}
      {deletingInv && (
        <div className={clsx('fixed', 'inset-0', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4', 'bg-slate-950/80', 'backdrop-blur-sm', 'animate-in', 'fade-in')}>
          <div className={clsx('bg-slate-900', 'border', 'border-rose-500/30', 'rounded-2xl', 'p-6', 'max-w-md', 'w-full', 'shadow-2xl', 'space-y-4')}>
            <div className={clsx('flex', 'items-center', 'gap-3', 'text-rose-400')}>
              <div className={clsx('p-2.5', 'rounded-xl', 'bg-rose-500/10', 'border', 'border-rose-500/20')}>
                <Trash2 className={clsx('w-6', 'h-6', 'text-rose-400')} />
              </div>
              <div>
                <h3 className={clsx('text-base', 'font-bold', 'text-white')}>¿Eliminar Investigación?</h3>
                <p className={clsx('text-xs', 'text-slate-400')}>Esta acción cancelará la investigación del paquete activo.</p>
              </div>
            </div>

            <div className={clsx('bg-slate-950/60', 'rounded-xl', 'p-3', 'border', 'border-slate-800', 'text-xs', 'space-y-1.5')}>
              <div><span className="text-slate-400">Folio Investigación:</span> <strong className={clsx('text-white', 'font-mono')}>Folio: {deletingInv.id_sif_research}</strong></div>
              <div><span className="text-slate-400">Sujeto:</span> <strong className="text-white">{deletingInv.sujeto_nombre}</strong> ({deletingInv.tipo_sujeto})</div>
              <div><span className="text-slate-400">Folio Crédito:</span> <strong className="text-sky-400">{deletingInv.solicitud_folio || `Sol: #${deletingInv.solicitud_id_sif}`}</strong></div>
              <div><span className="text-slate-400">Estado Actual:</span> <strong className="text-amber-400">{deletingInv.estado}</strong></div>
            </div>

            <div>
              <label className={clsx('block', 'text-xs', 'font-semibold', 'text-slate-300', 'mb-1.5')}>
                Motivo de cancelación / eliminación (para auditoría):
              </label>
              <textarea
                value={deleteMotivo}
                onChange={(e) => setDeleteMotivo(e.target.value)}
                placeholder="Ej. Duplicada, error de solicitud, cancelada por sucursal..."
                className={clsx('w-full', 'h-20', 'px-3', 'py-2', 'rounded-xl', 'bg-slate-950', 'border', 'border-slate-800', 'text-xs', 'text-slate-200', 'placeholder-slate-500', 'focus:outline-none', 'focus:border-rose-500', 'resize-none')}
              />
            </div>

            <div className={clsx('flex', 'justify-end', 'gap-2.5', 'pt-2')}>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingInv(null)}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-slate-800', 'hover:bg-slate-700', 'text-xs', 'font-semibold', 'text-slate-300', 'transition')}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-rose-600', 'hover:bg-rose-500', 'text-xs', 'font-semibold', 'text-white', 'transition', 'flex', 'items-center', 'gap-1.5', 'shadow-lg', 'shadow-rose-600/30')}
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
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
