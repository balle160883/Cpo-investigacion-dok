import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchInvestigacionDetalle, validarInvestigacion, revalidarInvestigacion, guardarComentariosValidador, solventarFolioInvestigacion, subirComprobanteFolio } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Printer, ChevronLeft, CheckSquare, Square, Camera, ZoomIn, ZoomOut, RotateCw, Download, 
  ChevronRight, X, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Edit3, MessageSquareText, FileCheck, Sparkles,
  Clock, Calendar, FileText, Upload, Paperclip, MapPin, Navigation, ExternalLink
} from 'lucide-react';
import Toast from '../components/Toast';
import { formatNombreSucursal, esAval, getEtiquetaSujeto, getEtiquetaSujetoUpper, getBadgeSujetoProps, formatFechaHoraCaptura } from '../utils/formatters';

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
  const [showValidarModal, setShowValidarModal] = useState(false);
  const [comentariosValidar, setComentariosValidar] = useState('Estudio socioeconómico verificado favorablemente. Domicilio e ingresos comprobados.');
  const [showRechazoModal, setShowRechazoModal] = useState(false);
  const [comentariosRechazo, setComentariosRechazo] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'success' });

  // Edición directa de comentarios del Validador
  const [showEditarComentariosModal, setShowEditarComentariosModal] = useState(false);
  const [comentariosEdicion, setComentariosEdicion] = useState('');
  const [savingComentarios, setSavingComentarios] = useState(false);

  // Estado para Solventar Folio y Editar Formato por el Validador
  const [showSolventarModal, setShowSolventarModal] = useState(false);
  const [activeSolventarTab, setActiveSolventarTab] = useState('atencion');
  const [solventando, setSolventando] = useState(false);
  const [comprobanteFile, setComprobanteFile] = useState(null);
  const [formSolventar, setFormSolventar] = useState({
    // 1. Atención e Identificación
    quien_atendio: 'titular',
    nombre_atendio: '',
    parentesco_atendio: '',
    vive_con_solicitante: true,
    presento_identificacion: true,
    tipo_identificacion: 'INE',
    folio_identificacion: '',
    ocupacion: '',
    ocupacion_conyuge: '',
    telefono_visitado: '',
    casa_color: '',
    puerta_cancel_color: '',
    numero_niveles: '1',

    // 2. Dirección confirmada en campo
    tiene_direccion_diferente: false,
    calle_real: '',
    colonia_real: '',
    referencias_domicilio: '',

    // 3. Estatus Socioeconómico y Vivienda
    estado_civil: 'soltero',
    situacion_vivienda: 'propia',
    monto_pago_mensual: 0,
    nombre_quien_presta: '',
    parentesco_quien_presta: '',
    tiempo_residencia: '3 años',
    personas_mayores_18: 2,
    personas_menores_18: 0,
    personas_generan_ingresos: 1,
    personas_estudian: 0,
    recibe_pension: false,
    personas_reciben_pension: 0,
    tipo_pension: '',
    valor_estimado_casa: 0,
    valor_estimado_muebles: 0,
    tiene_vehiculo: false,
    valor_estimado_automovil: 0,
    detalles_vehiculo: '',

    // 4. Referencias y Avales
    referencias_avales: [],

    // 5. Dictamen y Observaciones
    dictamen: 'DOMICILIO CONFIRMADO',
    notas_investigador: '',
    justificacion_folio: '',
    comprobante_url: '',
  });

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

  const isAnalista = userRole.includes('analista') || userRole.includes('gerente_analistas');
  const isOnlyAnalyst = isAnalista && !['superadmin', 'admin'].some(r => userRole.includes(r));
  // Permitir validar solo a superadmin, admin y validador
  const canValidate = !userRole || (!isOnlyAnalyst && ['superadmin', 'admin', 'validador', 'asignador'].some(r => userRole.includes(r)));
  // El analista (o admin/superadmin) siempre puede revalidar o devolver
  const canRevalidar = isAnalista || ['superadmin', 'admin', 'gerente_analistas'].some(r => userRole.includes(r));

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
  const latCheckin = ev.latitud_checkin !== undefined && ev.latitud_checkin !== null ? Number(ev.latitud_checkin) : null;
  const lngCheckin = ev.longitud_checkin !== undefined && ev.longitud_checkin !== null ? Number(ev.longitud_checkin) : null;
  const esFakeGps = latCheckin !== null && lngCheckin !== null && Math.abs(latCheckin - 20.6597) < 0.0001 && Math.abs(lngCheckin - (-103.3496)) < 0.0001;
  const tieneGpsValido = latCheckin !== null && lngCheckin !== null && latCheckin !== 0 && lngCheckin !== 0 && !esFakeGps;

  const isAval = esAval(inv);
  const badgeProps = getBadgeSujetoProps(inv);

  const paquete = data.paqueteInvestigaciones || [];
  const totalVisitas = paquete.length;
  const completadasVisitas = paquete.filter(p => ['COMPLETADA', 'VALIDADA', 'APROBADA_FINAL'].includes(p.estado)).length;
  const isPaqueteCompleto = totalVisitas <= 1 || completadasVisitas === totalVisitas;

  const plantillasDictamen = [
    'Estudio socioeconómico verificado y validado en campo.',
    'Se corroboró arraigo vecinal y solvencia económica favorable.',
    'Domicilio confirmado con geolocalización y referencias positivas.',
    'Aval solvente y con capacidad de respaldo acreditada.',
    'Validado con visto bueno para autorización de crédito.'
  ];

  const plantillasInconsistenciaAnalista = [
    'Inconsistencia en ingresos vs egresos declarados.',
    'Documentación o firmas incompletas en el expediente.',
    'Discrepancia en domicilio o fotografía no coincide con el predio.',
    'Datos del aval no coinciden con la solicitud de crédito.',
    'Se requiere visita complementaria o aclaración de referencias.'
  ];

  function agregarPlantillaValidar(texto) {
    setComentariosValidar((prev) => {
      const limpio = (prev || '').trim();
      if (!limpio) return texto;
      if (limpio.endsWith('.')) return `${limpio} ${texto}`;
      return `${limpio}. ${texto}`;
    });
  }

  function agregarPlantillaDevolucion(texto) {
    setComentariosDevolucion((prev) => {
      const limpio = (prev || '').trim();
      if (!limpio) return texto;
      if (limpio.endsWith('.')) return `${limpio} ${texto}`;
      return `${limpio}. ${texto}`;
    });
  }

  function agregarPlantillaEdicion(texto) {
    setComentariosEdicion((prev) => {
      const limpio = (prev || '').trim();
      if (!limpio) return texto;
      if (limpio.endsWith('.')) return `${limpio} ${texto}`;
      return `${limpio}. ${texto}`;
    });
  }

  async function handleGuardarComentariosEdicion() {
    if (!comentariosEdicion.trim()) return;
    setSavingComentarios(true);
    try {
      await guardarComentariosValidador(id, { comentarios: comentariosEdicion.trim() });
      setToast({ message: 'Observaciones del validador actualizadas con éxito', type: 'success' });
      setShowEditarComentariosModal(false);
      await loadData();
    } catch (err) {
      setToast({ message: 'Error guardando observaciones: ' + err.message, type: 'error' });
    } finally {
      setSavingComentarios(false);
    }
  }

  const dictamenCampo = (est.dictamen || ev.notas_investigador || '').toUpperCase();
  const supuestoCampo = (est.supuesto || ev.supuesto || (ev.estudio_socioeconomico && ev.estudio_socioeconomico.supuesto) || '').toUpperCase();
  const obsTexto = (inv.observaciones_sif || '').toUpperCase();
  const notasTexto = (ev.notas_investigador || '').toUpperCase();
  const yaSolventado = Boolean(inv.folio_solventado || est.folio_solventado);
  const esConFolio = (
    supuestoCampo.includes('FOLIO') || 
    obsTexto.includes('FOLIO') || 
    notasTexto.includes('FOLIO') || 
    dictamenCampo.includes('PENDIENTE') ||
    inv.estado === 'REAGENDADA' || 
    yaSolventado
  );
  const puedeSolventarFolio = canValidate && (esConFolio || inv.estado === 'REAGENDADA' || yaSolventado);

  function handleActualizarReferencia(index, campo, valor) {
    setFormSolventar(prev => {
      const refs = [...(prev.referencias_avales || [])];
      refs[index] = { ...refs[index], [campo]: valor };
      return { ...prev, referencias_avales: refs };
    });
  }

  function handleAgregarReferencia() {
    setFormSolventar(prev => ({
      ...prev,
      referencias_avales: [
        ...(prev.referencias_avales || []),
        { nombre: '', domicilio: '', parentesco: '', tiempo_conocerlo: '', confirmo: true }
      ]
    }));
  }

  function handleEliminarReferencia(index) {
    setFormSolventar(prev => ({
      ...prev,
      referencias_avales: (prev.referencias_avales || []).filter((_, i) => i !== index)
    }));
  }

  function abrirModalSolventar() {
    let initialReferencias = [];
    if (Array.isArray(est.referencias_avales) && est.referencias_avales.length > 0) {
      initialReferencias = est.referencias_avales.map(r => ({
        nombre: r.nombre || '',
        domicilio: r.domicilio || '',
        parentesco: r.parentesco || '',
        tiempo_conocerlo: r.tiempo_conocerlo || '',
        confirmo: r.confirmo !== false,
      }));
    } else if (Array.isArray(data?.avales) && data.avales.length > 0) {
      initialReferencias = data.avales.map(av => ({
        nombre: av.nombre_completo || '',
        domicilio: `${av.calle || ''} ${av.codigo_postal ? `CP ${av.codigo_postal}` : ''}`.trim(),
        parentesco: av.parentesco || 'Familiar / Aval',
        tiempo_conocerlo: av.tiempo_conocerlo || '5 años',
        confirmo: true,
      }));
    } else {
      initialReferencias = [{
        nombre: inv.sujeto_nombre || 'Referencia Personal',
        domicilio: inv.calle || '',
        parentesco: 'Conocido',
        tiempo_conocerlo: '3 años',
        confirmo: true,
      }];
    }

    setFormSolventar({
      quien_atendio: est.quien_atendio || 'titular',
      nombre_atendio: est.nombre_atendio || '',
      parentesco_atendio: est.parentesco_atendio || '',
      vive_con_solicitante: est.vive_con_solicitante !== false,
      presento_identificacion: est.presento_identificacion !== false,
      tipo_identificacion: est.tipo_identificacion || 'INE',
      folio_identificacion: est.folio_identificacion || '',
      ocupacion: est.ocupacion || '',
      ocupacion_conyuge: est.ocupacion_conyuge || '',
      telefono_visitado: est.telefono_visitado || inv.telefono_principal || inv.telefono || '',
      casa_color: est.casa_color || '',
      puerta_cancel_color: est.puerta_cancel_color || '',
      numero_niveles: est.numero_niveles || '1',

      tiene_direccion_diferente: Boolean(est.tiene_direccion_diferente),
      calle_real: est.calle_real || '',
      colonia_real: est.colonia_real || '',
      referencias_domicilio: est.referencias_domicilio || '',

      estado_civil: est.estado_civil || 'soltero',
      situacion_vivienda: est.situacion_vivienda || 'propia',
      monto_pago_mensual: est.monto_pago_mensual || 0,
      nombre_quien_presta: est.nombre_quien_presta || '',
      parentesco_quien_presta: est.parentesco_quien_presta || '',
      tiempo_residencia: est.tiempo_residencia || '3 años',
      personas_mayores_18: est.personas_mayores_18 !== undefined ? est.personas_mayores_18 : 2,
      personas_menores_18: est.personas_menores_18 !== undefined ? est.personas_menores_18 : 0,
      personas_generan_ingresos: est.personas_generan_ingresos !== undefined ? est.personas_generan_ingresos : 1,
      personas_estudian: est.personas_estudian !== undefined ? est.personas_estudian : 0,
      recibe_pension: Boolean(est.recibe_pension),
      personas_reciben_pension: est.personas_reciben_pension || 0,
      tipo_pension: est.tipo_pension || '',
      valor_estimado_casa: est.valor_estimado_casa || 0,
      valor_estimado_muebles: est.valor_estimado_muebles || 0,
      tiene_vehiculo: Boolean(est.tiene_vehiculo),
      valor_estimado_automovil: est.valor_estimado_automovil || 0,
      detalles_vehiculo: est.detalles_vehiculo || '',

      referencias_avales: initialReferencias,

      dictamen: 'DOMICILIO CONFIRMADO',
      notas_investigador: ev.notas_investigador || inv.observaciones_sif || '',
      justificacion_folio: inv.justificacion_folio || est.justificacion_folio || '',
      comprobante_url: inv.comprobante_folio_url || est.comprobante_url || '',
    });
    setComprobanteFile(null);
    setActiveSolventarTab('atencion');
    setShowSolventarModal(true);
  }

  async function handleEjecutarSolventacion(validarInmediato = false) {
    if (!formSolventar.justificacion_folio.trim()) {
      setToast({ message: 'La justificación de solventación de folio es obligatoria', type: 'warning' });
      setActiveSolventarTab('dictamen');
      return;
    }

    setSolventando(true);
    try {
      let comprobanteUrlFinal = formSolventar.comprobante_url;

      // Si subió un archivo nuevo, cargarlo al servidor primero
      if (comprobanteFile) {
        const upRes = await subirComprobanteFolio(id, comprobanteFile);
        if (upRes && upRes.archivo_url) {
          comprobanteUrlFinal = upRes.archivo_url;
        }
      }

      const payload = {
        estudio_socioeconomico: {
          quien_atendio: formSolventar.quien_atendio,
          nombre_atendio: formSolventar.nombre_atendio,
          parentesco_atendio: formSolventar.parentesco_atendio,
          vive_con_solicitante: formSolventar.vive_con_solicitante,
          presento_identificacion: formSolventar.presento_identificacion,
          tipo_identificacion: formSolventar.tipo_identificacion,
          folio_identificacion: formSolventar.folio_identificacion,
          ocupacion: formSolventar.ocupacion,
          ocupacion_conyuge: formSolventar.ocupacion_conyuge,
          telefono_visitado: formSolventar.telefono_visitado,
          casa_color: formSolventar.casa_color,
          puerta_cancel_color: formSolventar.puerta_cancel_color,
          numero_niveles: formSolventar.numero_niveles,

          tiene_direccion_diferente: formSolventar.tiene_direccion_diferente,
          calle_real: formSolventar.calle_real,
          colonia_real: formSolventar.colonia_real,
          referencias_domicilio: formSolventar.referencias_domicilio,

          estado_civil: formSolventar.estado_civil,
          situacion_vivienda: formSolventar.situacion_vivienda,
          monto_pago_mensual: parseFloat(formSolventar.monto_pago_mensual || 0),
          nombre_quien_presta: formSolventar.nombre_quien_presta,
          parentesco_quien_presta: formSolventar.parentesco_quien_presta,
          tiempo_residencia: formSolventar.tiempo_residencia,
          personas_mayores_18: parseInt(formSolventar.personas_mayores_18 || 0),
          personas_menores_18: parseInt(formSolventar.personas_menores_18 || 0),
          personas_generan_ingresos: parseInt(formSolventar.personas_generan_ingresos || 0),
          personas_estudian: parseInt(formSolventar.personas_estudian || 0),
          recibe_pension: formSolventar.recibe_pension,
          personas_reciben_pension: parseInt(formSolventar.personas_reciben_pension || 0),
          tipo_pension: formSolventar.tipo_pension,
          valor_estimado_casa: parseFloat(formSolventar.valor_estimado_casa || 0),
          valor_estimado_muebles: parseFloat(formSolventar.valor_estimado_muebles || 0),
          tiene_vehiculo: formSolventar.tiene_vehiculo,
          valor_estimado_automovil: parseFloat(formSolventar.valor_estimado_automovil || 0),
          detalles_vehiculo: formSolventar.detalles_vehiculo,

          referencias_avales: formSolventar.referencias_avales || [],
        },
        dictamen: formSolventar.dictamen,
        notas_investigador: formSolventar.notas_investigador,
        justificacion_folio: formSolventar.justificacion_folio.trim(),
        comprobante_url: comprobanteUrlFinal,
        validar_inmediato: validarInmediato,
        comentarios_validacion: validarInmediato ? `Validado tras solventación de folio: ${formSolventar.justificacion_folio.trim()}` : '',
      };

      const res = await solventarFolioInvestigacion(id, payload);
      setToast({
        message: res.message || 'Folio solventado y formato actualizado con éxito',
        type: 'success',
      });
      setShowSolventarModal(false);
      await loadData();

      if (validarInmediato) {
        setTimeout(() => {
          navigate('/investigaciones');
        }, 1500);
      }
    } catch (err) {
      setToast({ message: 'Error al solventar folio: ' + err.message, type: 'error' });
    } finally {
      setSolventando(false);
    }
  }

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
        <div className={clsx('flex', 'items-center', 'gap-2.5', 'flex-wrap')}>
          {canRevalidar && (
            <div className="flex items-center gap-2 mr-2">
              <button
                onClick={() => handleEjecutarRevalidacion('APROBAR_FINAL', 'Investigación aprobada definitivamente por el Analista.')}
                disabled={revalidating || inv.estado === 'APROBADA_FINAL'}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-teal-600/30"
                title="Aprobar definitivamente esta investigación"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> {inv.estado === 'APROBADA_FINAL' ? 'Aprobada' : 'Aprobar Final'}
              </button>
              <button
                onClick={() => setShowDevolucionModal(true)}
                disabled={revalidating}
                className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-orange-600/30"
                title="Devolver al validador por inconsistencias"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Devolver al Validador
              </button>
            </div>
          )}
          <span className={clsx('text-xs', 'text-slate-400', 'flex', 'items-center', 'gap-1.5')}>
            Formato: <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeProps.badgeClass}`}>{badgeProps.fullLabel}</span>
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
              📦 Expediente Completo del Crédito — Folio: {inv.solicitud_folio || `#${inv.solicitud_id_sif}`} • 🏢 Suc. {formatNombreSucursal(inv.sucursal_id, inv.sucursal_nombre)}
            </span>
            <span className={clsx('text-[11px]', 'font-mono', 'text-slate-400')}>
              {data.paqueteInvestigaciones.filter(p => p.estado === 'COMPLETADA').length} de {data.paqueteInvestigaciones.length} Visitas Completadas en Campo
            </span>
          </div>
          <div className={clsx('flex', 'flex-wrap', 'gap-2', 'pt-1')}>
            {data.paqueteInvestigaciones.map((p) => {
              const isCurrent = String(p.id_sif_research) === String(id);
              const pBadge = getBadgeSujetoProps(p);
              return (
                <Link
                  key={p.id_sif_research}
                  to={`/investigaciones/${p.id_sif_research}`}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${isCurrent
                      ? 'bg-sky-600 border-sky-400 text-white shadow-md shadow-sky-600/30'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                >
                  <span className={isCurrent ? 'text-white' : pBadge.textClass}>
                    {pBadge.icon} {pBadge.label}:
                  </span>
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
                <CheckCircle2 className={clsx('w-4', 'h-4')} /> VALIDADO POR VALIDADOR DE CRÉDITO
              </span>
            ) : inv.estado === 'RECHAZADA' ? (
              <span className={clsx('px-3', 'py-1', 'rounded-full', 'bg-rose-500/20', 'text-rose-400', 'border', 'border-rose-500/40', 'text-xs', 'font-bold', 'flex', 'items-center', 'gap-1.5')}>
                <XCircle className={clsx('w-4', 'h-4')} /> RECHAZADO / CORRECCIÓN SOLICITADA
              </span>
            ) : inv.estado === 'REAGENDADA' ? (
              <span className={clsx('px-3', 'py-1', 'rounded-full', 'bg-purple-500/20', 'text-purple-300', 'border', 'border-purple-500/40', 'text-xs', 'font-bold', 'flex', 'items-center', 'gap-1.5')}>
                <Clock className={clsx('w-4', 'h-4')} /> 🔄 REAGENDADA POR CITA / FOLIO
              </span>
            ) : (
              <span className={clsx('px-3', 'py-1', 'rounded-full', 'bg-amber-500/20', 'text-amber-400', 'border', 'border-amber-500/40', 'text-xs', 'font-bold', 'flex', 'items-center', 'gap-1.5')}>
                <AlertTriangle className={clsx('w-4', 'h-4')} /> PENDIENTE DE VALIDACIÓN
              </span>
            )}
          </div>

          {/* Botones VALIDADOR: Aprobar o Rechazar el estudio del investigador */}
          {canValidate && (
            <div className={clsx('flex', 'items-center', 'gap-2', 'flex-wrap')}>
              {puedeSolventarFolio && !['VALIDADA', 'APROBADA_FINAL'].includes(inv.estado) && (
                <button
                  type="button"
                  onClick={abrirModalSolventar}
                  className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-purple-600', 'hover:bg-purple-500', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-1.5', 'shadow-lg', 'shadow-purple-600/30')}
                >
                  <Edit3 className={clsx('w-4', 'h-4')} /> 📝 Solventar Folio y Editar Formato
                </button>
              )}

              {inv.estado === 'REAGENDADA' ? (
                <div className={clsx('px-3', 'py-1.5', 'rounded-xl', 'bg-purple-500/10', 'border', 'border-purple-500/30', 'text-purple-300', 'text-xs', 'flex', 'items-center', 'gap-1.5')}>
                  <Clock className={clsx('w-4', 'h-4', 'text-purple-400', 'flex-shrink-0')} />
                  <span>
                    Visita con Cita/Folio: En espera de reasignación o solventación por el Validador.
                  </span>
                </div>
              ) : !isPaqueteCompleto ? (
                <div className={clsx('px-3', 'py-1.5', 'rounded-xl', 'bg-amber-500/10', 'border', 'border-amber-500/30', 'text-amber-300', 'text-xs', 'flex', 'items-center', 'gap-1.5')}>
                  <AlertTriangle className={clsx('w-4', 'h-4', 'text-amber-400', 'flex-shrink-0')} />
                  <span>
                    Visitas pendientes ({completadasVisitas}/{totalVisitas}): El botón de validación se activará cuando todas las investigaciones (titular y avales) estén completadas.
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => setShowValidarModal(true)}
                  disabled={validating || ['VALIDADA', 'APROBADA_FINAL', 'REAGENDADA'].includes(inv.estado)}
                  className={clsx('px-4', 'py-2', 'rounded-xl', inv.estado === 'DEVUELTA_A_VALIDADOR' ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/30' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30', 'disabled:opacity-50', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-1.5', 'shadow-lg')}
                >
                  <CheckCircle2 className={clsx('w-4', 'h-4')} /> {validating ? 'Procesando...' : inv.estado === 'DEVUELTA_A_VALIDADOR' ? '🔄 Re-Validar tras Corrección' : '✅ Validar con Dictamen'}
                </button>
              )}

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

        {/* BANNER INFORMATIVO PARA EL VALIDADOR CUANDO ESTÁ REAGENDADA */}
        {inv.estado === 'REAGENDADA' && (
          <div className="p-4 rounded-2xl bg-purple-950/60 border border-purple-500/50 text-purple-200 text-xs space-y-3 shadow-lg">
            <div className="font-bold flex items-center justify-between gap-2 text-purple-300 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                <span>ℹ️ Información de Campo para el Validador: Visita con Ticket de Cita / Folio</span>
              </div>
              {canValidate && (
                <button
                  type="button"
                  onClick={abrirModalSolventar}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-900/50"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Solventar y Editar Formato
                </button>
              )}
            </div>
            <div className="bg-slate-950/90 p-3 rounded-xl border border-purple-900/60 text-purple-100 text-xs leading-relaxed space-y-1">
              <div>
                El investigador de campo acudió a este domicilio y registró una visita preliminar con ticket de folio/cita. Si el socio acudió a sucursal o aportó la documentación faltante, el <strong>Validador de Crédito</strong> puede solventar el folio, editar el formato y validarlo para enviarlo al Analista sin requerir una segunda visita de campo.
              </div>
              {inv.observaciones_sif && (
                <div className="mt-1 text-slate-300 font-mono text-[11px] bg-slate-900 p-2 rounded border border-slate-800">
                  📌 Detalle registrado en campo: "{inv.observaciones_sif}"
                </div>
              )}
            </div>
            <p className="text-[11px] text-purple-300">
              💡 Presiona <strong>"Solventar y Editar Formato"</strong> para ingresar los datos, justificar la solventación y cambiar el dictamen a Confirmado.
            </p>
          </div>
        )}

        {/* BANNER FOLIO SOLVENTADO EN GABINETE */}
        {yaSolventado && (
          <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs space-y-2 shadow-lg">
            <div className="font-bold flex items-center justify-between gap-2 text-emerald-300 text-sm">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>✅ Folio Solventado en Gabinete por el Validador de Crédito</span>
              </span>
              {canValidate && !['VALIDADA', 'APROBADA_FINAL'].includes(inv.estado) && (
                <button
                  type="button"
                  onClick={abrirModalSolventar}
                  className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1 font-semibold text-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Re-editar Datos Solventados
                </button>
              )}
            </div>
            <div className="bg-slate-950/90 p-3 rounded-xl border border-emerald-900/60 text-emerald-100 text-xs leading-relaxed space-y-1">
              <div>
                <strong>Justificación de solventación:</strong> {inv.justificacion_folio || est.justificacion_folio || 'Folio debidamente subsanado en gabinete.'}
              </div>
              {(inv.comprobante_folio_url || est.comprobante_url) && (
                <div className="pt-1">
                  <a
                    href={inv.comprobante_folio_url || est.comprobante_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline font-semibold inline-flex items-center gap-1"
                  >
                    📎 Ver Documento / Comprobante de Respaldo Adjunto
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AVISO DE INCONSISTENCIA REPORTADA POR EL ANALISTA */}
        {inv.estado === 'DEVUELTA_A_VALIDADOR' && (
          <div className="p-4 rounded-2xl bg-orange-950/60 border border-orange-500/50 text-orange-200 text-xs space-y-2 shadow-lg">
            <div className="font-bold flex items-center gap-2 text-orange-400 text-sm">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <span>⚠️ Inconsistencia Reportada por el Analista ({inv.analista_nombre || 'Analista'}):</span>
            </div>
            <div className="font-mono bg-slate-950/90 p-3 rounded-xl border border-orange-900/60 text-orange-100 text-xs leading-relaxed">
              "{inv.comentarios_revalidacion || 'Se reportaron inconsistencias que requieren revisión y corrección.'}"
            </div>
            <p className="text-[11px] text-orange-300">
              💡 Por favor revisa los datos y evidencias del estudio, haz los ajustes u observaciones necesarias y presiona el botón <strong>"Re-Validar tras Corrección"</strong> para reenviar el expediente al Analista.
            </p>
          </div>
        )}

        {/* TARJETA DESTACADA: DICTAMEN Y OBSERVACIONES DEL VALIDADOR DE CRÉDITO (Visible para Analista y Validador) */}
        {(inv.validador_nombre || inv.comentarios_validacion || ['VALIDADA', 'APROBADA_FINAL', 'DEVUELTA_A_VALIDADOR'].includes(inv.estado)) && (
          <div className={clsx('bg-gradient-to-r', 'from-teal-950/60', 'via-slate-900', 'to-slate-950', 'border', 'border-teal-500/30', 'p-4', 'rounded-2xl', 'space-y-3', 'shadow-xl')}>
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-teal-500/20 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40">
                  <FileCheck className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider">
                    Paso 1 — Dictamen y Observaciones del Validador de Crédito
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Revisión previa para el análisis y dictamen final de crédito
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canValidate && (
                  <button
                    onClick={() => {
                      setComentariosEdicion(inv.comentarios_validacion || '');
                      setShowEditarComentariosModal(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                    title="Editar o agregar notas al dictamen"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Editar Observaciones
                  </button>
                )}
                <span className="text-[11px] font-mono text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                  📅 {formatFechaCorta(inv.fecha_validacion)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Validador de Crédito:</div>
                <div className="text-sm font-bold text-teal-300 mt-0.5 flex items-center gap-1.5">
                  <span>✅</span>
                  <span>{inv.validador_nombre || 'Validador Autorizado'}</span>
                </div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 md:col-span-2">
                <div className="text-[10px] text-teal-400 uppercase font-semibold mb-1">
                  Observaciones para el Analista:
                </div>
                <div className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                  {inv.comentarios_validacion ? (
                    <p className="whitespace-pre-line text-teal-100 font-medium">
                      "{inv.comentarios_validacion}"
                    </p>
                  ) : (
                    <p className="text-slate-400 italic">
                      Estudio validado sin observaciones adicionales.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL DE REVALIDACIÓN Y DEVOLUCIÓN DEL ANALISTA — Visible siempre para el Analista */}
        {canRevalidar && (
          <div className={clsx('border', 'border-teal-700/50', 'bg-teal-950/40', 'rounded-2xl', 'p-5', 'space-y-4', 'shadow-xl')}>
            <div className={clsx('flex', 'items-center', 'justify-between', 'flex-wrap', 'gap-2', 'border-b', 'border-teal-500/20', 'pb-3')}>
              <div className={clsx('flex', 'items-center', 'gap-2', 'text-teal-300', 'text-sm', 'font-bold', 'uppercase', 'tracking-wider')}>
                <ShieldCheck className={clsx('w-5', 'h-5')} />
                Paso 2 — Panel de Dictamen y Control del Analista de Crédito
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold">
                👤 {auth?.user?.nombre || 'Analista'}
              </span>
            </div>
            <p className={clsx('text-xs', 'text-slate-300')}>
              Como analista de crédito, revisa la información socioeconómica y domiciliaria reportada. Si todo es correcto, emite la <strong>Aprobación Final</strong>; o bien, si encuentras anomalías o falta de datos, <strong>Devuélvelo al Validador</strong> indicando las observaciones e inconsistencias.
            </p>
            <div className={clsx('flex', 'items-center', 'gap-3', 'flex-wrap')}>
              <button
                onClick={() => handleEjecutarRevalidacion('APROBAR_FINAL', 'Investigación aprobada definitivamente por el Analista.')}
                disabled={revalidating || inv.estado === 'APROBADA_FINAL'}
                className={clsx('px-5', 'py-2.5', 'rounded-xl', 'bg-teal-600', 'hover:bg-teal-500', 'disabled:opacity-50', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-2', 'shadow-lg', 'shadow-teal-600/30')}
              >
                <CheckCircle2 className={clsx('w-4', 'h-4')} />
                {revalidating ? 'Procesando...' : inv.estado === 'APROBADA_FINAL' ? '✅ Ya Aprobada Definitivamente' : '✅ Aprobar Definitivamente'}
              </button>
              <button
                onClick={() => setShowDevolucionModal(true)}
                disabled={revalidating}
                className={clsx('px-5', 'py-2.5', 'rounded-xl', 'bg-orange-600', 'hover:bg-orange-500', 'disabled:opacity-50', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-2', 'shadow-lg', 'shadow-orange-600/30')}
              >
                <AlertTriangle className={clsx('w-4', 'h-4')} />
                🔄 Devolver al Validador por Inconsistencia
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

      {/* MODAL PARA SOLVENTAR FOLIO Y EDITAR TODOS LOS CAMPOS DEL FORMATO SOCIOECONÓMICO */}
      {showSolventarModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="p-4 md:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    <Edit3 className="w-5 h-5" />
                  </span>
                  <h3 className="text-base md:text-lg font-bold text-white">
                    Editar Formato Socioeconómico y Solventar Folio
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold">
                    SIF #{inv.id_sif_research}
                  </span>
                </div>
                <p className="text-[11px] md:text-xs text-slate-400">
                  Edición integral de todos los campos del formato subsanados en sucursal o gabinete. Las fotografías de campo permanecen inmutables.
                </p>
              </div>
              <button
                onClick={() => setShowSolventarModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de pestañas de navegación rápida */}
            <div className="flex border-b border-slate-800 bg-slate-950/50 px-4 pt-2 gap-1.5 overflow-x-auto shrink-0 scrollbar-thin">
              {[
                { id: 'atencion', label: '1. Atención e Identificación', icon: '📋' },
                { id: 'direccion', label: '2. Dirección Real', icon: '📍' },
                { id: 'socioeconomico', label: '3. Socioeconómico y Bienes', icon: '🏠' },
                { id: 'referencias', label: `4. Referencias (${(formSolventar.referencias_avales || []).length})`, icon: '👥' },
                { id: 'dictamen', label: '5. Dictamen y Folio', icon: '⚖️' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSolventarTab(tab.id)}
                  className={clsx(
                    'px-3.5 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5',
                    activeSolventarTab === tab.id
                      ? 'border-purple-500 text-purple-300 bg-purple-500/10 rounded-t-lg'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  )}
                >
                  <span>{tab.icon}</span> {tab.label}
                </button>
              ))}
            </div>

            {/* Contenido de pestañas scrollable */}
            <div className="p-5 md:p-6 overflow-y-auto space-y-5 text-xs text-slate-200 flex-1">
              
              {/* PESTAÑA 1: ATENCIÓN E IDENTIFICACIÓN */}
              {activeSolventarTab === 'atencion' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-800 pb-2">
                    <h4 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                      <span>📋</span> 1. ATENCIÓN Y VERIFICACIÓN EN DOMICILIO
                    </h4>
                    <p className="text-[11px] text-slate-400">Datos de la persona que atendió la entrevista y cotejo de identidad.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Quién Atendió:</label>
                      <select
                        value={formSolventar.quien_atendio}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, quien_atendio: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="titular">Titular / Solicitante</option>
                        <option value="familiar">Familiar</option>
                        <option value="tercero">Tercero / Vecino</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Nombre de quien atendió:</label>
                      <input
                        type="text"
                        value={formSolventar.nombre_atendio}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, nombre_atendio: e.target.value }))}
                        placeholder="Nombre completo..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Parentesco:</label>
                      <input
                        type="text"
                        value={formSolventar.parentesco_atendio}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, parentesco_atendio: e.target.value }))}
                        placeholder="Ej. Esposa, Madre, Hermano..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">¿Vive con el solicitante?:</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormSolventar(prev => ({ ...prev, vive_con_solicitante: true }))}
                          className={clsx('flex-1 py-2 rounded-xl font-bold border transition text-xs', formSolventar.vive_con_solicitante ? 'bg-sky-600 text-white border-sky-400' : 'bg-slate-950 text-slate-400 border-slate-800')}
                        >
                          SÍ
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormSolventar(prev => ({ ...prev, vive_con_solicitante: false }))}
                          className={clsx('flex-1 py-2 rounded-xl font-bold border transition text-xs', !formSolventar.vive_con_solicitante ? 'bg-rose-600 text-white border-rose-400' : 'bg-slate-950 text-slate-400 border-slate-800')}
                        >
                          NO
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">¿Presentó Identificación?:</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormSolventar(prev => ({ ...prev, presento_identificacion: true }))}
                          className={clsx('flex-1 py-2 rounded-xl font-bold border transition text-xs', formSolventar.presento_identificacion ? 'bg-sky-600 text-white border-sky-400' : 'bg-slate-950 text-slate-400 border-slate-800')}
                        >
                          SÍ
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormSolventar(prev => ({ ...prev, presento_identificacion: false }))}
                          className={clsx('flex-1 py-2 rounded-xl font-bold border transition text-xs', !formSolventar.presento_identificacion ? 'bg-rose-600 text-white border-rose-400' : 'bg-slate-950 text-slate-400 border-slate-800')}
                        >
                          NO
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Tipo de Identificación:</label>
                      <select
                        value={formSolventar.tipo_identificacion}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, tipo_identificacion: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="INE">INE / Credencial de Elector</option>
                        <option value="PASAPORTE">Pasaporte</option>
                        <option value="CEDULA">Cédula Profesional</option>
                        <option value="LICENCIA">Licencia de Conducir</option>
                        <option value="CARTILLA">Cartilla Militar</option>
                        <option value="OTRA">Otra</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Folio / Clave Identificación:</label>
                      <input
                        type="text"
                        value={formSolventar.folio_identificacion}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, folio_identificacion: e.target.value }))}
                        placeholder="Ej. IDMEX1234567890..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Ocupación Titular/Aval:</label>
                      <input
                        type="text"
                        value={formSolventar.ocupacion}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, ocupacion: e.target.value }))}
                        placeholder="Ej. Empleado, Comerciante..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Ocupación del Cónyuge:</label>
                      <input
                        type="text"
                        value={formSolventar.ocupacion_conyuge}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, ocupacion_conyuge: e.target.value }))}
                        placeholder="Ej. Hogar, Independiente..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Teléfono Verificado en Visita:</label>
                      <input
                        type="text"
                        value={formSolventar.telefono_visitado}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, telefono_visitado: e.target.value }))}
                        placeholder="10 dígitos..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Color de Fachada / Casa:</label>
                      <input
                        type="text"
                        value={formSolventar.casa_color}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, casa_color: e.target.value }))}
                        placeholder="Ej. Blanca, Azul, Cantera..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Color Puerta / Cancel:</label>
                      <input
                        type="text"
                        value={formSolventar.puerta_cancel_color}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, puerta_cancel_color: e.target.value }))}
                        placeholder="Ej. Herrería café, Portón blanco..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Número de Niveles / Pisos:</label>
                      <select
                        value={formSolventar.numero_niveles}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, numero_niveles: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="1">1 nivel</option>
                        <option value="2">2 niveles</option>
                        <option value="3">3 niveles</option>
                        <option value="4+">4 o más niveles</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* PESTAÑA 2: DIRECCIÓN REAL EN CAMPO */}
              {activeSolventarTab === 'direccion' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-800 pb-2">
                    <h4 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                      <span>📍</span> 2. DIRECCIÓN REAL CONFIRMADA EN CAMPO
                    </h4>
                    <p className="text-[11px] text-slate-400">Si el domicilio físico difiere del registrado en el sistema SIF.</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                    <div className="text-slate-400 font-bold uppercase text-[10px]">Dirección Registrada en SIF:</div>
                    <div className="text-slate-200">
                      {inv.calle ? `${inv.calle} #${inv.numero_exterior || ''} Int ${inv.numero_interior || 'S/N'}, Col. ${inv.colonia || ''}, CP ${inv.codigo_postal || ''}` : 'Sin dirección SIF registrada'}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-200">¿El domicilio real es diferente al de la solicitud?</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormSolventar(prev => ({ ...prev, tiene_direccion_diferente: true }))}
                          className={clsx('px-4 py-1.5 rounded-lg text-xs font-bold border transition', formSolventar.tiene_direccion_diferente ? 'bg-purple-600 text-white border-purple-400' : 'bg-slate-900 text-slate-400 border-slate-700')}
                        >
                          SÍ ES DIFERENTE
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormSolventar(prev => ({ ...prev, tiene_direccion_diferente: false }))}
                          className={clsx('px-4 py-1.5 rounded-lg text-xs font-bold border transition', !formSolventar.tiene_direccion_diferente ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-900 text-slate-400 border-slate-700')}
                        >
                          NO (ES IGUAL)
                        </button>
                      </div>
                    </div>

                    {formSolventar.tiene_direccion_diferente && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                        <div>
                          <label className="block text-slate-300 font-medium mb-1">Calle y Número Real:</label>
                          <input
                            type="text"
                            value={formSolventar.calle_real}
                            onChange={(e) => setFormSolventar(prev => ({ ...prev, calle_real: e.target.value }))}
                            placeholder="Ej. Av. Hidalgo #123 Int 4..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 font-medium mb-1">Colonia Real:</label>
                          <input
                            type="text"
                            value={formSolventar.colonia_real}
                            onChange={(e) => setFormSolventar(prev => ({ ...prev, colonia_real: e.target.value }))}
                            placeholder="Ej. Moderna, Oblatos..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-slate-300 font-medium mb-1">Entre Calles y Referencias de Ubicación:</label>
                          <input
                            type="text"
                            value={formSolventar.referencias_domicilio}
                            onChange={(e) => setFormSolventar(prev => ({ ...prev, referencias_domicilio: e.target.value }))}
                            placeholder="Ej. Entre calle 5 de Mayo y Benito Juárez, frente a tienda de abarrotes..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PESTAÑA 3: SOCIOECONÓMICO Y BIENES */}
              {activeSolventarTab === 'socioeconomico' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-800 pb-2">
                    <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                      <span>🏠</span> 3. STATUS SOCIO-ECONÓMICO, INTEGRANTES Y BIENES
                    </h4>
                    <p className="text-[11px] text-slate-400">Régimen de vivienda, composición familiar y valores estimados de bienes.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Estado Civil:</label>
                      <select
                        value={formSolventar.estado_civil}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, estado_civil: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="soltero">Soltero(a)</option>
                        <option value="casado">Casado(a)</option>
                        <option value="union_libre">Unión Libre</option>
                        <option value="separado">Separado(a)</option>
                        <option value="divorciado">Divorciado(a)</option>
                        <option value="viudo">Viudo(a)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Tipo de Vivienda:</label>
                      <select
                        value={formSolventar.situacion_vivienda}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, situacion_vivienda: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="propia">Propia</option>
                        <option value="padres">De sus padres</option>
                        <option value="prestada">Prestada</option>
                        <option value="pagandola">Pagándola (Hipoteca)</option>
                        <option value="rentada">Rentada</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Pago Mensual (Renta / Hipoteca $):</label>
                      <input
                        type="number"
                        value={formSolventar.monto_pago_mensual}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, monto_pago_mensual: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {formSolventar.situacion_vivienda === 'prestada' && (
                      <>
                        <div>
                          <label className="block text-slate-300 font-medium mb-1">Quién Presta la Vivienda:</label>
                          <input
                            type="text"
                            value={formSolventar.nombre_quien_presta}
                            onChange={(e) => setFormSolventar(prev => ({ ...prev, nombre_quien_presta: e.target.value }))}
                            placeholder="Nombre..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-300 font-medium mb-1">Parentesco de quien presta:</label>
                          <input
                            type="text"
                            value={formSolventar.parentesco_quien_presta}
                            onChange={(e) => setFormSolventar(prev => ({ ...prev, parentesco_quien_presta: e.target.value }))}
                            placeholder="Ej. Tío, Suegro..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Tiempo de Residencia en el Domicilio:</label>
                      <input
                        type="text"
                        value={formSolventar.tiempo_residencia}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, tiempo_residencia: e.target.value }))}
                        placeholder="Ej. 5 años, 8 meses..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Mayores de 18 años en el hogar:</label>
                      <input
                        type="number"
                        value={formSolventar.personas_mayores_18}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, personas_mayores_18: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Menores de 18 años:</label>
                      <input
                        type="number"
                        value={formSolventar.personas_menores_18}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, personas_menores_18: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Personas que generan ingresos:</label>
                      <input
                        type="number"
                        value={formSolventar.personas_generan_ingresos}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, personas_generan_ingresos: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Personas que estudian:</label>
                      <input
                        type="number"
                        value={formSolventar.personas_estudian}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, personas_estudian: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {/* Pensión */}
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">¿Recibe Pensión alguien en el hogar?:</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormSolventar(prev => ({ ...prev, recibe_pension: true }))}
                          className={clsx('flex-1 py-2 rounded-xl font-bold border transition text-xs', formSolventar.recibe_pension ? 'bg-amber-600 text-white border-amber-400' : 'bg-slate-950 text-slate-400 border-slate-800')}
                        >
                          SÍ
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormSolventar(prev => ({ ...prev, recibe_pension: false }))}
                          className={clsx('flex-1 py-2 rounded-xl font-bold border transition text-xs', !formSolventar.recibe_pension ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-950 text-slate-400 border-slate-800')}
                        >
                          NO
                        </button>
                      </div>
                    </div>

                    {formSolventar.recibe_pension && (
                      <>
                        <div>
                          <label className="block text-slate-300 font-medium mb-1">Personas Pensionadas:</label>
                          <input
                            type="number"
                            value={formSolventar.personas_reciben_pension}
                            onChange={(e) => setFormSolventar(prev => ({ ...prev, personas_reciben_pension: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-300 font-medium mb-1">Tipo de Pensión:</label>
                          <input
                            type="text"
                            value={formSolventar.tipo_pension}
                            onChange={(e) => setFormSolventar(prev => ({ ...prev, tipo_pension: e.target.value }))}
                            placeholder="Ej. IMSS, Bienestar, Jubilación..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </>
                    )}

                    {/* Valores de bienes */}
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Valor Estimado Casa ($):</label>
                      <input
                        type="number"
                        value={formSolventar.valor_estimado_casa}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, valor_estimado_casa: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Valor Estimado Muebles ($):</label>
                      <input
                        type="number"
                        value={formSolventar.valor_estimado_muebles}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, valor_estimado_muebles: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">¿Cuenta con Vehículo / Automóvil?:</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormSolventar(prev => ({ ...prev, tiene_vehiculo: true }))}
                          className={clsx('flex-1 py-2 rounded-xl font-bold border transition text-xs', formSolventar.tiene_vehiculo ? 'bg-amber-600 text-white border-amber-400' : 'bg-slate-950 text-slate-400 border-slate-800')}
                        >
                          SÍ
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormSolventar(prev => ({ ...prev, tiene_vehiculo: false }))}
                          className={clsx('flex-1 py-2 rounded-xl font-bold border transition text-xs', !formSolventar.tiene_vehiculo ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-950 text-slate-400 border-slate-800')}
                        >
                          NO
                        </button>
                      </div>
                    </div>

                    {formSolventar.tiene_vehiculo && (
                      <>
                        <div>
                          <label className="block text-slate-300 font-medium mb-1">Valor Estimado Automóvil ($):</label>
                          <input
                            type="number"
                            value={formSolventar.valor_estimado_automovil}
                            onChange={(e) => setFormSolventar(prev => ({ ...prev, valor_estimado_automovil: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-300 font-medium mb-1">Detalles del Vehículo:</label>
                          <input
                            type="text"
                            value={formSolventar.detalles_vehiculo}
                            onChange={(e) => setFormSolventar(prev => ({ ...prev, detalles_vehiculo: e.target.value }))}
                            placeholder="Ej. Nissan Versa 2018..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* PESTAÑA 4: REFERENCIAS Y AVALES */}
              {activeSolventarTab === 'referencias' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <h4 className="text-sm font-bold text-teal-400 flex items-center gap-2">
                        <span>👥</span> 4. INFORMACIÓN DE REFERENCIAS PERSONALES / AVALES
                      </h4>
                      <p className="text-[11px] text-slate-400">Verifica o edita las referencias vecinales y personales registradas.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAgregarReferencia}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition flex items-center gap-1 shadow"
                    >
                      + Agregar Referencia
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(!formSolventar.referencias_avales || formSolventar.referencias_avales.length === 0) ? (
                      <div className="p-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                        No hay referencias capturadas. Presiona "+ Agregar Referencia" para añadir una.
                      </div>
                    ) : (
                      formSolventar.referencias_avales.map((ref, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                            <span className="font-bold text-xs text-slate-300">Referencia #{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => handleEliminarReferencia(idx)}
                              className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold flex items-center gap-1"
                            >
                              Eliminar
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
                            <div className="lg:col-span-2">
                              <label className="block text-[10px] text-slate-400 mb-0.5">Nombre Completo:</label>
                              <input
                                type="text"
                                value={ref.nombre || ''}
                                onChange={(e) => handleActualizarReferencia(idx, 'nombre', e.target.value)}
                                placeholder="Nombre de la referencia..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Parentesco / Vínculo:</label>
                              <input
                                type="text"
                                value={ref.parentesco || ''}
                                onChange={(e) => handleActualizarReferencia(idx, 'parentesco', e.target.value)}
                                placeholder="Ej. Vecino, Aval, Amigo..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">Tiempo de Conocerlo:</label>
                              <input
                                type="text"
                                value={ref.tiempo_conocerlo || ''}
                                onChange={(e) => handleActualizarReferencia(idx, 'tiempo_conocerlo', e.target.value)}
                                placeholder="Ej. 5 años..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-slate-400 mb-0.5">¿Confirmó Información?:</label>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleActualizarReferencia(idx, 'confirmo', true)}
                                  className={clsx('flex-1 py-1.5 rounded-lg text-xs font-bold border transition', ref.confirmo !== false ? 'bg-teal-600 text-white border-teal-400' : 'bg-slate-900 text-slate-400 border-slate-700')}
                                >
                                  SÍ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleActualizarReferencia(idx, 'confirmo', false)}
                                  className={clsx('flex-1 py-1.5 rounded-lg text-xs font-bold border transition', ref.confirmo === false ? 'bg-rose-600 text-white border-rose-400' : 'bg-slate-900 text-slate-400 border-slate-700')}
                                >
                                  NO
                                </button>
                              </div>
                            </div>

                            <div className="lg:col-span-5">
                              <label className="block text-[10px] text-slate-400 mb-0.5">Domicilio de la Referencia:</label>
                              <input
                                type="text"
                                value={ref.domicilio || ''}
                                onChange={(e) => handleActualizarReferencia(idx, 'domicilio', e.target.value)}
                                placeholder="Calle, número, colonia..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* PESTAÑA 5: DICTAMEN, OBSERVACIONES Y JUSTIFICACIÓN */}
              {activeSolventarTab === 'dictamen' && (
                <div className="space-y-4">
                  <div className="border-b border-slate-800 pb-2">
                    <h4 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                      <span>⚖️</span> 5. OBSERVACIONES, DICTAMEN DE CIERRE Y JUSTIFICACIÓN
                    </h4>
                    <p className="text-[11px] text-slate-400">Emite el dictamen corregido y describe el motivo de solventación del folio.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-200 font-bold mb-1">
                          Dictamen Oficial de la Investigación:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setFormSolventar(prev => ({ ...prev, dictamen: 'DOMICILIO CONFIRMADO' }))}
                            className={clsx(
                              'px-3 py-2.5 rounded-xl text-xs font-bold transition border text-center',
                              formSolventar.dictamen === 'DOMICILIO CONFIRMADO'
                                ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                            )}
                          >
                            ✓ CONFIRMADO (Solventado)
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormSolventar(prev => ({ ...prev, dictamen: 'PENDIENTE' }))}
                            className={clsx(
                              'px-3 py-2.5 rounded-xl text-xs font-bold transition border text-center',
                              formSolventar.dictamen === 'PENDIENTE'
                                ? 'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-600/30'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                            )}
                          >
                            ⏳ PENDIENTE (Mantener Folio)
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-200 font-bold mb-1">
                          Comprobante de Respaldo (PDF o Imagen):
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            id="input-comprobante-folio"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setComprobanteFile(e.target.files[0]);
                              }
                            }}
                          />
                          <label
                            htmlFor="input-comprobante-folio"
                            className="cursor-pointer px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-2 text-xs font-semibold"
                          >
                            <Upload className="w-4 h-4 text-purple-400" />
                            {comprobanteFile ? comprobanteFile.name : 'Adjuntar Documento o Foto...'}
                          </label>
                          {(formSolventar.comprobante_url || comprobanteFile) && (
                            <span className="text-[11px] text-emerald-400 font-mono truncate max-w-[180px]">
                              {comprobanteFile ? '✓ Archivo nuevo' : '✓ Archivo guardado'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-200 font-bold mb-1">
                        Justificación de la Solventación: <span className="text-rose-400">* (Obligatorio)</span>
                      </label>
                      <textarea
                        value={formSolventar.justificacion_folio}
                        onChange={(e) => setFormSolventar(prev => ({ ...prev, justificacion_folio: e.target.value }))}
                        placeholder="Ej. El socio acudió a sucursal con el folio #X a presentar su comprobante de domicilio e identificación vigente. Se cotejaron ingresos y arraigo satisfactoriamente..."
                        rows={3}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>

                  {/* Observaciones complementarias */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <label className="block text-slate-200 font-bold text-xs">
                      Observaciones Complementarias del Estudio de Campo:
                    </label>
                    <textarea
                      value={formSolventar.notas_investigador}
                      onChange={(e) => setFormSolventar(prev => ({ ...prev, notas_investigador: e.target.value }))}
                      rows={3}
                      placeholder="Observaciones de campo complementadas o corregidas..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {/* Aviso de Fotografías */}
                  <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-500/30 text-sky-200 text-xs flex items-center gap-3">
                    <Camera className="w-5 h-5 text-sky-400 shrink-0" />
                    <span>
                      <strong>Fotografías de campo inmutables:</strong> Las {fotosList.length} fotografía(s) capturadas originalmente por el investigador en el predio permanecen archivadas como evidencia legal y pericial inalterable.
                    </span>
                  </div>
                </div>
              )}

            </div>

            {/* Footer buttons */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setShowSolventarModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={solventando || !formSolventar.justificacion_folio.trim()}
                  onClick={() => handleEjecutarSolventacion(false)}
                  className="px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-purple-700/30"
                >
                  <FileText className="w-4 h-4" /> {solventando ? 'Guardando...' : '💾 Guardar Formato (Listo para Validar)'}
                </button>

                <button
                  type="button"
                  disabled={solventando || !formSolventar.justificacion_folio.trim()}
                  onClick={() => handleEjecutarSolventacion(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
                >
                  <CheckCircle2 className="w-4 h-4" /> {solventando ? 'Validando...' : '✅ Guardar y Validar Inmediatamente'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE VALIDACIÓN CON CAPTURA DE COMENTARIOS (Validador) */}
      {showValidarModal && (
        <div className={clsx('fixed', 'inset-0', 'bg-slate-950/80', 'backdrop-blur-sm', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4')}>
          <div className={clsx('bg-slate-900', 'border', 'border-slate-800', 'rounded-2xl', 'max-w-lg', 'w-full', 'p-6', 'space-y-4', 'shadow-2xl')}>
            <div className={clsx('flex', 'items-center', 'justify-between', 'border-b', 'border-slate-800', 'pb-3')}>
              <h3 className={clsx('text-base', 'font-bold', 'text-emerald-400', 'flex', 'items-center', 'gap-2')}>
                <CheckCircle2 className={clsx('w-5', 'h-5')} /> Dictamen y Validación de Crédito
              </h3>
              <button onClick={() => setShowValidarModal(false)} className={clsx('text-slate-400', 'hover:text-white')}>
                <X className={clsx('w-5', 'h-5')} />
              </button>
            </div>

            <p className={clsx('text-xs', 'text-slate-300')}>
              Ingresa tus observaciones y dictamen de validación. Este comentario quedará registrado formalmente y será visualizado por el <strong>Analista de Crédito</strong>:
            </p>

            {/* Chips de plantillas rápidas */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Plantillas de dictamen rápido:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {plantillasDictamen.map((pl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => agregarPlantillaValidar(pl)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-300 border border-slate-700 transition"
                  >
                    + {pl}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={comentariosValidar}
              onChange={(e) => setComentariosValidar(e.target.value)}
              placeholder="Escribe aquí las observaciones del estudio socioeconómico y dictamen para el analista..."
              className={clsx('w-full', 'h-28', 'bg-slate-950', 'border', 'border-slate-800', 'rounded-xl', 'p-3', 'text-xs', 'text-white', 'placeholder-slate-500', 'focus:outline-none', 'focus:border-emerald-500', 'resize-none')}
            />

            <div className={clsx('flex', 'items-center', 'justify-end', 'gap-3', 'pt-2')}>
              <button
                onClick={() => setShowValidarModal(false)}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-slate-800', 'hover:bg-slate-700', 'text-slate-300', 'text-xs', 'font-semibold')}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleEjecutarValidacion('VALIDAR', comentariosValidar)}
                disabled={validating || !comentariosValidar.trim()}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-emerald-600', 'hover:bg-emerald-500', 'disabled:opacity-50', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-1.5', 'shadow-lg', 'shadow-emerald-600/30')}
              >
                {validating ? 'Validando...' : 'Confirmar Validación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN DIRECTA DE COMENTARIOS (Validador) */}
      {showEditarComentariosModal && (
        <div className={clsx('fixed', 'inset-0', 'bg-slate-950/80', 'backdrop-blur-sm', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4')}>
          <div className={clsx('bg-slate-900', 'border', 'border-slate-800', 'rounded-2xl', 'max-w-lg', 'w-full', 'p-6', 'space-y-4', 'shadow-2xl')}>
            <div className={clsx('flex', 'items-center', 'justify-between', 'border-b', 'border-slate-800', 'pb-3')}>
              <h3 className={clsx('text-base', 'font-bold', 'text-teal-400', 'flex', 'items-center', 'gap-2')}>
                <Edit3 className={clsx('w-5', 'h-5')} /> Modificar Observaciones del Validador
              </h3>
              <button onClick={() => setShowEditarComentariosModal(false)} className={clsx('text-slate-400', 'hover:text-white')}>
                <X className={clsx('w-5', 'h-5')} />
              </button>
            </div>

            <p className={clsx('text-xs', 'text-slate-300')}>
              Actualiza las notas y observaciones que el <strong>Analista</strong> verá en este expediente:
            </p>

            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Plantillas de dictamen rápido:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {plantillasDictamen.map((pl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => agregarPlantillaEdicion(pl)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-teal-300 border border-slate-700 transition"
                  >
                    + {pl}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={comentariosEdicion}
              onChange={(e) => setComentariosEdicion(e.target.value)}
              placeholder="Escribe aquí las observaciones actualizadas..."
              className={clsx('w-full', 'h-28', 'bg-slate-950', 'border', 'border-slate-800', 'rounded-xl', 'p-3', 'text-xs', 'text-white', 'placeholder-slate-500', 'focus:outline-none', 'focus:border-teal-500', 'resize-none')}
            />

            <div className={clsx('flex', 'items-center', 'justify-end', 'gap-3', 'pt-2')}>
              <button
                onClick={() => setShowEditarComentariosModal(false)}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-slate-800', 'hover:bg-slate-700', 'text-slate-300', 'text-xs', 'font-semibold')}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarComentariosEdicion}
                disabled={savingComentarios || !comentariosEdicion.trim()}
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-teal-600', 'hover:bg-teal-500', 'disabled:opacity-50', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-1.5', 'shadow-lg', 'shadow-teal-600/30')}
              >
                {savingComentarios ? 'Guardando...' : 'Guardar Observaciones'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* MODAL DE DEVOLUCIÓN AL VALIDADOR POR INCONSISTENCIA (por el Analista) */}
      {showDevolucionModal && (
        <div className={clsx('fixed', 'inset-0', 'bg-slate-950/80', 'backdrop-blur-sm', 'z-50', 'flex', 'items-center', 'justify-center', 'p-4')}>
          <div className={clsx('bg-slate-900', 'border', 'border-slate-800', 'rounded-2xl', 'max-w-lg', 'w-full', 'p-6', 'space-y-4', 'shadow-2xl')}>
            <div className={clsx('flex', 'items-center', 'justify-between', 'border-b', 'border-slate-800', 'pb-3')}>
              <h3 className={clsx('text-base', 'font-bold', 'text-orange-400', 'flex', 'items-center', 'gap-2')}>
                <AlertTriangle className={clsx('w-5', 'h-5')} /> Devolver al Validador por Inconsistencia
              </h3>
              <button onClick={() => setShowDevolucionModal(false)} className={clsx('text-slate-400', 'hover:text-white')}>
                <X className={clsx('w-5', 'h-5')} />
              </button>
            </div>

            <p className={clsx('text-xs', 'text-slate-300')}>
              Describe detalladamente las inconsistencias u observaciones encontradas. El <strong>Validador de Crédito</strong> recibirá tu reporte para corregir o complementar la información:
            </p>

            {/* Chips de motivos comunes */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-orange-400" /> Motivos comunes de inconsistencia:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {plantillasInconsistenciaAnalista.map((pl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => agregarPlantillaDevolucion(pl)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-orange-300 border border-slate-700 transition text-left"
                  >
                    + {pl}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={comentariosDevolucion}
              onChange={(e) => setComentariosDevolucion(e.target.value)}
              placeholder="Escribe aquí las inconsistencias detectadas (ej. El ingreso reportado no cuadra con los estados de cuenta adjuntos...)"
              className={clsx('w-full', 'h-32', 'bg-slate-950', 'border', 'border-slate-800', 'rounded-xl', 'p-3', 'text-xs', 'text-white', 'placeholder-slate-500', 'focus:outline-none', 'focus:border-orange-500', 'resize-none')}
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
                className={clsx('px-4', 'py-2', 'rounded-xl', 'bg-orange-600', 'hover:bg-orange-500', 'disabled:opacity-50', 'text-white', 'text-xs', 'font-bold', 'transition', 'flex', 'items-center', 'gap-1.5', 'shadow-lg', 'shadow-orange-600/30')}
              >
                {revalidating ? 'Enviando...' : '🔄 Devolver al Validador'}
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
              <span className={`px-2.5 py-0.5 rounded text-xs font-extrabold uppercase tracking-wide border ${badgeProps.badgePrintClass}`}>
                {badgeProps.icon} {badgeProps.label.toUpperCase()} DE CRÉDITO
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
            <span className="font-bold">Sucursal de Captación:</span>{' '}
            <span className="font-semibold text-slate-800">{formatNombreSucursal(inv.sucursal_id, inv.sucursal_nombre)}</span>
          </div>
          <div className="col-span-2">
            <span className="font-bold">Fecha Captura Sucursal:</span>{' '}
            <span className="font-semibold text-slate-800">
              {formatFechaHoraCaptura(inv.created_at || inv.fecha_asignacion, inv.sucursal_id)}
            </span>
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
            <span className="font-bold">Teléfono:</span>{' '}
            <span className="font-semibold text-slate-800">
              {est.telefono_visitado || est.telefono || inv.telefono_principal || inv.telefono || 'N/A'}
            </span>
            {est.telefono_visitado && est.telefono_visitado !== (inv.telefono_principal || inv.telefono) && (
              <span className="block text-[10px] text-teal-700 font-bold">
                📞 Verificado en Visita: {est.telefono_visitado}
              </span>
            )}
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
              <div className={clsx('text-[11px]', 'pt-1', 'grid', 'grid-cols-2', 'gap-2')}>
                <div>
                  <strong>Ocupación ({isAval ? 'del Aval' : 'del Solicitante'}):</strong>{' '}
                  <span className={clsx('font-semibold', 'text-slate-900')}>{est.ocupacion || 'No especificada'}</span>
                </div>
                <div>
                  <strong>Teléfono en Visita:</strong>{' '}
                  <span className={clsx('font-semibold', 'text-slate-900')}>{est.telefono_visitado || inv.telefono_principal || inv.telefono || 'N/A'}</span>
                </div>
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
                <div>
                  Persona con pensión: <strong>{est.recibe_pension ? 'SÍ' : (parseInt(est.personas_reciben_pension || 0) > 0 ? 'SÍ' : 'NO')}</strong>
                  {parseInt(est.personas_reciben_pension || 0) > 0 && <span className="text-slate-700 font-semibold"> ({est.personas_reciben_pension} pers.)</span>}
                  {est.tipo_pension ? <span className="text-slate-600 italic"> - {est.tipo_pension}</span> : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Valor estimado de bienes */}
          <div className={clsx('border-t', 'border-slate-300', 'p-3', 'bg-slate-50', 'grid', 'grid-cols-3', 'gap-4', 'text-xs')}>
            <div><strong>Valor Estimado Casa:</strong> ${parseFloat(est.valor_estimado_casa || 0).toLocaleString('es-MX')}</div>
            <div><strong>Valor Muebles:</strong> ${parseFloat(est.valor_estimado_muebles || 0).toLocaleString('es-MX')}</div>
            <div>
              <strong>Automóvil / Vehículo:</strong> ${parseFloat(est.valor_estimado_automovil || 0).toLocaleString('es-MX')}
              {est.tiene_vehiculo !== undefined && (
                <div className="text-[10px] text-slate-700 mt-0.5 font-medium">
                  {est.tiene_vehiculo ? `🚗 ${est.detalles_vehiculo || 'Cuenta con vehículo'}` : '🚫 No cuenta con vehículo'}
                </div>
              )}
            </div>
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

          {/* Sello / Insignia Oficial de Folio Solventado en Gabinete */}
          {yaSolventado && (
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-950 text-xs space-y-1.5 shadow-sm">
              <div className="font-extrabold flex items-center justify-between text-emerald-800 uppercase text-[11px] tracking-wide border-b border-emerald-200 pb-1">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  FOLIO SOLVENTADO EN GABINETE POR EL VALIDADOR DE CRÉDITO
                </span>
                {est.solventado_por && (
                  <span className="text-slate-600 font-semibold normal-case">
                    Atendido por: {est.solventado_por}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-800 leading-relaxed">
                <strong>Justificación Documental / Acreditación:</strong> {inv.justificacion_folio || est.justificacion_folio}
              </div>
              {(inv.comprobante_folio_url || est.comprobante_url) && (
                <div className="pt-0.5">
                  <a
                    href={inv.comprobante_folio_url || est.comprobante_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 underline font-bold text-[11px]"
                  >
                    📎 Ver Comprobante de Respaldo Adjunto
                  </a>
                </div>
              )}
            </div>
          )}
        </div>


        {/* Section: GEOLOCALIZACIÓN Y CHECK-IN EN CAMPO (GPS) */}
        <div className={clsx('border', 'border-slate-800', 'rounded-lg', 'overflow-hidden', 'bg-white')}>
          <div className={clsx('bg-slate-800', 'text-white', 'px-3', 'py-1', 'text-xs', 'font-bold', 'tracking-wider', 'uppercase', 'flex', 'items-center', 'justify-between')}>
            <span className={clsx('flex', 'items-center', 'gap-1.5')}>
              <MapPin className={clsx('w-3.5', 'h-3.5', 'text-sky-400')} /> GEOLOCALIZACIÓN Y CHECK-IN EN CAMPO (GPS)
            </span>
            <span className={clsx('text-[10px]', 'font-normal', 'text-slate-300')}>
              {tieneGpsValido ? '🛰️ Señal Satelital de Precisión' : (esFakeGps ? '⚠️ Coordenada Genérica' : 'Sin GPS registrado')}
            </span>
          </div>
          <div className={clsx('p-3', 'bg-slate-50', 'flex', 'flex-col', 'sm:flex-row', 'items-start', 'sm:items-center', 'justify-between', 'gap-3', 'text-xs')}>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800">Punto de Cierre:</span>
                {tieneGpsValido ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px] border border-emerald-300">
                    Lat: {latCheckin.toFixed(6)}, Lng: {lngCheckin.toFixed(6)}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-300">
                    {esFakeGps ? '⚠️ Ubicación genérica por defecto (Sin lectura satelital en predio)' : 'No se capturaron coordenadas GPS'}
                  </span>
                )}
                {ev.fecha_checkin && (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {formatFechaHoraCaptura(ev.fecha_checkin)}
                  </span>
                )}
              </div>
              {est.tiene_direccion_diferente && est.calle_real && (
                <div className="text-[11px] text-indigo-900 bg-indigo-50 border border-indigo-200 rounded p-1.5 mt-1">
                  <strong>📍 Domicilio Corregido en Campo:</strong> {est.calle_real}{est.colonia_real ? `, Col. ${est.colonia_real}` : ''}
                </div>
              )}
            </div>

            {tieneGpsValido && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${latCheckin},${lngCheckin}`}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(
                  'inline-flex', 'items-center', 'gap-1.5', 'px-3', 'py-1.5',
                  'bg-sky-600', 'hover:bg-sky-700', 'text-white', 'rounded-md',
                  'font-bold', 'text-xs', 'shadow-sm', 'transition', 'shrink-0'
                )}
              >
                <Navigation className="w-3.5 h-3.5" />
                Abrir en Google Maps
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>
            )}
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
                {fotosList.map((fotoItem, idx) => {
                  const fotoUri = typeof fotoItem === 'string' ? fotoItem : (fotoItem?.url || '');
                  const fotoLat = typeof fotoItem === 'object' && fotoItem?.latitud ? Number(fotoItem.latitud) : null;
                  const fotoLng = typeof fotoItem === 'object' && fotoItem?.longitud ? Number(fotoItem.longitud) : null;
                  const hasFotoGps = fotoLat !== null && fotoLng !== null && fotoLat !== 0 && fotoLng !== 0;
                  const fotoTimestamp = typeof fotoItem === 'object' && fotoItem?.timestamp ? fotoItem.timestamp : null;

                  return (
                    <div key={idx} className={clsx('border', 'border-slate-300', 'rounded-lg', 'bg-white', 'p-2', 'shadow-sm', 'flex', 'flex-col', 'items-center', 'justify-between', 'gap-1')}>
                      <div className="relative w-full">
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
                        {hasFotoGps && (
                          <span className="absolute top-1.5 left-1.5 bg-slate-900/85 backdrop-blur-xs text-emerald-400 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 border border-emerald-500/40">
                            <MapPin className="w-2.5 h-2.5 text-emerald-400" /> GPS
                          </span>
                        )}
                      </div>
                      <div className="w-full flex items-center justify-between pt-1 text-[10px]">
                        <span className="font-bold text-slate-700">Foto #{idx + 1}</span>
                        {hasFotoGps ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${fotoLat},${fotoLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-600 hover:text-sky-800 font-bold flex items-center gap-0.5 hover:underline"
                            title={`Lat: ${fotoLat.toFixed(5)}, Lng: ${fotoLng.toFixed(5)}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Navigation className="w-2.5 h-2.5" /> Ver GPS
                          </a>
                        ) : (
                          <span className="text-slate-400 italic text-[9px]">Sin GPS</span>
                        )}
                      </div>
                      {fotoTimestamp && (
                        <span className="text-[9px] text-slate-500 w-full text-left font-mono">
                          {formatFechaHoraCaptura(fotoTimestamp)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={clsx('text-center', 'py-4', 'text-slate-400', 'italic', 'text-xs')}>
                No se capturaron fotografías de evidencia durante esta visita.
              </div>
            )}
          </div>
        </div>

        {/* Dictamen y Observaciones Formales del Validador de Crédito en el Documento Oficial */}
        {inv.comentarios_validacion && (
          <div className={clsx('p-4', 'rounded-xl', 'border-2', 'border-slate-800', 'bg-slate-50', 'space-y-1.5', 'text-xs')}>
            <div className={clsx('text-[11px]', 'font-extrabold', 'text-slate-900', 'uppercase', 'tracking-wide', 'flex', 'items-center', 'justify-between', 'border-b', 'border-slate-300', 'pb-1')}>
              <span>📋 Dictamen y Observaciones del Validador de Crédito</span>
              <span className="text-[10px] font-normal text-slate-600 font-mono">
                {inv.fecha_validacion ? `Fecha: ${new Date(inv.fecha_validacion).toLocaleDateString('es-MX')}` : ''}
              </span>
            </div>
            <p className={clsx('text-xs', 'text-slate-800', 'italic', 'font-medium', 'leading-relaxed', 'pt-1')}>
              "{inv.comentarios_validacion}"
            </p>
            {inv.validador_nombre && (
              <div className={clsx('text-[10px]', 'text-slate-700', 'text-right', 'font-bold')}>
                Validador Responsable: {inv.validador_nombre.toUpperCase()}
              </div>
            )}
          </div>
        )}

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
      {selectedFotoIndex !== null && fotosList[selectedFotoIndex] && (() => {
        const selectedItem = fotosList[selectedFotoIndex];
        const selectedUri = typeof selectedItem === 'string' ? selectedItem : (selectedItem?.url || '');
        const selectedLat = typeof selectedItem === 'object' && selectedItem?.latitud ? Number(selectedItem.latitud) : null;
        const selectedLng = typeof selectedItem === 'object' && selectedItem?.longitud ? Number(selectedItem.longitud) : null;
        const hasSelectedGps = selectedLat !== null && selectedLng !== null && selectedLat !== 0 && selectedLng !== 0;
        const selectedTimestamp = typeof selectedItem === 'object' && selectedItem?.timestamp ? selectedItem.timestamp : null;

        return (
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
                  href={selectedUri}
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
                  src={selectedUri}
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

            {/* Footer Bar with GPS Info */}
            <div className={clsx('w-full', 'max-w-4xl', 'flex', 'items-center', 'justify-between', 'text-xs', 'text-slate-300', 'px-4', 'py-2', 'bg-slate-900/80', 'rounded-xl', 'border', 'border-slate-800')} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                {hasSelectedGps ? (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono font-bold text-[11px] border border-emerald-800 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      Lat: {selectedLat.toFixed(6)}, Lng: {selectedLng.toFixed(6)}
                    </span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedLat},${selectedLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded font-bold text-[11px] transition shadow"
                    >
                      <Navigation className="w-3 h-3" />
                      Ver en Google Maps
                      <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                    </a>
                  </div>
                ) : (
                  <span className="text-slate-400 italic text-[11px]">Foto sin coordenadas GPS asociadas</span>
                )}
                {selectedTimestamp && (
                  <span className="text-slate-400 text-[11px] font-mono">
                    • Captura: {formatFechaHoraCaptura(selectedTimestamp)}
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-400 hidden sm:block">
                Usa los controles superiores para zoom y rotación
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

