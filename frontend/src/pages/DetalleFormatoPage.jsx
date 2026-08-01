import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchInvestigacionDetalle, validarInvestigacion } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Printer, ChevronLeft, CheckSquare, Square, Camera, ZoomIn, ZoomOut, RotateCw, Download, ChevronRight, X, ShieldCheck, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import Toast from '../components/Toast';

// Helper: formatea fecha en DD/Mon/AAAA
function formatFechaCorta(fechaStr) {
  if (!fechaStr) return '—';
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const d = new Date(fechaStr);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2,'0')}/${meses[d.getMonth()]}/${d.getFullYear()}`;
}

export default function DetalleFormatoPage() {
  const { id } = useParams();
  const auth = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFotoIndex, setSelectedFotoIndex] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Validación
  const [validating, setValidating] = useState(false);
  const [showRechazoModal, setShowRechazoModal] = useState(false);
  const [comentariosRechazo, setComentariosRechazo] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });

  // Obtener rol de forma robusta
  let userRole = '';
  if (auth && auth.user && (auth.user.rol || auth.user.role)) {
    userRole = (auth.user.rol || auth.user.role).toLowerCase();
  } else {
    try {
      const parsed = JSON.parse(localStorage.getItem('cpo_user') || '{}');
      userRole = (parsed.rol || parsed.role || '').toLowerCase();
    } catch (e) {}
  }

  // Permitir validar a superadmin, admin, validador, analista (o si no se especificó rol restrictivo)
  const canValidate = !userRole || ['superadmin', 'admin', 'validador', 'analista'].includes(userRole);



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
        message: res.message || `Investigación ${accion === 'VALIDAR' ? 'VALIDADA' : 'RECHAZADA'} con éxito`,
        type: accion === 'VALIDAR' ? 'success' : 'warning',
      });
      setShowRechazoModal(false);
      setComentariosRechazo('');
      await loadData();
    } catch (err) {
      setToast({ message: 'Error procesando validación: ' + err.message, type: 'error' });
    } finally {
      setValidating(false);
    }
  }


  if (loading) {
    return <div className="p-12 text-center text-slate-500">Cargando formato de investigación...</div>;
  }

  if (!data || !data.investigacion) {
    return <div className="p-12 text-center text-slate-400">No se encontró la investigación #{id}.</div>;
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
  const isAval = inv.tipo_sujeto !== 'CLIENTE';

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
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Action Bar (hidden on print) */}
      <div className="flex items-center justify-between no-print bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <Link to="/investigaciones" className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white transition">
          <ChevronLeft className="w-4 h-4" /> Volver a Investigaciones
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Formato: <strong className="text-white">{isAval ? 'AVAL' : 'SOLICITANTE'}</strong>
          </span>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-600/30"
          >
            <Printer className="w-4 h-4" /> Imprimir Formato Oficial / PDF
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />}

      {/* PANEL DE VALIDACIÓN Y DICTAMEN DE ANÁLISIS DE CRÉDITO (Oculto en impresión) */}
      <div className="no-print bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Estado de Validación:</span>
            {inv.estado === 'VALIDADA' ? (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> ESTUDIO VALIDADO Y APROBADO
              </span>
            ) : inv.estado === 'RECHAZADA' ? (
              <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5">
                <XCircle className="w-4 h-4" /> RECHAZADO / CORRECCIÓN SOLICITADA
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> PENDIENTE DE VALIDACIÓN
              </span>
            )}
          </div>

          {/* Botones de acción para Validador / Admin / Superadmin */}
          {canValidate && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEjecutarValidacion('VALIDAR', 'Estudio socioeconómico validado correctamente')}
                disabled={validating || inv.estado === 'VALIDADA'}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
              >
                <CheckCircle2 className="w-4 h-4" /> {validating ? 'Procesando...' : '✅ Aprobar y Validar Estudio'}
              </button>

              <button
                onClick={() => setShowRechazoModal(true)}
                disabled={validating}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30"
              >
                <XCircle className="w-4 h-4" /> ❌ Rechazar Estudio
              </button>
            </div>
          )}
        </div>

        {/* Detalle de validación previo si existe */}
        {inv.validador_nombre && (
          <div className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span><strong>Validador / Analista:</strong> {inv.validador_nombre}</span>
              <span><strong>Fecha de Dictamen:</strong> {formatFechaCorta(inv.fecha_validacion)}</span>
            </div>
            {inv.comentarios_validacion && (
              <div className="text-slate-200 pt-1 font-mono text-[11px]">
                <strong>Comentarios del Dictamen:</strong> {inv.comentarios_validacion}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL DE RECHAZO */}
      {showRechazoModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
                <XCircle className="w-5 h-5" /> Rechazar / Solicitud de Corrección
              </h3>
              <button onClick={() => setShowRechazoModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Escriba el motivo por el cual se rechaza el estudio. Este comentario se mostrará al investigador en la app móvil para que pueda corregir o complementar la información:
            </p>

            <textarea
              value={comentariosRechazo}
              onChange={(e) => setComentariosRechazo(e.target.value)}
              placeholder="Ej. La fotografía de la fachada está borrosa, por favor tomar nuevamente..."
              className="w-full h-28 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRechazoModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleEjecutarValidacion('RECHAZAR', comentariosRechazo)}
                disabled={validating || !comentariosRechazo.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}


      {/* BANNER VIGENCIA 90 DÍAS (oculto en impresión) */}
      {vigenciaPrevia && vigenciaPrevia.visita_vigente && (
        <div className="no-print flex items-start gap-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 rounded-2xl p-4 shadow-lg shadow-emerald-500/10">
          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <p className="font-bold text-emerald-300 text-base">
              ✅ Visita de Campo Vigente — No requiere nueva visita
            </p>
            <p className="text-emerald-400 mt-0.5">
              Esta persona ya fue investigada el{' '}
              <strong>{formatFechaCorta(vigenciaPrevia.visita_realizada_en)}</strong>{' '}
              como{' '}
              <strong>{vigenciaPrevia.tipo_previo === 'CLIENTE' ? 'Solicitante' : 'Aval'}</strong>.
              La vigencia de esa visita expira el{' '}
              <strong className="text-white">{formatFechaCorta(vigenciaPrevia.visita_vigente_hasta)}</strong>.
            </p>
            <Link
              to={`/investigaciones/${vigenciaPrevia.visita_previa_id}`}
              className="inline-block mt-1.5 text-xs font-semibold text-emerald-300 hover:text-white underline"
            >
              📎 Ver formato de la visita anterior #{vigenciaPrevia.visita_previa_id}
            </Link>
          </div>
        </div>
      )}

      {/* Official Form Document Container */}
      <div className="bg-white text-slate-900 rounded-xl p-8 shadow-2xl border border-slate-200 print-area space-y-6">
        
        {/* Document Header with Official QR Badge */}
        <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
          <div className="flex-1 text-center pl-16">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">
              Caja Oblatos <span className="text-sm font-normal">AHORRO • CRÉDITO • SERVICIOS</span>
            </h1>
            <h2 className="text-sm font-bold text-slate-800 tracking-wide mt-1 uppercase">
              DEPARTAMENTO DE INVESTIGACIONES DOMICILIARIAS
            </h2>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">
              ESTUDIO DOMICILIARIO: <span className="underline font-bold">{isAval ? 'AVAL DE PRÉSTAMO' : 'SOLICITANTE DE PRÉSTAMO'}</span>
            </div>
          </div>

          {/* QR Code Verification Badge */}
          <div className="flex flex-col items-center justify-center border border-slate-300 p-1.5 rounded-lg bg-slate-50 shrink-0">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${window.location.origin}/investigaciones/${inv.id_sif_research}`)}`}
              alt="QR Verificación"
              className="w-16 h-16 object-contain"
            />
            <span className="text-[9px] font-bold text-slate-700 mt-1 tracking-tight">DOCUMENTO OFICIAL</span>
            <span className="text-[8px] font-mono text-slate-500">SIF #{inv.id_sif_research}</span>
          </div>
        </div>

        {/* General Data Grid */}
        <div className="grid grid-cols-4 gap-2 text-xs border border-slate-800 p-3 rounded-lg bg-slate-50">
          <div>
            <span className="font-bold">Socio Núm.:</span> {inv.persona_id_sif || 'N/A'}
          </div>
          <div>
            <span className="font-bold">Sucursal:</span> {inv.sucursal_id || '01 - Matriz'}
          </div>
          <div className="col-span-2">
            <span className="font-bold">Fecha:</span> {inv.fecha_asignacion ? new Date(inv.fecha_asignacion).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX')}
          </div>

          <div className="col-span-2">
            <span className="font-bold text-sky-800 uppercase">{isAval ? 'AVAL' : 'SOLICITANTE'}:</span> {inv.sujeto_nombre}
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
              <div className="mt-1.5 p-2 bg-sky-50 border border-sky-300 rounded-md text-sky-950 text-xs shadow-sm">
                <span className="font-bold text-sky-800 uppercase tracking-wider block">
                  ✅ DIRECCIÓN REAL CONFIRMADA EN CAMPO:
                </span>
                <div className="font-semibold text-slate-800">
                  {est.calle_real ? `Calle: ${est.calle_real}` : ''} {est.colonia_real ? `• Colonia: ${est.colonia_real}` : ''}
                </div>
                {est.referencias_domicilio && (
                  <div className="text-[11px] text-slate-600 italic">
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
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <div className="bg-slate-800 text-white px-3 py-1 text-xs font-bold tracking-wider uppercase">
            1. INVESTIGACIÓN Y VERIFICACIÓN
          </div>
          <div className="p-3 grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <div className="font-bold border-b border-slate-300 pb-1">Proporcionó la Información:</div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  {est.quien_atendio === 'titular' ? <CheckSquare className="w-4 h-4 text-sky-700" /> : <Square className="w-4 h-4 text-slate-400" />} Titular
                </span>
                <span className="flex items-center gap-1">
                  {est.quien_atendio === 'familiar' ? <CheckSquare className="w-4 h-4 text-sky-700" /> : <Square className="w-4 h-4 text-slate-400" />} Familiar
                </span>
              </div>
              {est.quien_atendio === 'familiar' && (
                <div className="text-[11px] text-slate-700 pl-2 border-l-2 border-slate-400">
                  <div><strong>Nombre:</strong> {est.nombre_atendio || '____________________'}</div>
                  <div><strong>Parentesco:</strong> {est.parentesco_atendio || '____________________'}</div>
                  <div><strong>Vive con el solicitante:</strong> {est.vive_con_solicitante ? 'SÍ' : 'NO'}</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="font-bold border-b border-slate-300 pb-1">Presentó Identificación:</div>
              <div className="flex items-center gap-3">
                <span>{est.presento_identificacion ? 'SÍ [X] NO [ ]' : 'SÍ [ ] NO [X]'}</span>
                <span><strong>Tipo:</strong> {est.tipo_identificacion || 'INE'}</span>
                <span><strong>Folio:</strong> {est.folio_identificacion || 'N/A'}</span>
              </div>
              <div className="text-[11px] pt-1">
                <strong>Ocupación ({isAval ? 'del Aval' : 'del Solicitante'}):</strong> <span className="font-semibold text-slate-900">{est.ocupacion || 'No especificada'}</span>
              </div>

              <div className="font-bold border-b border-slate-300 pb-1 pt-2">Particulares del Domicilio:</div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div><strong>Casa color:</strong> {est.casa_color || '__________'}</div>
                <div><strong>Puerta/Cancel:</strong> {est.puerta_cancel_color || '__________'}</div>
                <div><strong>Niveles:</strong> {est.numero_niveles || '1'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: STATUS SOCIO-ECONÓMICO */}
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <div className="bg-slate-800 text-white px-3 py-1 text-xs font-bold tracking-wider uppercase">
            2. STATUS SOCIO-ECONÓMICO
          </div>
          <div className="p-3 grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="font-bold mb-1">Estado Civil:</div>
              <div className="text-[11px] space-y-0.5">
                <div>( {est.estado_civil === 'soltero' ? 'X' : ' '} ) Soltero</div>
                <div>( {est.estado_civil === 'casado' ? 'X' : ' '} ) Casado</div>
                <div>( {est.estado_civil === 'separado' ? 'X' : ' '} ) Separado</div>
                <div>( {est.estado_civil === 'divorciado' ? 'X' : ' '} ) Divorciado</div>
                <div>( {est.estado_civil === 'union_libre' ? 'X' : ' '} ) Unión Libre</div>
                <div>( {est.estado_civil === 'viudo' ? 'X' : ' '} ) Viudo</div>
              </div>
            </div>

            <div>
              <div className="font-bold mb-1">Tipo de Vivienda:</div>
              <div className="text-[11px] space-y-0.5">
                <div>( {est.situacion_vivienda === 'propia' ? 'X' : ' '} ) Propia</div>
                <div>( {est.situacion_vivienda === 'padres' || est.situacion_vivienda === 'de_sus_padres' ? 'X' : ' '} ) De sus Padres</div>
                <div>( {est.situacion_vivienda === 'prestada' ? 'X' : ' '} ) Prestada</div>
                <div>( {est.situacion_vivienda === 'pagandola' ? 'X' : ' '} ) Pagándola (${parseFloat(est.monto_pago_mensual || 0).toLocaleString('es-MX')})</div>
                <div>( {est.situacion_vivienda === 'rentada' ? 'X' : ' '} ) Rentada (${parseFloat(est.monto_pago_mensual || 0).toLocaleString('es-MX')})</div>
              </div>
              {est.situacion_vivienda === 'prestada' && (
                <div className="mt-1.5 text-[10px] text-slate-800 bg-sky-50 p-1.5 rounded border border-sky-200 space-y-0.5">
                  <div><strong>Presta la vivienda:</strong> <span className="font-semibold">{est.nombre_quien_presta || 'Familiar'}</span></div>
                  <div><strong>Parentesco:</strong> <span className="font-semibold text-sky-900">{est.parentesco_quien_presta || 'Conocido / Familiar'}</span></div>
                </div>
              )}
              <div className="mt-2 text-[11px]">
                <strong>Tiempo en domicilio:</strong> {est.tiempo_residencia || '3 años'}
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-bold mb-1">Integrantes del Hogar:</div>
              <div className="text-[11px] space-y-1">
                <div>Mayores 18 años: <strong>{est.personas_mayores_18 || '2'}</strong> | Menores 18 años: <strong>{est.personas_menores_18 || '0'}</strong></div>
                <div>Personas que generan ingresos: <strong>{est.personas_generan_ingresos || '1'}</strong></div>
                <div>Personas que estudian: <strong>{est.personas_estudian || '0'}</strong></div>
                <div>Reciben pensión: <strong>{est.recibe_pension ? 'SÍ' : 'NO'}</strong></div>
              </div>
            </div>
          </div>

          {/* Valor estimado de bienes */}
          <div className="border-t border-slate-300 p-3 bg-slate-50 grid grid-cols-3 gap-4 text-xs">
            <div><strong>Valor Estimado Casa:</strong> ${parseFloat(est.valor_estimado_casa || 0).toLocaleString('es-MX')}</div>
            <div><strong>Valor Muebles:</strong> ${parseFloat(est.valor_estimado_muebles || 0).toLocaleString('es-MX')}</div>
            <div><strong>Valor Automóvil:</strong> ${parseFloat(est.valor_estimado_automovil || 0).toLocaleString('es-MX')}</div>
          </div>
        </div>

        {/* Section 3: INFORMACIÓN DE REFERENCIAS / AVALES */}
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <div className="bg-slate-800 text-white px-3 py-1 text-xs font-bold tracking-wider uppercase">
            3. INFORMACIÓN DE REFERENCIAS / {isAval ? 'SOLICITANTE' : 'AVALES'}
          </div>
          <div className="p-3 text-xs space-y-2">
            {data.avales && data.avales.length > 0 ? (
              data.avales.map((av, idx) => {
                const refData = (est.referencias_avales && est.referencias_avales[idx]) || {};
                const parentesco = refData.parentesco || av.parentesco || 'Familiar / Aval';
                const tiempoConocerlo = refData.tiempo_conocerlo || av.tiempo_conocerlo || '5 años';
                const confirmo = refData.confirmo !== undefined ? (refData.confirmo === true || refData.confirmo === 'SI') : true;

                return (
                  <div key={idx} className="p-2.5 border border-slate-200 rounded bg-slate-50 flex items-center justify-between text-[11px]">
                    <div className="space-y-0.5">
                      <div><strong>Nombre:</strong> {av.nombre_completo}</div>
                      <div><strong>Domicilio:</strong> {av.calle} CP {av.codigo_postal}</div>
                      <div className="text-slate-700 pt-0.5">
                        <strong>Parentesco:</strong> <span className="font-semibold text-sky-900">{parentesco}</span> · <strong>Tiempo de conocerlo:</strong> <span className="font-semibold text-sky-900">{tiempoConocerlo}</span>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap pl-4 border-l border-slate-200 ml-2 font-mono">
                      <strong>Confirmó:</strong> SÍ [{confirmo ? 'X' : ' '}] NO [{!confirmo ? 'X' : ' '}]
                    </div>
                  </div>
                );
              })
            ) : est.referencias_avales && est.referencias_avales.length > 0 ? (
              est.referencias_avales.map((ref, idx) => (
                <div key={idx} className="p-2.5 border border-slate-200 rounded bg-slate-50 flex items-center justify-between text-[11px]">
                  <div className="space-y-0.5">
                    <div><strong>Nombre:</strong> {ref.nombre || 'Referencia Personal'}</div>
                    <div><strong>Domicilio:</strong> {ref.domicilio || 'Domicilio registrado'}</div>
                    <div className="text-slate-700 pt-0.5">
                      <strong>Parentesco:</strong> <span className="font-semibold text-sky-900">{ref.parentesco || 'Conocido'}</span> · <strong>Tiempo de conocerlo:</strong> <span className="font-semibold text-sky-900">{ref.tiempo_conocerlo || '3 años'}</span>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap pl-4 border-l border-slate-200 ml-2 font-mono">
                    <strong>Confirmó:</strong> SÍ [{ref.confirmo !== false ? 'X' : ' '}] NO [{ref.confirmo === false ? 'X' : ' '}]
                  </div>
                </div>
              ))
            ) : (
              <div className="p-2.5 border border-slate-200 rounded bg-slate-50 flex items-center justify-between text-[11px]">
                <div className="space-y-0.5">
                  <div><strong>Nombre:</strong> {inv.sujeto_nombre || 'Referencia Registrada'}</div>
                  <div><strong>Domicilio:</strong> {inv.calle || 'Domicilio registrado'} CP {inv.codigo_postal || ''}</div>
                  <div className="text-slate-700 pt-0.5">
                    <strong>Parentesco:</strong> <span className="font-semibold text-sky-900">Familiar / Conocido</span> · <strong>Tiempo de conocerlo:</strong> <span className="font-semibold text-sky-900">5 años</span>
                  </div>
                </div>
                <div className="text-right whitespace-nowrap pl-4 border-l border-slate-200 ml-2 font-mono">
                  <strong>Confirmó:</strong> SÍ [X] NO [ ]
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Section 4: OBSERVACIONES DEL INVESTIGADOR Y DICTAMEN */}
        <div className="border border-slate-800 rounded-lg p-4 space-y-3 bg-slate-50">
          <div className="font-bold text-xs uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
            4. OBSERVACIONES Y DICTAMEN DEL INVESTIGADOR DE CAMPO
          </div>
          <div className="text-xs text-slate-800 min-h-[60px] whitespace-pre-wrap font-mono bg-white p-3 rounded border border-slate-300">
            {ev.notas_investigador || inv.observaciones_sif || 'Sin observaciones adicionales.'}
          </div>

          <div className="flex items-center justify-between pt-2 text-xs font-bold">
            <div className="flex items-center gap-2">
              <span>Dictamen de Campo:</span>
              {(() => {
                const dictText = (est.dictamen || ev.notas_investigador || '').toUpperCase();
                if (dictText.includes('PENDIENTE')) {
                  return <span className="px-3 py-1 rounded bg-amber-600 text-white uppercase text-[11px]">⏳ PENDIENTE DE VISITA</span>;
                } else if (dictText.includes('NO LOCALIZADO')) {
                  return <span className="px-3 py-1 rounded bg-rose-600 text-white uppercase text-[11px]">✕ DOMICILIO NO LOCALIZADO</span>;
                } else {
                  return <span className="px-3 py-1 rounded bg-sky-700 text-white uppercase text-[11px]">✓ DOMICILIO CONFIRMADO</span>;
                }
              })()}
            </div>
            <div>
              Investigador: <span className="font-semibold">{inv.investigador_nombre || 'Asignado'}</span>
            </div>
          </div>
        </div>


        {/* Section 5: EVIDENCIA FOTOGRÁFICA REGISTRADA DESDE LA APP MÓVIL */}
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <div className="bg-slate-800 text-white px-3 py-1 text-xs font-bold tracking-wider uppercase flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> 5. EVIDENCIA FOTOGRÁFICA REGISTRADA EN CAMPO
            </span>
            <span className="text-[10px] font-normal text-slate-300">
              {fotosList.length > 0 ? `${fotosList.length} Fotografía(s)` : 'Sin fotografías'}
            </span>
          </div>
          <div className="p-4 bg-slate-50">
            {fotosList.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {fotosList.map((fotoUri, idx) => (
                  <div key={idx} className="border border-slate-300 rounded-lg bg-white p-2 shadow-sm flex flex-col items-center">
                    <img
                      src={fotoUri}
                      alt={`Evidencia Fotográfica ${idx + 1}`}
                      className="w-full h-36 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-90 transition"
                      onClick={() => {
                        setSelectedFotoIndex(idx);
                        setZoomScale(1);
                        setRotation(0);
                      }}
                    />
                    <span className="text-[10px] font-bold text-slate-600 mt-1.5">Evidencia Foto #{idx + 1}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400 italic text-xs">
                No se capturaron fotografías de evidencia durante esta visita.
              </div>
            )}
          </div>
        </div>

        {/* Signatures & Evidence Footer (3-column layout) */}
        <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs">
          {/* Firma Digital del Entrevistado (Solicitante o Aval) */}
          <div className="flex flex-col items-center justify-between">
            <div className="w-full h-24 flex items-center justify-center border border-dashed border-slate-300 rounded bg-white p-1 mb-2 overflow-hidden shadow-inner">
              {safeFirmaSrc ? (
                <img
                  src={safeFirmaSrc}
                  alt="Firma Digital del Atendido"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-[11px] text-slate-400 italic">Sin firma digital</span>
              )}
            </div>
            <div className="border-b border-slate-800 w-full mb-1"></div>
            <div className="font-bold text-slate-900">
              Firma del Entrevistado ({isAval ? 'Aval' : 'Solicitante'})
            </div>
            <div className="text-[10px] text-slate-500">{inv.sujeto_nombre}</div>
          </div>

          {/* Firma del Investigador */}
          <div className="flex flex-col items-center justify-between">
            <div className="w-full h-24 flex items-center justify-center border border-dashed border-slate-300 rounded bg-white p-1 mb-2 overflow-hidden shadow-inner">
              {safeFirmaInvestigadorSrc ? (
                <img
                  src={safeFirmaInvestigadorSrc}
                  alt="Firma Digital del Investigador"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-[11px] text-slate-400 italic">Sin firma de investigador</span>
              )}
            </div>
            <div className="border-b border-slate-800 w-full mb-1"></div>
            <div className="font-bold text-slate-900">Firma del Investigador</div>
            <div className="text-[10px] text-slate-500">{inv.investigador_nombre || 'Depto. Investigaciones'}</div>
          </div>

          {/* Firma del Encargado / Supervisor */}
          <div className="flex flex-col items-center justify-end">
            <div className="h-24"></div>
            <div className="border-b border-slate-800 w-full mb-1"></div>
            <div className="font-bold text-slate-900">Firma Encargado / Supervisor</div>
            <div className="text-[10px] text-slate-500">Caja Oblatos CPO</div>
          </div>
        </div>

      </div>

      {/* Lightbox HD Modal para evidencias fotográficas */}
      {selectedFotoIndex !== null && fotosList[selectedFotoIndex] && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-between p-4 no-print select-none"
          onClick={() => setSelectedFotoIndex(null)}
        >
          {/* Header Bar */}
          <div className="w-full max-w-4xl flex items-center justify-between text-white z-10 p-2" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs font-semibold tracking-wide flex items-center gap-2">
              <Camera className="w-4 h-4 text-sky-400" />
              <span>Evidencia Fotográfica #{selectedFotoIndex + 1} de {fotosList.length}</span>
            </div>
            
            {/* Controles de Transformación */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/60 p-1.5 rounded-xl">
              <button
                onClick={() => setZoomScale((z) => Math.max(0.8, z - 0.25))}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
                title="Alejar Zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono w-10 text-center font-bold text-sky-400">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                onClick={() => setZoomScale((z) => Math.min(3, z + 0.25))}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
                title="Acercar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-slate-700 mx-1"></div>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
                title="Rotar 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-slate-700 mx-1"></div>
              <a
                href={fotosList[selectedFotoIndex]}
                download={`evidencia_investigacion_${inv.id_sif_research}_${selectedFotoIndex + 1}.jpg`}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition flex items-center gap-1"
                title="Descargar imagen"
              >
                <Download className="w-4 h-4 text-emerald-400" />
              </a>
            </div>

            <button
              onClick={() => setSelectedFotoIndex(null)}
              className="p-2 bg-rose-600/80 hover:bg-rose-500 text-white rounded-xl transition"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Image Container */}
          <div
            className="flex-1 flex items-center justify-center relative w-full max-w-5xl overflow-hidden my-2"
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
                className="absolute left-4 z-20 p-3 bg-slate-900/80 border border-slate-700 hover:bg-sky-600 text-white rounded-2xl transition shadow-xl"
                title="Fotografía Anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Image Canvas with Scale & Rotate */}
            <div className="overflow-auto max-h-full max-w-full flex items-center justify-center p-4">
              <img
                src={fotosList[selectedFotoIndex]}
                alt={`Evidencia ${selectedFotoIndex + 1}`}
                style={{
                  transform: `scale(${zoomScale}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-out',
                }}
                className="max-h-[75vh] max-w-[85vw] object-contain rounded-xl shadow-2xl border border-slate-800"
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
                className="absolute right-4 z-20 p-3 bg-slate-900/80 border border-slate-700 hover:bg-sky-600 text-white rounded-2xl transition shadow-xl"
                title="Fotografía Siguiente"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400 pb-2">
            Tip: Usa los controles superiores para ajustar el zoom o rotar la fotografía
          </div>
        </div>
      )}
    </div>
  );
}

