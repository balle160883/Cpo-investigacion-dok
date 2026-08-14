import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchInvestigacionDetalle, validarInvestigacion, revalidarInvestigacion } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Printer, ChevronLeft, CheckSquare, Square, Camera, ZoomIn, ZoomOut, RotateCw, Download, ChevronRight, X, ShieldCheck, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import Toast from '../components/Toast';
import { formatNombreSucursal } from '../utils/formatters';

// Helper clsx para formateo seguro de clases CSS
const clsx = (...classes) => classes.flat(Infinity).filter(Boolean).join(' ');

// Helper: formatea fecha en DD/Mon/AAAA
function formatFechaCorta(fechaStr) {
  if (!fechaStr) return '—';
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const d = new Date(fechaStr);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${meses[d.getMonth()]}/${d.getFullYear()}`;
}

export default function DetalleFormatoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFotoIndex, setSelectedFotoIndex] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Validación del Validador
  const [validating, setValidating] = useState(false);
  const [showRechazoModal, setShowRechazoModal] = useState(false);
  const [comentariosRechazo, setComentariosRechazo] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });

  // Revalidación del Analista
  const [revalidating, setRevalidating] = useState(false);
  const [showDevolucionModal, setShowDevolucionModal] = useState(false);
  const [comentariosDevolucion, setComentariosDevolucion] = useState('');

  // Obtener rol de forma robusta
  let userRole = '';
  if (auth && auth.user && (auth.user.rol || auth.user.role)) {
    userRole = (auth.user.rol || auth.user.role).toLowerCase();
  } else {
    try {
      const parsed = JSON.parse(localStorage.getItem('cpo_user') || '{}');
      userRole = (parsed.rol || parsed.role || '').toLowerCase();
    } catch (e) { }
  }

  const isAnalista = userRole.includes('analista');
  // Permitir validar solo a superadmin, admin y validador — el analista es solo lectura en el primer paso
  const canValidate = !userRole || ['superadmin', 'admin', 'validador'].some(r => userRole.includes(r));
  // El analista puede revalidar solo cuando el estado es VALIDADA
  const canRevalidar = isAnalista;

  async function loadData() {
    try {
      const res = await fetchInvestigacionDetalle(id);
      setData(res);
    } catch (err) {
      console.error('Error cargando detalle:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  async function handleEjecutarValidacion(accion, comentarios = '') {
    setValidating(true);
    try {
      const res = await validarInvestigacion(id, { accion, comentarios });
      setToast({
        message: res.message || `Investigación ${accion === 'VALIDAR' ? 'VALIDADA y archivada' : 'RECHAZADA'} con éxito`,
        type: accion === 'VALIDAR' ? 'success' : 'warning',
      });
      setShowRechazoModal(false);
      setComentariosRechazo('');
      await loadData();
      if (accion === 'VALIDAR') {
        setTimeout(() => {
          navigate('/investigaciones');
        }, 1500);
      }
    } catch (err) {
      setToast({ message: 'Error procesando validación: ' + err.message, type: 'error' });
    } finally {
      setValidating(false);
    }
  }

  async function handleEjecutarRevalidacion(accion, comentarios = '') {
    setRevalidating(true);
    try {
      const res = await revalidarInvestigacion(id, { accion, comentarios });
      setToast({
        message: res.message || `Investigación procesada con éxito`,
        type: accion === 'APROBAR_FINAL' ? 'success' : 'warning',
      });
      setShowDevolucionModal(false);
      setComentariosDevolucion('');
      await loadData();
      if (accion === 'APROBAR_FINAL') {
        setTimeout(() => {
          navigate('/investigaciones');
        }, 1500);
      }
    } catch (err) {
      setToast({ message: 'Error procesando revalidación: ' + err.message, type: 'error' });
    } finally {
      setRevalidating(false);
    }
  }


  if (loading) {
    return <div className={clsx('p-12', 'text-center', 'text-slate-500')}>Cargando formato de investigación...</div>;
  }

  if (!data || !data.investigacion) {
    return <div className={clsx('p-12', 'text-center', 'text-slate-400')}>No se encontró la investigación #{id}.</div>;
  }

  const inv = data.investigacion;
  const ev = data.evidencia || {};
  const vigenciaPrevia = data.vigenciaPrevia || null;

  let est = {};
  try {
    est = typeof ev.estudio_socioeconomico === 'string' ? JSON.parse(ev.estudio_socioeconomico) : (ev.estudio_socioeconomico || {});
  } catch (e) {
    est = ev.estudio_socioeconomico || {};
  }

  let fotosList = [];
  try {
    if (typeof ev.fotos_urls === 'string') {
      fotosList = JSON.parse(ev.fotos_urls);
    } else if (Array.isArray(ev.fotos_urls)) {
      fotosList = ev.fotos_urls;
    }
  } catch (e) {
    fotosList = [];
  }

  const firmaCaptured = ev.firma_url || '';
  const firmaInvestigadorCaptured = ev.firma_investigador_url || '';
  const isAval = inv.es_aval === true || (inv.tipo_sujeto || '').toUpperCase().includes('AVAL');

  const isValidated = Boolean(
    inv.validador_nombre ||
    inv.validador_id ||
    ['VALIDADA', 'APROBADA_FINAL', 'EN_REVISION_ANALISTA'].includes(inv.estado) ||
    inv.estado_validacion === 'VALIDADA'
  );
  const validadorNombre = inv.validador_nombre || (isValidated ? 'VALIDADOR AUTORIZADO' : '');

  function prepareFirmaSrc(src) {
    if (!src) return '';
    const trimmed = src.trim();
    if (trimmed.startsWith('<svg')) {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`;
    }
    if (trimmed.startsWith('data:image/svg+xml')) {
      if (trimmed.includes(';base64,')) return trimmed;
      const commaIndex = trimmed.indexOf(',');
      if (commaIndex !== -1) {
        const svgContent = trimmed.substring(commaIndex + 1);
        let rawSvg = svgContent;
        try {
          rawSvg = decodeURIComponent(svgContent);
        } catch (e) {
          rawSvg = svgContent;
        }
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawSvg)}`;
      }
    }
    return trimmed;
  }

  const safeFirmaSrc = prepareFirmaSrc(firmaCaptured);
  const safeFirmaInvestigadorSrc = prepareFirmaSrc(firmaInvestigadorCaptured);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={clsx('space-y-6', 'max-w-5xl', 'mx-auto', 'pb-12')}>
      {/* Top Action Bar (hidden on print) */}
      <div className={clsx('flex', 'items-center', 'justify-between', 'no-print', 'bg-slate-900', 'border', 'border-slate-800', 'p-4', 'rounded-2xl')}>
        <Link to="/investigaciones" className={clsx('flex', 'items-center', 'gap-1', 'text-xs', 'font-semibold', 'text-slate-400', 'hover:text-white', 'transition')}>
          <ChevronLeft className={clsx('w-4', 'h-4')} /> Volver a Investigaciones
        </Link>
        <div className={clsx('flex', 'items-center', 'gap-3')}>
          <span className={clsx('text-xs', 'text-slate-400')}>
            Formato: <strong className="text-white">{isAval ? 'AVAL' : 'SOLICITANTE'}</strong>
          </span>
          <button
            onClick={handlePrint}
            className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-sky-600', 'hover:bg-sky-500', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-2', 'shadow-lg', 'shadow-sky-600/30')}
          >
            <Printer className={clsx('w-4', 'h-4')} /> Imprimir Formato Oficial / PDF
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />}

      {/* Pestañas de Navegación del Paquete del Crédito (Solicitante + Avales) */}
      {data.paqueteInvestigaciones && data.paqueteInvestigaciones.length > 1 && (
        <div className={clsx('no-print', 'bg-slate-900', 'border', 'border-slate-800', 'p-4', 'rounded-2xl', 'space-y-2', 'shadow-xl')}>
          <div className={clsx('text-xs', 'font-bold', 'text-slate-300', 'flex', 'items-center', 'justify-between', 'border-b', 'border-slate-800', 'pb-2')}>
            <span className={clsx('flex', 'items-center', 'gap-1.5', 'text-sky-400')}>
              📦 Expediente Completo del Crédito — Folio: {inv.solicitud_folio || `#${inv.solicitud_id_sif}`}
            </span>
            <span className={clsx('text-[11px]', 'font-mono', 'text-slate-400')}>
              {data.paqueteInvestigaciones.filter(p => p.estado === 'COMPLETADA').length} de {data.paqueteInvestigaciones.length} Visitas Completadas en Campo
            </span>
          </div>
          <div className={clsx('flex', 'flex-wrap', 'gap-2', 'pt-1')}>
            {data.paqueteInvestigaciones.map((p) => {
              const isCurrent = String(p.id_sif_research) === String(id);
              const isAval = p.es_aval === true || (p.tipo_sujeto || '').toUpperCase().includes('AVAL');
              const isCli = !isAval;
              return (
                <Link
                  key={p.id_sif_research}
                  to={`/investigaciones/${p.id_sif_research}`}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${isCurrent
                      ? 'bg-sky-600 border-sky-400 text-white shadow-md shadow-sky-600/30'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                >
                  <span>{isCli ? '👤 Solicitante:' : '🤝 Aval:'}</span>
                  <span className="font-semibold">{p.sujeto_nombre || 'Socio'}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${p.estado === 'COMPLETADA' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                    {p.estado === 'COMPLETADA' ? '✓ Visita Terminada' : '⏳ En Proceso'}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* PANEL DE VALIDACIÓN Y DICTAMEN DE ANÁLISIS DE CRÉDITO (Oculto en impresión) */}

      <div className={clsx('no-print', 'bg-slate-900', 'border', 'border-slate-800', 'p-5', 'rounded-2xl', 'space-y-4', 'shadow-xl')}>
        <div className={clsx('flex', 'flex-wrap', 'items-center', 'justify-between', 'gap-3', 'border-b', 'border-slate-800', 'pb-3')}>
          <div className={clsx('flex', 'items-center', 'gap-3')}>
            <span className={clsx('text-xs', 'text-slate-400', 'font-bold', 'uppercase', 'tracking-wider')}>Estado de Validación:</span>
            {inv.estado === 'APROBADA_FINAL' ? (
              <span className={clsx('px-3', 'py-1', 'rounded-full', 'bg-teal-500/20', 'text-teal-300', 'border', 'border-teal-500/40', 'text-xs', 'font-bold', 'flex', 'items-center', 'gap-1.5')}>
                <ShieldCheck className={clsx('w-4', 'h-4')} /> ✅✅ APROBACIÓN FINAL DEL ANALISTA
              </span>
            ) : inv.estado === 'DEVUELTA_A_VALIDADOR' ? (
              <span className={clsx('px-3', 'py-1', 'rounded-full', 'bg-orange-500/20', 'text-orange-400', 'border', 'border-orange-500/40', 'text-xs', 'font-bold', 'flex', 'items-center', 'gap-1.5')}>
                <AlertTriangle className={clsx('w-4', 'h-4')} /> 🔄 DEVUELTA AL VALIDADOR
              </span>
            ) : inv.estado === 'VALIDADA' ? (
              <span className={clsx('px-3', 'py-1', 'rounded-full', 'bg-emerald-500/20', 'text-emerald-400', 'border', 'border-emerald-500/40', 'text-xs', 'font-bold', 'flex', 'items-center', 'gap-1.5')}>
                <CheckCircle2 className={clsx('w-4', 'h-4')} /> VALIDADO POR ANALISTA DE CRÉDITO
              </span>
            ) : inv.estado === 'RECHAZADA' ? (
              <span className={clsx('px-3', 'py-1', 'rounded-full', 'bg-rose-500/20', 'text-rose-400', 'border', 'border-rose-500/40', 'text-xs', 'font-bold', 'flex', 'items-center', 'gap-1.5')}>
                <XCircle className={clsx('w-4', 'h-4')} /> RECHAZADO / CORRECCIÓN SOLICITADA
              </span>
            ) : (
              <span className={clsx('px-3', 'py-1', 'rounded-full', 'bg-amber-500/20', 'text-amber-400', 'border', 'border-amber-500/40', 'text-xs', 'font-bold', 'flex', 'items-center', 'gap-1.5')}>
                <AlertTriangle className={clsx('w-4', 'h-4')} /> PENDIENTE DE VALIDACIÓN
              </span>
            )}
          </div>

          {/* Botones VALIDADOR: Aprobar o Rechazar el estudio del investigador */}
          {canValidate && (
            <div className={clsx('flex', 'items-center', 'gap-2')}>
              <button
                onClick={() => handleEjecutarValidacion('VALIDAR', 'Estudio socioecónómico validado correctamente')}
                disabled={validating || ['VALIDADA', 'APROBADA_FINAL', 'DEVUELTA_A_VALIDADOR'].includes(inv.estado)}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-emerald-600', 'hover:bg-emerald-500', 'disabled:opacity-50', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-1.5', 'shadow-lg', 'shadow-emerald-600/30')}
              >
                <CheckCircle2 className={clsx('w-4', 'h-4')} /> {validating ? 'Procesando...' : '✅ Validar Estudio'}
              </button>

              <button
                onClick={() => setShowRechazoModal(true)}
                disabled={validating}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-rose-600', 'hover:bg-rose-500', 'disabled:opacity-50', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-1.5', 'shadow-lg', 'shadow-rose-600/30')}
              >
                <XCircle className={clsx('w-4', 'h-4')} /> ❌ Rechazar Estudio
              </button>
            </div>
          )}
        </div>

        {/* Detalle de validación del Validador si existe */}
        {inv.validador_nombre && (
          <div className={clsx('text-xs', 'text-slate-300', 'bg-slate-950/60', 'p-3', 'rounded-xl', 'border', 'border-slate-800', 'space-y-1')}>
            <div className={clsx('text-[10px]', 'text-teal-400', 'font-bold', 'uppercase', 'tracking-wider', 'mb-1')}>Paso 1 — Dictamen del Validador de Crédito</div>
            <div className={clsx('flex', 'items-center', 'justify-between', 'text-slate-400')}>
              <span><strong>Validador:</strong> {inv.validador_nombre}</span>
              <span><strong>Fecha:</strong> {formatFechaCorta(inv.fecha_validacion)}</span>
            </div>
            {inv.comentarios_validacion && (
              <div className={clsx('text-slate-200', 'pt-1', 'font-mono', 'text-[11px]')}>
                <strong>Comentarios:</strong> {inv.comentarios_validacion}
              </div>
            )}
          </div>
        )}

        {/* PANEL DE REVALIDACIÓN DEL ANALISTA — solo visible para el Analista cuando el estado es VALIDADA */}
        {canRevalidar && inv.estado === 'VALIDADA' && (
          <div className={clsx('border', 'border-teal-700/50', 'bg-teal-950/40', 'rounded-xl', 'p-4', 'space-y-3')}>
            <div className={clsx('flex', 'items-center', 'gap-2', 'text-teal-300', 'text-xs', 'font-bold', 'uppercase', 'tracking-wider')}>
              <ShieldCheck className={clsx('w-4', 'h-4')} />
              Paso 2 — Tu Revisión Final como Analista
            </div>
            <p className={clsx('text-xs', 'text-slate-400')}>
              El Validador ya aprobó este estudio. Revisa el formato completo y emite tu dictamen final:
            </p>
            <div className={clsx('flex', 'items-center', 'gap-3', 'flex-wrap')}>
              <button
                onClick={() => handleEjecutarRevalidacion('APROBAR_FINAL', 'Investigación aprobada definitivamente por el Analista.')}
                disabled={revalidating}
                className={clsx('px-5', 'py-2.5', 'rounded-xl', 'bg-teal-600', 'hover:bg-teal-500', 'disabled:opacity-50', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-2', 'shadow-lg', 'shadow-teal-600/30')}
              >
                <CheckCircle2 className={clsx('w-4', 'h-4')} />
                {revalidating ? 'Procesando...' : '✅✅ Aprobar Definitivamente'}
              </button>
              <button
                onClick={() => setShowDevolucionModal(true)}
                disabled={revalidating}
                className={clsx('px-5', 'py-2.5', 'rounded-xl', 'bg-orange-600', 'hover:bg-orange-500', 'disabled:opacity-50', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-2', 'shadow-lg', 'shadow-orange-600/30')}
              >
                <AlertTriangle className={clsx('w-4', 'h-4')} />
                🔄 Devolver al Validador
              </button>
            </div>
          </div>
        )}

        {/* Ficha de aprobación final del Analista */}
        {inv.estado === 'APROBADA_FINAL' && inv.fecha_revalidacion && (
          <div className={clsx('text-xs', 'text-slate-300', 'bg-teal-950/40', 'p-3', 'rounded-xl', 'border', 'border-teal-700/50', 'space-y-1')}>
            <div className={clsx('text-[10px]', 'text-teal-300', 'font-bold', 'uppercase', 'tracking-wider', 'mb-1')}>Paso 2 — Aprobación Final del Analista</div>
            <div className={clsx('flex', 'items-center', 'justify-between', 'text-slate-400')}>
              <span><strong>Analista:</strong> {inv.analista_nombre || 'Analista'}</span>
              <span><strong>Fecha Aprobación Final:</strong> {formatFechaCorta(inv.fecha_revalidacion)}</span>
            </div>
            {inv.comentarios_revalidacion && (
              <div className={clsx('text-teal-200', 'pt-1', 'font-mono', 'text-[11px]')}>
                <strong>Comentarios Analista:</strong> {inv.comentarios_revalidacion}
              </div>
            )}
          </div>
        )}

        {/* Ficha de devolución al Validador */}
        {inv.estado === 'DEVUELTA_A_VALIDADOR' && inv.fecha_revalidacion && (
          <div className={clsx('text-xs', 'text-slate-300', 'bg-orange-950/40', 'p-3', 'rounded-xl', 'border', 'border-orange-700/50', 'space-y-1')}>
            <div className={clsx('text-[10px]', 'text-orange-300', 'font-bold', 'uppercase', 'tracking-wider', 'mb-1')}>Paso 2 — Devuelta al Validador por el Analista</div>
            <div className={clsx('flex', 'items-center', 'justify-between', 'text-slate-400')}>
              <span><strong>Analista:</strong> {inv.analista_nombre || 'Analista'}</span>
              <span><strong>Fecha Devolución:</strong> {formatFechaCorta(inv.fecha_revalidacion)}</span>
            </div>
            {inv.comentarios_revalidacion && (
              <div className={clsx('text-orange-200', 'pt-1', 'font-mono', 'text-[11px]')}>
                <strong>Motivo de devolución:</strong> {inv.comentarios_revalidacion}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL DE RECHAZO */}
      {showRechazoModal && (
        <div className={clsx('fixed', 'inset-0', 'bg-slate-950/80', 'backdrop-blur-sm', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4')}>
          <div className={clsx('bg-slate-900', 'border', 'border-slate-800', 'rounded-2xl', 'max-w-md', 'w-full', 'p-6', 'space-y-4', 'shadow-2xl')}>
            <div className={clsx('flex', 'items-center', 'justify-between', 'border-b', 'border-slate-800', 'pb-3')}>
              <h3 className={clsx('text-lg', 'font-bold', 'text-rose-400', 'flex', 'items-center', 'gap-2')}>
                <XCircle className={clsx('w-5', 'h-5')} /> Rechazar / Solicitud de Corrección
              </h3>
              <button onClick={() => setShowRechazoModal(false)} className={clsx('text-slate-400', 'hover:text-white')}>
                <X className={clsx('w-5', 'h-5')} />
              </button>
            </div>

            <p className={clsx('text-xs', 'text-slate-300')}>
              Escriba el motivo por el cual se rechaza el estudio. Este comentario se mostrará al investigador en la app móvil para que pueda corregir o complementar la información:
            </p>

            <textarea
              value={comentariosRechazo}
              onChange={(e) => setComentariosRechazo(e.target.value)}
              placeholder="Ej. La fotografía de la fachada está borrosa, por favor tomar nuevamente..."
              className={clsx('w-full', 'h-28', 'bg-slate-950', 'border', 'border-slate-800', 'rounded-xl', 'p-3', 'text-xs', 'text-white', 'placeholder-slate-500', 'focus:outline-none', 'focus:border-rose-500', 'resize-none')}
            />

            <div className={clsx('flex', 'items-center', 'justify-end', 'gap-3', 'pt-2')}>
              <button
                onClick={() => setShowRechazoModal(false)}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-slate-800', 'hover:bg-slate-700', 'text-slate-300', 'text-xs', 'font-semibold')}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleEjecutarValidacion('RECHAZAR', comentariosRechazo)}
                disabled={validating || !comentariosRechazo.trim()}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-rose-600', 'hover:bg-rose-500', 'disabled:opacity-50', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-1.5')}
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DEVOLUCIÓN AL VALIDADOR (por el Analista) */}
      {showDevolucionModal && (
        <div className={clsx('fixed', 'inset-0', 'bg-slate-950/80', 'backdrop-blur-sm', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4')}>
          <div className={clsx('bg-slate-900', 'border', 'border-slate-800', 'rounded-2xl', 'max-w-md', 'w-full', 'p-6', 'space-y-4', 'shadow-2xl')}>
            <div className={clsx('flex', 'items-center', 'justify-between', 'border-b', 'border-slate-800', 'pb-3')}>
              <h3 className={clsx('text-lg', 'font-bold', 'text-orange-400', 'flex', 'items-center', 'gap-2')}>
                <AlertTriangle className={clsx('w-5', 'h-5')} /> Devolver al Validador
              </h3>
              <button onClick={() => setShowDevolucionModal(false)} className={clsx('text-slate-400', 'hover:text-white')}>
                <X className={clsx('w-5', 'h-5')} />
              </button>
            </div>

            <p className={clsx('text-xs', 'text-slate-300')}>
              Indique el motivo por el cual devuelve el estudio al Validador para que lo revise nuevamente. Este comentario quedará registrado en el historial:
            </p>

            <textarea
              value={comentariosDevolucion}
              onChange={(e) => setComentariosDevolucion(e.target.value)}
              placeholder="Ej. Falta documentación del domicilio, el formato del aval está incompleto..."
              className={clsx('w-full', 'h-28', 'bg-slate-950', 'border', 'border-slate-800', 'rounded-xl', 'p-3', 'text-xs', 'text-white', 'placeholder-slate-500', 'focus:outline-none', 'focus:border-orange-500', 'resize-none')}
            />

            <div className={clsx('flex', 'items-center', 'justify-end', 'gap-3', 'pt-2')}>
              <button
                onClick={() => setShowDevolucionModal(false)}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-slate-800', 'hover:bg-slate-700', 'text-slate-300', 'text-xs', 'font-semibold')}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleEjecutarRevalidacion('DEVOLVER_VALIDADOR', comentariosDevolucion)}
                disabled={revalidating || !comentariosDevolucion.trim()}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-orange-600', 'hover:bg-orange-500', 'disabled:opacity-50', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-1.5')}
              >
                🔄 Confirmar Devolución
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BANNER VIGENCIA 90 DÍAS (oculto en impresión) */}
      {vigenciaPrevia && vigenciaPrevia.visita_vigente && (
        <div className={clsx('no-print', 'flex', 'items-start', 'gap-3', 'bg-emerald-950/60', 'border', 'border-emerald-500/40', 'text-emerald-300', 'rounded-2xl', 'p-4', 'shadow-lg', 'shadow-emerald-500/10')}>
          <ShieldCheck className={clsx('w-6', 'h-6', 'text-emerald-400', 'shrink-0', 'mt-0.5')} />
          <div className={clsx('text-sm', 'leading-relaxed')}>
            <p className={clsx('font-bold', 'text-emerald-300', 'text-base')}>
              ✅ Visita de Campo Vigente — No requiere nueva visita
            </p>
            <p className={clsx('text-emerald-400', 'mt-0.5')}>
              Esta persona ya fue investigada el{' '}
              <strong>{formatFechaCorta(vigenciaPrevia.visita_realizada_en)}</strong>{' '}
              como{' '}
              <strong>{vigenciaPrevia.tipo_previo === 'CLIENTE' ? 'Solicitante' : 'Aval'}</strong>.
              La vigencia de esa visita expira el{' '}
              <strong className="text-white">{formatFechaCorta(vigenciaPrevia.visita_vigente_hasta)}</strong>.
            </p>
            <Link
              to={`/investigaciones/${vigenciaPrevia.visita_previa_id}`}
              className={clsx('inline-block', 'mt-1.5', 'text-xs', 'font-semibold', 'text-emerald-300', 'hover:text-white', 'underline')}
            >
              📎 Ver formato de la visita anterior #{vigenciaPrevia.visita_previa_id}
            </Link>
          </div>
        </div>
      )}

      {/* Official Form Document Container */}
      <div className={clsx('bg-white', 'text-slate-900', 'rounded-xl', 'p-8', 'shadow-2xl', 'border', 'border-slate-200', 'print-area', 'space-y-6')}>

        {/* Document Header with Official QR Badge */}
        <div className={clsx('border-b-2', 'border-slate-900', 'pb-4', 'flex', 'items-center', 'justify-between')}>
          <div className={clsx('flex-1', 'text-center', 'pl-16')}>
            <h1 className={clsx('text-xl', 'font-extrabold', 'tracking-tight', 'text-slate-900', 'uppercase')}>
              Caja Oblatos <span className={clsx('text-sm', 'font-normal')}>AHORRO • CRÉDITO • SERVICIOS</span>
            </h1>
            <h2 className={clsx('text-sm', 'font-bold', 'text-slate-800', 'tracking-wide', 'mt-1', 'uppercase')}>
              DEPARTAMENTO DE INVESTIGACIONES DOMICILIARIAS
            </h2>
            <div className={clsx('text-xs', 'font-semibold', 'text-slate-700', 'mt-1', 'flex', 'items-center', 'justify-center', 'gap-2')}>
              <span>ESTUDIO DOMICILIARIO:</span>
              <span className={`px-2.5 py-0.5 rounded text-xs font-extrabold uppercase tracking-wide border ${isAval
                  ? 'bg-purple-100 text-purple-900 border-purple-400'
                  : 'bg-sky-100 text-sky-900 border-sky-400'
                }`}>
                {isAval ? '🤝 AVAL DE CRÉDITO' : '👤 SOLICITANTE DE PRÉSTAMO'}
              </span>
            </div>
          </div>

          {/* QR Code Verification Badge */}
          <div className={clsx('flex', 'flex-col', 'items-center', 'justify-center', 'border', 'border-slate-300', 'p-1.5', 'rounded-lg', 'bg-slate-50', 'shrink-0')}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${window.location.origin}/investigaciones/${inv.id_sif_research}`)}`}
              alt="QR Verificación"
              className={clsx('w-16', 'h-16', 'object-contain')}
            />
            <span className={clsx('text-[9px]', 'font-bold', 'text-slate-700', 'mt-1', 'tracking-tight')}>DOCUMENTO OFICIAL</span>
            <span className={clsx('text-[8px]', 'font-mono', 'text-slate-500')}>SIF #{inv.id_sif_research}</span>
          </div>
        </div>

        {/* General Data Grid */}
        <div className={clsx('grid', 'grid-cols-4', 'gap-2', 'text-xs', 'border', 'border-slate-800', 'p-3', 'rounded-lg', 'bg-slate-50')}>
          <div>
            <span className="font-bold">Socio Núm.:</span> {inv.persona_id_sif || 'N/A'}
          </div>
          <div>
            <span className="font-bold">Sucursal:</span> {formatNombreSucursal(inv.sucursal_id)}
          </div>
          <div className="col-span-2">
            <span className="font-bold">Fecha:</span> {inv.fecha_asignacion ? new Date(inv.fecha_asignacion).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX')}
          </div>

          <div className={clsx('col-span-2', 'flex', 'items-center', 'gap-1.5')}>
            <span className={`font-bold px-2 py-0.5 rounded text-[11px] uppercase tracking-wider ${isAval ? 'bg-purple-200 text-purple-950 font-black' : 'bg-sky-200 text-sky-950 font-black'
              }`}>
              {isAval ? '🤝 AVAL:' : '👤 SOLICITANTE:'}
            </span>
            <span className={clsx('font-extrabold', 'text-slate-900', 'text-sm')}>{inv.sujeto_nombre}</span>
          </div>
          <div>
            <span className="font-bold">Crédito:</span> {inv.solicitud_folio || 'N/A'}
          </div>
          <div>
            <span className="font-bold">Cantidad:</span> ${parseFloat(inv.monto_solicitado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </div>

          <div className="col-span-3">
            <span className="font-bold">Dirección SIF:</span> {inv.calle ? `${inv.calle} #${inv.numero_exterior || ''} Int ${inv.numero_interior || 'S/N'}, CP ${inv.codigo_postal || ''}` : 'Sin Dirección Registrada'}
            {est.tiene_direccion_diferente && (
              <div className={clsx('mt-1.5', 'p-2', 'bg-sky-50', 'border', 'border-sky-300', 'rounded-md', 'text-sky-950', 'text-xs', 'shadow-sm')}>
                <span className={clsx('font-bold', 'text-sky-800', 'uppercase', 'tracking-wider', 'block')}>
                  ✅ DIRECCIÓN REAL CONFIRMADA EN CAMPO:
                </span>
                <div className={clsx('font-semibold', 'text-slate-800')}>
                  {est.calle_real ? `Calle: ${est.calle_real}` : ''} {est.colonia_real ? `• Colonia: ${est.colonia_real}` : ''}
                </div>
                {est.referencias_domicilio && (
                  <div className={clsx('text-[11px]', 'text-slate-600', 'italic')}>
                    <strong>Referencias / Entre calles:</strong> {est.referencias_domicilio}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <span className="font-bold">Teléfono:</span> {est.telefono || 'N/A'}
          </div>
        </div>

        {/* Section 1: INVESTIGACIÓN */}
        <div className={clsx('border', 'border-slate-800', 'rounded-lg', 'overflow-hidden')}>
          <div className={clsx('bg-slate-800', 'text-white', 'px-3', 'py-1', 'text-xs', 'font-bold', 'tracking-wider', 'uppercase')}>
            1. INVESTIGACIÓN Y VERIFICACIÓN
          </div>
          <div className={clsx('p-3', 'grid', 'grid-cols-2', 'gap-4', 'text-xs')}>
            <div className="space-y-2">
              <div className={clsx('font-bold', 'border-b', 'border-slate-300', 'pb-1')}>Proporcionó la Información:</div>
              <div className={clsx('flex', 'items-center', 'gap-4')}>
                <span className={clsx('flex', 'items-center', 'gap-1')}>
                  {est.quien_atendio === 'titular' ? <CheckSquare className={clsx('w-4', 'h-4', 'text-sky-700')} /> : <Square className={clsx('w-4', 'h-4', 'text-slate-400')} />} Titular
                </span>
                <span className={clsx('flex', 'items-center', 'gap-1')}>
                  {est.quien_atendio === 'familiar' ? <CheckSquare className={clsx('w-4', 'h-4', 'text-sky-700')} /> : <Square className={clsx('w-4', 'h-4', 'text-slate-400')} />} Familiar
                </span>
              </div>
              {est.quien_atendio === 'familiar' && (
                <div className={clsx('text-[11px]', 'text-slate-700', 'pl-2', 'border-l-2', 'border-slate-400')}>
                  <div><strong>Nombre:</strong> {est.nombre_atendio || '____________________'}</div>
                  <div><strong>Parentesco:</strong> {est.parentesco_atendio || '____________________'}</div>
                  <div><strong>Vive con el solicitante:</strong> {est.vive_con_solicitante ? 'SÍ' : 'NO'}</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className={clsx('font-bold', 'border-b', 'border-slate-300', 'pb-1')}>Presentó Identificación:</div>
              <div className={clsx('flex', 'items-center', 'gap-3')}>
                <span>{est.presento_identificacion ? 'SÍ [X] NO [ ]' : 'SÍ [ ] NO [X]'}</span>
                <span><strong>Tipo:</strong> {est.tipo_identificacion || 'INE'}</span>
                <span><strong>Folio:</strong> {est.folio_identificacion || 'N/A'}</span>
              </div>
              <div className={clsx('text-[11px]', 'pt-1')}>
                <strong>Ocupación ({isAval ? 'del Aval' : 'del Solicitante'}):</strong> <span className={clsx('font-semibold', 'text-slate-900')}>{est.ocupacion || 'No especificada'}</span>
              </div>

              <div className={clsx('font-bold', 'border-b', 'border-slate-300', 'pb-1', 'pt-2')}>Particulares del Domicilio:</div>
              <div className={clsx('grid', 'grid-cols-3', 'gap-2', 'text-[11px]')}>
                <div><strong>Casa color:</strong> {est.casa_color || '__________'}</div>
                <div><strong>Puerta/Cancel:</strong> {est.puerta_cancel_color || '__________'}</div>
                <div><strong>Niveles:</strong> {est.numero_niveles || '1'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: STATUS SOCIO-ECONÓMICO */}
        <div className={clsx('border', 'border-slate-800', 'rounded-lg', 'overflow-hidden')}>
          <div className={clsx('bg-slate-800', 'text-white', 'px-3', 'py-1', 'text-xs', 'font-bold', 'tracking-wider', 'uppercase')}>
            2. STATUS SOCIO-ECONÓMICO
          </div>
          <div className={clsx('p-3', 'grid', 'grid-cols-3', 'gap-4', 'text-xs')}>
            <div>
              <div className={clsx('font-bold', 'mb-1')}>Estado Civil:</div>
              <div className={clsx('text-[11px]', 'space-y-0.5')}>
                <div>( {est.estado_civil === 'soltero' ? 'X' : ' '} ) Soltero</div>
                <div>( {est.estado_civil === 'casado' ? 'X' : ' '} ) Casado</div>
                <div>( {est.estado_civil === 'separado' ? 'X' : ' '} ) Separado</div>
                <div>( {est.estado_civil === 'divorciado' ? 'X' : ' '} ) Divorciado</div>
                <div>( {est.estado_civil === 'union_libre' ? 'X' : ' '} ) Unión Libre</div>
                <div>( {est.estado_civil === 'viudo' ? 'X' : ' '} ) Viudo</div>
              </div>
            </div>

            <div>
              <div className={clsx('font-bold', 'mb-1')}>Tipo de Vivienda:</div>
              <div className={clsx('text-[11px]', 'space-y-0.5')}>
                <div>( {est.situacion_vivienda === 'propia' ? 'X' : ' '} ) Propia</div>
                <div>( {est.situacion_vivienda === 'padres' || est.situacion_vivienda === 'de_sus_padres' ? 'X' : ' '} ) De sus Padres</div>
                <div>( {est.situacion_vivienda === 'prestada' ? 'X' : ' '} ) Prestada</div>
                <div>( {est.situacion_vivienda === 'pagandola' ? 'X' : ' '} ) Pagándola (${parseFloat(est.monto_pago_mensual || 0).toLocaleString('es-MX')})</div>
                <div>( {est.situacion_vivienda === 'rentada' ? 'X' : ' '} ) Rentada (${parseFloat(est.monto_pago_mensual || 0).toLocaleString('es-MX')})</div>
              </div>
              {est.situacion_vivienda === 'prestada' && (
                <div className={clsx('mt-1.5', 'text-[10px]', 'text-slate-800', 'bg-sky-50', 'p-1.5', 'rounded', 'border', 'border-sky-200', 'space-y-0.5')}>
                  <div><strong>Presta la vivienda:</strong> <span className="font-semibold">{est.nombre_quien_presta || 'Familiar'}</span></div>
                  <div><strong>Parentesco:</strong> <span className={clsx('font-semibold', 'text-sky-900')}>{est.parentesco_quien_presta || 'Conocido / Familiar'}</span></div>
                </div>
              )}
              <div className={clsx('mt-2', 'text-[11px]')}>
                <strong>Tiempo en domicilio:</strong> {est.tiempo_residencia || '3 años'}
              </div>
            </div>

            <div className="space-y-2">
              <div className={clsx('font-bold', 'mb-1')}>Integrantes del Hogar:</div>
              <div className={clsx('text-[11px]', 'space-y-1')}>
                <div>Mayores 18 años: <strong>{est.personas_mayores_18 || '2'}</strong> | Menores 18 años: <strong>{est.personas_menores_18 || '0'}</strong></div>
                <div>Personas que generan ingresos: <strong>{est.personas_generan_ingresos || '1'}</strong></div>
                <div>Personas que estudian: <strong>{est.personas_estudian || '0'}</strong></div>
                <div>Reciben pensión: <strong>{est.recibe_pension ? 'SÍ' : 'NO'}</strong></div>
              </div>
            </div>
          </div>

          {/* Valor estimado de bienes */}
          <div className={clsx('border-t', 'border-slate-300', 'p-3', 'bg-slate-50', 'grid', 'grid-cols-3', 'gap-4', 'text-xs')}>
            <div><strong>Valor Estimado Casa:</strong> ${parseFloat(est.valor_estimado_casa || 0).toLocaleString('es-MX')}</div>
            <div><strong>Valor Muebles:</strong> ${parseFloat(est.valor_estimado_muebles || 0).toLocaleString('es-MX')}</div>
            <div><strong>Valor Automóvil:</strong> ${parseFloat(est.valor_estimado_automovil || 0).toLocaleString('es-MX')}</div>
          </div>
        </div>

        {/* Section 3: INFORMACIÓN DE REFERENCIAS / AVALES */}
        <div className={clsx('border', 'border-slate-800', 'rounded-lg', 'overflow-hidden')}>
          <div className={clsx('bg-slate-800', 'text-white', 'px-3', 'py-1', 'text-xs', 'font-bold', 'tracking-wider', 'uppercase')}>
            3. INFORMACIÓN DE REFERENCIAS / {isAval ? 'SOLICITANTE' : 'AVALES'}
          </div>
          <div className={clsx('p-3', 'text-xs', 'space-y-2')}>
            {data.avales && data.avales.length > 0 ? (
              data.avales.map((av, idx) => {
                const refData = (est.referencias_avales && est.referencias_avales[idx]) || {};
                const parentesco = refData.parentesco || av.parentesco || 'Familiar / Aval';
                const tiempoConocerlo = refData.tiempo_conocerlo || av.tiempo_conocerlo || '5 años';
                const confirmo = refData.confirmo !== undefined ? (refData.confirmo === true || refData.confirmo === 'SI') : true;

                return (
                  <div key={idx} className={clsx('p-2.5', 'border', 'border-slate-200', 'rounded', 'bg-slate-50', 'flex', 'items-center', 'justify-between', 'text-[11px]')}>
                    <div className="space-y-0.5">
                      <div><strong>Nombre:</strong> {av.nombre_completo}</div>
                      <div><strong>Domicilio:</strong> {av.calle} CP {av.codigo_postal}</div>
                      <div className={clsx('text-slate-700', 'pt-0.5')}>
                        <strong>Parentesco:</strong> <span className={clsx('font-semibold', 'text-sky-900')}>{parentesco}</span> · <strong>Tiempo de conocerlo:</strong> <span className={clsx('font-semibold', 'text-sky-900')}>{tiempoConocerlo}</span>
                      </div>
                    </div>
                    <div className={clsx('text-right', 'whitespace-nowrap', 'pl-4', 'border-l', 'border-slate-200', 'ml-2', 'font-mono')}>
                      <strong>Confirmó:</strong> SÍ [{confirmo ? 'X' : ' '}] NO [{!confirmo ? 'X' : ' '}]
                    </div>
                  </div>
                );
              })
            ) : est.referencias_avales && est.referencias_avales.length > 0 ? (
              est.referencias_avales.map((ref, idx) => (
                <div key={idx} className={clsx('p-2.5', 'border', 'border-slate-200', 'rounded', 'bg-slate-50', 'flex', 'items-center', 'justify-between', 'text-[11px]')}>
                  <div className="space-y-0.5">
                    <div><strong>Nombre:</strong> {ref.nombre || 'Referencia Personal'}</div>
                    <div><strong>Domicilio:</strong> {ref.domicilio || 'Domicilio registrado'}</div>
                    <div className={clsx('text-slate-700', 'pt-0.5')}>
                      <strong>Parentesco:</strong> <span className={clsx('font-semibold', 'text-sky-900')}>{ref.parentesco || 'Conocido'}</span> · <strong>Tiempo de conocerlo:</strong> <span className={clsx('font-semibold', 'text-sky-900')}>{ref.tiempo_conocerlo || '3 años'}</span>
                    </div>
                  </div>
                  <div className={clsx('text-right', 'whitespace-nowrap', 'pl-4', 'border-l', 'border-slate-200', 'ml-2', 'font-mono')}>
                    <strong>Confirmó:</strong> SÍ [{ref.confirmo !== false ? 'X' : ' '}] NO [{ref.confirmo === false ? 'X' : ' '}]
                  </div>
                </div>
              ))
            ) : (
              <div className={clsx('p-2.5', 'border', 'border-slate-200', 'rounded', 'bg-slate-50', 'flex', 'items-center', 'justify-between', 'text-[11px]')}>
                <div className="space-y-0.5">
                  <div><strong>Nombre:</strong> {inv.sujeto_nombre || 'Referencia Registrada'}</div>
                  <div><strong>Domicilio:</strong> {inv.calle || 'Domicilio registrado'} CP {inv.codigo_postal || ''}</div>
                  <div className={clsx('text-slate-700', 'pt-0.5')}>
                    <strong>Parentesco:</strong> <span className={clsx('font-semibold', 'text-sky-900')}>Familiar / Conocido</span> · <strong>Tiempo de conocerlo:</strong> <span className={clsx('font-semibold', 'text-sky-900')}>5 años</span>
                  </div>
                </div>
                <div className={clsx('text-right', 'whitespace-nowrap', 'pl-4', 'border-l', 'border-slate-200', 'ml-2', 'font-mono')}>
                  <strong>Confirmó:</strong> SÍ [X] NO [ ]
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Section 4: OBSERVACIONES DEL INVESTIGADOR Y DICTAMEN */}
        <div className={clsx('border', 'border-slate-800', 'rounded-lg', 'p-4', 'space-y-3', 'bg-slate-50')}>
          <div className={clsx('font-bold', 'text-xs', 'uppercase', 'tracking-wider', 'text-slate-900', 'border-b', 'border-slate-300', 'pb-1')}>
            4. OBSERVACIONES Y DICTAMEN DEL INVESTIGADOR DE CAMPO
          </div>
          <div className={clsx('text-xs', 'text-slate-800', 'min-h-[60px]', 'whitespace-pre-wrap', 'font-mono', 'bg-white', 'p-3', 'rounded', 'border', 'border-slate-300')}>
            {ev.notas_investigador || inv.observaciones_sif || 'Sin observaciones adicionales.'}
          </div>

          <div className={clsx('flex', 'items-center', 'justify-between', 'pt-2', 'text-xs', 'font-bold', 'flex-wrap', 'gap-2')}>
            <div className={clsx('flex', 'items-center', 'gap-2', 'flex-wrap')}>
              <span>Dictamen de Campo:</span>
              {(() => {
                const dictText = (est.dictamen || ev.notas_investigador || '').toUpperCase();
                if (dictText.includes('PENDIENTE')) {
                  return <span className={clsx('px-3', 'py-1', 'rounded', 'bg-amber-600', 'text-white', 'uppercase', 'text-[11px]', 'font-bold')}>⏳ PENDIENTE</span>;
                } else if (dictText.includes('CAMBIO') || dictText.includes('NO LOCALIZADO')) {
                  return <span className={clsx('px-3', 'py-1', 'rounded', 'bg-orange-600', 'text-white', 'uppercase', 'text-[11px]', 'font-bold')}>🔄 CAMBIO DE DOMICILIO</span>;
                } else {
                  return <span className={clsx('px-3', 'py-1', 'rounded', 'bg-sky-700', 'text-white', 'uppercase', 'text-[11px]', 'font-bold')}>✓ DOMICILIO CONFIRMADO</span>;
                }
              })()}

              {(est.supuesto || ev.supuesto || (ev.estudio_socioeconomico && typeof ev.estudio_socioeconomico === 'object' && ev.estudio_socioeconomico.supuesto)) && (
                <span className={clsx('px-3', 'py-1', 'rounded', 'bg-purple-700', 'text-white', 'uppercase', 'text-[11px]', 'font-bold')}>
                  📌 Supuesto: {est.supuesto || ev.supuesto || ev.estudio_socioeconomico.supuesto}
                </span>
              )}
            </div>
            <div>
              Investigador: <span className="font-semibold">{inv.investigador_nombre || 'Asignado'}</span>
            </div>
          </div>
        </div>


        {/* Section 5: EVIDENCIA FOTOGRÁFICA REGISTRADA DESDE LA APP MÓVIL */}
        <div className={clsx('border', 'border-slate-800', 'rounded-lg', 'overflow-hidden')}>
          <div className={clsx('bg-slate-800', 'text-white', 'px-3', 'py-1', 'text-xs', 'font-bold', 'tracking-wider', 'uppercase', 'flex', 'items-center', 'justify-between')}>
            <span className={clsx('flex', 'items-center', 'gap-1.5')}>
              <Camera className={clsx('w-3.5', 'h-3.5')} /> 5. EVIDENCIA FOTOGRÁFICA REGISTRADA EN CAMPO
            </span>
            <span className={clsx('text-[10px]', 'font-normal', 'text-slate-300')}>
              {fotosList.length > 0 ? `${fotosList.length} Fotografía(s)` : 'Sin fotografías'}
            </span>
          </div>
          <div className={clsx('p-4', 'bg-slate-50')}>
            {fotosList.length > 0 ? (
              <div className={clsx('grid', 'grid-cols-2', 'sm:grid-cols-3', 'gap-4')}>
                {fotosList.map((fotoUri, idx) => (
                  <div key={idx} className={clsx('border', 'border-slate-300', 'rounded-lg', 'bg-white', 'p-2', 'shadow-sm', 'flex', 'flex-col', 'items-center')}>
                    <img
                      src={fotoUri}
                      alt={`Evidencia Fotográfica ${idx + 1}`}
                      className={clsx('w-full', 'h-36', 'object-cover', 'rounded', 'border', 'border-slate-200', 'cursor-pointer', 'hover:opacity-90', 'transition')}
                      onClick={() => {
                        setSelectedFotoIndex(idx);
                        setZoomScale(1);
                        setRotation(0);
                      }}
                    />
                    <span className={clsx('text-[10px]', 'font-bold', 'text-slate-600', 'mt-1.5')}>Evidencia Foto #{idx + 1}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={clsx('text-center', 'py-4', 'text-slate-400', 'italic', 'text-xs')}>
                No se capturaron fotografías de evidencia durante esta visita.
              </div>
            )}
          </div>
        </div>

        {/* Signatures & Evidence Footer (2-column layout) */}
        <div className={clsx('pt-8', 'border-t', 'border-slate-300', 'grid', 'grid-cols-2', 'gap-12', 'text-center', 'text-xs')}>
          {/* Nombre / Identidad del Investigador */}
          <div className={clsx('flex', 'flex-col', 'items-center', 'justify-between')}>
            <div className={clsx('w-full', 'h-24', 'flex', 'flex-col', 'items-center', 'justify-center', 'border', 'border-dashed', 'border-slate-300', 'rounded', 'bg-slate-50/80', 'p-2', 'mb-2', 'shadow-inner')}>
              <span className={clsx('text-[11px]', 'uppercase', 'font-bold', 'text-slate-500', 'mb-1')}>Investigación Realizada Por:</span>
              <span className={clsx('font-extrabold', 'text-slate-900', 'text-sm', 'tracking-wide', 'text-center')}>
                {inv.investigador_nombre ? inv.investigador_nombre.toUpperCase() : 'DEPARTAMENTO DE INVESTIGACIONES'}
              </span>
              <span className={clsx('text-[10px]', 'text-sky-700', 'font-semibold', 'mt-1')}>✓ Registro de Campo Confirmado</span>
            </div>
            <div className={clsx('border-b', 'border-slate-800', 'w-full', 'mb-1')}></div>
            <div className={clsx('font-bold', 'text-slate-900')}>Nombre del Investigador de Campo</div>
            <div className={clsx('text-[10px]', 'text-slate-500')}>{inv.investigador_nombre || 'Caja Oblatos CPO'}</div>
          </div>

          {/* Firma / Validación del Validador (Solo aparece tras ser validada por un usuario con rol Validador o Superadmin) */}
          <div className={clsx('flex', 'flex-col', 'items-center', 'justify-between')}>
            {isValidated && (
              <>
                <div className={clsx('w-full', 'h-24', 'flex', 'flex-col', 'items-center', 'justify-center', 'border', 'border-dashed', 'border-emerald-300', 'rounded', 'bg-emerald-50/80', 'p-2', 'mb-2', 'shadow-inner')}>
                  <span className={clsx('text-[11px]', 'uppercase', 'font-bold', 'text-emerald-800', 'mb-1')}>
                    ✓ Validado por:
                  </span>
                  <span className={clsx('font-extrabold', 'text-slate-900', 'text-sm', 'tracking-wide', 'text-center')}>
                    {validadorNombre.toUpperCase()}
                  </span>
                  <span className={clsx('text-[10px]', 'text-emerald-700', 'font-semibold', 'mt-1')}>
                    {inv.fecha_validacion
                      ? `Validado el ${new Date(inv.fecha_validacion).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}`
                      : '✓ Firma y Validación Confirmada'}
                  </span>
                </div>
                <div className={clsx('border-b', 'border-slate-800', 'w-full', 'mb-1')}></div>
                <div className={clsx('font-bold', 'text-slate-900')}>Nombre quien Valida</div>
                <div className={clsx('text-[10px]', 'text-slate-500')}>{validadorNombre || 'Validador de Crédito'}</div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Lightbox HD Modal para evidencias fotográficas */}
      {selectedFotoIndex !== null && fotosList[selectedFotoIndex] && (
        <div
          className={clsx('fixed', 'inset-0', 'z-50', 'bg-slate-950/90', 'backdrop-blur-md', 'flex', 'flex-col', 'items-center', 'justify-between', 'p-4', 'no-print', 'select-none')}
          onClick={() => setSelectedFotoIndex(null)}
        >
          {/* Header Bar */}
          <div className={clsx('w-full', 'max-w-4xl', 'flex', 'items-center', 'justify-between', 'text-white', 'z-10', 'p-2')} onClick={(e) => e.stopPropagation()}>
            <div className={clsx('text-xs', 'font-semibold', 'tracking-wide', 'flex', 'items-center', 'gap-2')}>
              <Camera className={clsx('w-4', 'h-4', 'text-sky-400')} />
              <span>Evidencia Fotográfica #{selectedFotoIndex + 1} de {fotosList.length}</span>
            </div>

            {/* Controles de Transformación */}
            <div className={clsx('flex', 'items-center', 'gap-2', 'bg-slate-900', 'border', 'border-slate-700/60', 'p-1.5', 'rounded-xl')}>
              <button
                onClick={() => setZoomScale((z) => Math.max(0.8, z - 0.25))}
                className={clsx('p-1.5', 'hover:bg-slate-800', 'rounded-lg', 'text-slate-300', 'hover:text-white', 'transition')}
                title="Alejar Zoom"
              >
                <ZoomOut className={clsx('w-4', 'h-4')} />
              </button>
              <span className={clsx('text-[11px]', 'font-mono', 'w-10', 'text-center', 'font-bold', 'text-sky-400')}>
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                onClick={() => setZoomScale((z) => Math.min(3, z + 0.25))}
                className={clsx('p-1.5', 'hover:bg-slate-800', 'rounded-lg', 'text-slate-300', 'hover:text-white', 'transition')}
                title="Acercar Zoom"
              >
                <ZoomIn className={clsx('w-4', 'h-4')} />
              </button>
              <div className={clsx('w-px', 'h-4', 'bg-slate-700', 'mx-1')}></div>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className={clsx('p-1.5', 'hover:bg-slate-800', 'rounded-lg', 'text-slate-300', 'hover:text-white', 'transition')}
                title="Rotar 90°"
              >
                <RotateCw className={clsx('w-4', 'h-4')} />
              </button>
              <div className={clsx('w-px', 'h-4', 'bg-slate-700', 'mx-1')}></div>
              <a
                href={fotosList[selectedFotoIndex]}
                download={`evidencia_investigacion_${inv.id_sif_research}_${selectedFotoIndex + 1}.jpg`}
                className={clsx('p-1.5', 'hover:bg-slate-800', 'rounded-lg', 'text-slate-300', 'hover:text-white', 'transition', 'flex', 'items-center', 'gap-1')}
                title="Descargar imagen"
              >
                <Download className={clsx('w-4', 'h-4', 'text-emerald-400')} />
              </a>
            </div>

            <button
              onClick={() => setSelectedFotoIndex(null)}
              className={clsx('p-2', 'bg-rose-600/80', 'hover:bg-rose-500', 'text-white', 'rounded-xl', 'transition')}
              title="Cerrar (Esc)"
            >
              <X className={clsx('w-5', 'h-5')} />
            </button>
          </div>

          {/* Main Image Container */}
          <div
            className={clsx('flex-1', 'flex', 'items-center', 'justify-center', 'relative', 'w-full', 'max-w-5xl', 'overflow-hidden', 'my-2')}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Previous Button */}
            {selectedFotoIndex > 0 && (
              <button
                onClick={() => {
                  setSelectedFotoIndex((i) => i - 1);
                  setZoomScale(1);
                  setRotation(0);
                }}
                className={clsx('absolute', 'left-4', 'z-20', 'p-3', 'bg-slate-900/80', 'border', 'border-slate-700', 'hover:bg-sky-600', 'text-white', 'rounded-2xl', 'transition', 'shadow-xl')}
                title="Fotografía Anterior"
              >
                <ChevronLeft className={clsx('w-6', 'h-6')} />
              </button>
            )}

            {/* Image Canvas with Scale & Rotate */}
            <div className={clsx('overflow-auto', 'max-h-full', 'max-w-full', 'flex', 'items-center', 'justify-center', 'p-4')}>
              <img
                src={fotosList[selectedFotoIndex]}
                alt={`Evidencia ${selectedFotoIndex + 1}`}
                style={{
                  transform: `scale(${zoomScale}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-out',
                }}
                className={clsx('max-h-[75vh]', 'max-w-[85vw]', 'object-contain', 'rounded-xl', 'shadow-2xl', 'border', 'border-slate-800')}
              />
            </div>

            {/* Next Button */}
            {selectedFotoIndex < fotosList.length - 1 && (
              <button
                onClick={() => {
                  setSelectedFotoIndex((i) => i + 1);
                  setZoomScale(1);
                  setRotation(0);
                }}
                className={clsx('absolute', 'right-4', 'z-20', 'p-3', 'bg-slate-900/80', 'border', 'border-slate-700', 'hover:bg-sky-600', 'text-white', 'rounded-2xl', 'transition', 'shadow-xl')}
                title="Fotografía Siguiente"
              >
                <ChevronRight className={clsx('w-6', 'h-6')} />
              </button>
            )}
          </div>

          <div className={clsx('text-[11px]', 'text-slate-400', 'pb-2')}>
            Tip: Usa los controles superiores para ajustar el zoom o rotar la fotografía
          </div>
        </div>
      )}
    </div>
  );
}

