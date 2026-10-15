import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  User,
  Users,
  Heart,
  FileText,
  DollarSign,
  MapPin,
  Phone,
  Printer,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Building2,
  Layers,
  Calendar,
  Clock,
  PiggyBank,
  ArrowDownRight,
  Wallet,
  Coins,
  History,
  Check,
  X
} from 'lucide-react';
import { fetchDictamenCredito, buscarCreditos, fetchCreditosRecientes } from '../services/api';
import { useAuth } from '../context/AuthContext';

function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return 'No registrada';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
}

function formatShortDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

function formatMonthLabel(monthStr) {
  if (!monthStr) return '';
  const parts = String(monthStr).split('-');
  const yyyy = parts[0] || '';
  const mm = parts[1] || '';
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const mIndex = parseInt(mm, 10) - 1;
  const shortYear = yyyy ? yyyy.slice(-2) : '';
  return `${meses[mIndex] || mm} '${shortYear}`;
}

export default function AperturaCreditoPage() {
  const { theme } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const folioFromUrl = searchParams.get('folio') || '';

  const [inputFolio, setInputFolio] = useState(folioFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Sugerencias de búsqueda en vivo
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [searchingLive, setSearchingLive] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Créditos recientes para acceso rápido
  const [recientes, setRecientes] = useState([]);
  const [loadingRecientes, setLoadingRecientes] = useState(false);

  // Estado para acordeones de otros créditos
  const [expandedHistorial, setExpandedHistorial] = useState({});

  useEffect(() => {
    cargarRecientes();
  }, []);

  useEffect(() => {
    if (folioFromUrl) {
      setInputFolio(folioFromUrl);
      consultarCredito(folioFromUrl);
    }
  }, [folioFromUrl]);

  async function cargarRecientes() {
    setLoadingRecientes(true);
    try {
      const res = await fetchCreditosRecientes();
      setRecientes(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error('Error cargando recientes:', e);
    } finally {
      setLoadingRecientes(false);
    }
  }

  async function consultarCredito(folioToSearch) {
    const query = (folioToSearch || inputFolio || '').trim();
    if (!query) return;

    setLoading(true);
    setError(null);
    setShowSuggestions(false);

    try {
      const res = await fetchDictamenCredito(query);
      setData(res);
      setSearchParams({ folio: query });
    } catch (err) {
      setError(err.message || 'No se pudo obtener la información del crédito.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Búsqueda en vivo al teclear
  useEffect(() => {
    const q = inputFolio.trim();
    if (q.length < 2) {
      setSearchSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingLive(true);
      try {
        const results = await buscarCreditos(q);
        setSearchSuggestions(Array.isArray(results) ? results : []);
      } catch (e) {
        setSearchSuggestions([]);
      } finally {
        setSearchingLive(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputFolio]);

  function toggleHistorial(personaId) {
    setExpandedHistorial((prev) => ({
      ...prev,
      [personaId]: !prev[personaId]
    }));
  }

  const isDark = theme !== 'light';

  const semaforoStatus = data?.semaforo?.resultado || data?.solicitud?.dictamen_aptitud || 'ADVERTENCIA';

  const getSemaforoBadge = (status) => {
    switch (status) {
      case 'APTO':
        return {
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: CheckCircle2,
          color: 'text-emerald-400',
          title: 'Crédito Dictaminado Apto',
          desc: 'Todos los firmantes, avales y cónyuges cumplen con las normativas documentales y de crédito.'
        };
      case 'NO_APTO':
        return {
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          icon: XCircle,
          color: 'text-rose-400',
          title: 'Crédito No Apto / Con Observaciones Críticas',
          desc: 'Se detectaron impedimentos legales, documentos expirados o discrepancias en los involucrados.'
        };
      default:
        return {
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: AlertTriangle,
          color: 'text-amber-400',
          title: 'Crédito en Revisión / Advertencia',
          desc: 'Existen validaciones pendientes de visita o aclaraciones documentales requeridas.'
        };
    }
  };

  const semBadge = getSemaforoBadge(semaforoStatus);
  const SemIcon = semBadge.icon;

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER DE LA SECCIÓN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400 mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Módulo de Consulta Ejecutiva</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Apertura de Crédito & Dictamen de Involucrados
          </h1>
          <p className="text-sm text-slate-400">
            Cotejo integral en tiempo real de Titulares, Cónyuges, Avales, firmas requeridas y su historial de otros créditos en Caja Popular Oblatos.
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => window.print()}
            disabled={!data}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700 shadow-sm"
          >
            <Printer className="w-4 h-4 text-sky-400" />
            <span>Imprimir Dictamen</span>
          </button>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y SELECCIÓN RÁPIDA */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative no-print">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            consultarCredito(inputFolio);
          }}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Escribe el Folio de Crédito (ej. 35-251573, 48-223895) o nombre del socio..."
              value={inputFolio}
              onChange={(e) => {
                setInputFolio(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="w-full pl-11 pr-10 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 font-mono tracking-wide"
            />
            {searchingLive && (
              <RefreshCw className="w-4 h-4 text-sky-400 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
            )}

            {/* Dropdown de Sugerencias en Vivo */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-800/80">
                {searchSuggestions.map((item) => (
                  <button
                    key={item.id_sif}
                    type="button"
                    onClick={() => {
                      setInputFolio(item.folio);
                      setShowSuggestions(false);
                      consultarCredito(item.folio);
                    }}
                    className="w-full text-left p-3 hover:bg-slate-900 transition flex items-center justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sky-400 text-sm">{item.folio}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                          {item.producto_nombre || 'Crédito'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 font-semibold mt-0.5">{item.titular_nombre}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-emerald-400">{formatCurrency(item.monto_solicitado)}</div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.dictamen_aptitud === 'APTO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {item.dictamen_aptitud || 'EN REVISIÓN'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !inputFolio.trim()}
            className="w-full sm:w-auto px-6 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-600/30 transition flex items-center justify-center gap-2 shrink-0"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Consultar Crédito</span>
          </button>
        </form>

        {/* PILLS DE CRÉDITOS REALES RECIENTES PARA PRUEBA RÁPIDA */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Ejemplos Reales Recientes en Dokploy:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recientes.slice(0, 8).map((rec) => (
              <button
                key={rec.id_sif}
                type="button"
                onClick={() => {
                  setInputFolio(rec.folio);
                  consultarCredito(rec.folio);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition flex items-center gap-1.5 ${
                  data?.solicitud?.folio === rec.folio
                    ? 'bg-sky-500/20 text-sky-300 border-sky-400 font-bold shadow-sm'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <span>{rec.folio}</span>
                <span className="text-[10px] text-slate-400">({rec.titular_nombre?.split(' ')[0]})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ESTADO DE ERROR */}
      {error && (
        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm">Error en la consulta</div>
            <p className="text-xs text-rose-200 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ESTADO DE CARGA */}
      {loading && (
        <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto mb-3" />
          <div className="text-sm font-bold text-white">Extrayendo información de apertura de crédito...</div>
          <p className="text-xs text-slate-400 mt-1">Cruzando firmantes, avales, cónyuges e historial de préstamos en Dokploy.</p>
        </div>
      )}

      {/* RESULTADO PRINCIPAL DEL CRÉDITO */}
      {data && !loading && (
        <div className="space-y-6">
          {/* HERO CARD: FOLIO, MONTOS Y SEMÁFORO GLOBAL DE APTITUD */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tarjeta de Datos Comerciales del Crédito */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono text-xs font-bold">
                      FOLIO: {data.solicitud?.folio}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-semibold">
                      {data.solicitud?.producto_nombre || 'CRÉDITO INSTITUCIONAL'}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-2">
                    {data.solicitud?.titular_nombre}
                  </h2>
                  <div className="text-xs text-slate-400 flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      Sucursal: {data.solicitud?.sucursal_nombre || `Sucursal #${data.solicitud?.sucursal_id || 'Principal'}`}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Capturado: {formatDate(data.solicitud?.created_at)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] uppercase font-bold text-slate-400">Monto Solicitado</div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {formatCurrency(data.solicitud?.monto_solicitado)}
                  </div>
                  {data.solicitud?.monto_aprobado > 0 && (
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      Aprobado: <strong className="text-white">{formatCurrency(data.solicitud?.monto_aprobado)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Domicilio del Crédito */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-sky-400" /> Domicilio Registrado
                  </div>
                  <div className="text-slate-200 font-medium">
                    {data.solicitud?.titular_calle ? `${data.solicitud?.titular_calle} #${data.solicitud?.titular_numero_exterior || 'S/N'}` : 'Sin calle registrada'}
                    {data.solicitud?.titular_numero_interior && ` Int. ${data.solicitud?.titular_numero_interior}`}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Col. {data.solicitud?.titular_colonia || 'N/A'}, {data.solicitud?.titular_municipio || 'Jalisco'} C.P. {data.solicitud?.titular_codigo_postal || 'N/A'}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                    <User className="w-3.5 h-3.5 text-purple-400" /> Identificación Fiscal
                  </div>
                  <div className="font-mono text-slate-200">
                    CURP: <strong className="text-white">{data.solicitud?.titular_curp || 'No registrada'}</strong>
                  </div>
                  <div className="font-mono text-slate-400 text-[11px]">
                    RFC: <span className="text-slate-300">{data.solicitud?.titular_rfc || 'No registrado'}</span> | Riesgo SIF: <span className="text-amber-400 font-bold">{data.solicitud?.titular_nivel_riesgo || 'Normal'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gran Semáforo de Aptitud Crediticia */}
            <div className={`rounded-2xl p-6 border shadow-xl flex flex-col justify-between ${semBadge.bg}`}>
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs uppercase font-extrabold tracking-wider opacity-80">
                    Dictamen Global
                  </span>
                  <SemIcon className={`w-6 h-6 ${semBadge.color}`} />
                </div>

                <div className={`text-2xl font-black ${semBadge.color} tracking-tight`}>
                  {semBadge.title}
                </div>
                <p className="text-xs mt-1.5 opacity-90 leading-relaxed">
                  {semBadge.desc}
                </p>

                {/* Métricas rápidas */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-current/20 text-xs">
                  <div>
                    <span className="opacity-75 block text-[10px] uppercase font-bold">Firmantes Totales</span>
                    <strong className="text-base font-black">{data.semaforo?.total_firmantes || 0}</strong>
                  </div>
                  <div>
                    <span className="opacity-75 block text-[10px] uppercase font-bold">Cónyuges Requeridos</span>
                    <strong className="text-base font-black">{data.semaforo?.total_conyuges || 0}</strong>
                  </div>
                  <div>
                    <span className="opacity-75 block text-[10px] uppercase font-bold">Avales Asignados</span>
                    <strong className="text-base font-black">{data.semaforo?.total_avales || 0}</strong>
                  </div>
                  <div>
                    <span className="opacity-75 block text-[10px] uppercase font-bold">Inaptos / Con Obs.</span>
                    <strong className="text-base font-black">{data.semaforo?.total_inaptos || 0}</strong>
                  </div>
                </div>
              </div>

              {/* Lista de Motivos Oficiales */}
              {Array.isArray(data.semaforo?.motivos) && data.semaforo.motivos.length > 0 && (
                <div className="mt-4 pt-3 border-t border-current/20 text-[11px] space-y-1">
                  <div className="font-bold opacity-90">Observaciones del Sistema:</div>
                  {data.semaforo.motivos.map((m, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 opacity-85">
                      <span>•</span>
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AUDITORÍA FINANCIERA INTEGRAL: AHORROS, RETIROS, MENSUALIDADES Y MOROSIDAD (12 MESES) */}
          {data?.solicitud?.resumen_financiero && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                    <PiggyBank className="w-4 h-4" />
                    <span>Auditoría Financiera & Normativa de Ahorro (Ventana 12 Meses)</span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-1">
                    Criterios Financieros de Ahorro, Retiros, Mensualidades y Morosidad
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Evaluación automática de depósitos recurrentes (mínimo $50 pesos/mes), retiros de ahorro, compromisos de pago mensual y atrasos al mes atrasado.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold font-mono">
                    Corte: 12 meses cerrados
                  </span>
                </div>
              </div>

              {/* 4 KPIs Clave */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Hábito de Ahorro */}
                <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                  data.solicitud?.cumple_habito_ahorro
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-rose-500/10 border-rose-500/30'
                }`}>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <PiggyBank className={`w-4 h-4 ${data.solicitud?.cumple_habito_ahorro ? 'text-emerald-400' : 'text-rose-400'}`} />
                        Hábito de Ahorro (12m)
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold ${
                        data.solicitud?.cumple_habito_ahorro
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {data.solicitud?.cumple_habito_ahorro ? '✓ CUMPLE' : '✕ NO CUMPLE'}
                      </span>
                    </div>
                    <div className="text-2xl font-black text-white font-mono mt-2">
                      {data.solicitud?.resumen_financiero?.resumen?.meses_ahorro || 
                       (data.solicitud?.resumen_financiero?.titular?.meses_ahorro_cumplidos != null 
                          ? `${data.solicitud.resumen_financiero.titular.meses_ahorro_cumplidos}/12` 
                          : 'N/A')}
                      <span className="text-xs font-normal text-slate-400 ml-1.5">meses con depósito</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Norma CPO: Depósito recurrente de mín. <strong className="text-slate-200">$50 pesos</strong> cada mes consecutivo.
                  </p>
                </div>

                {/* 2. Retiros de Cuentas */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <ArrowDownRight className="w-4 h-4 text-amber-400" />
                        Retiros de Ahorro (12m)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300">
                        {data.solicitud?.resumen_financiero?.resumen?.cantidad_retiros_12m || 
                         data.solicitud?.resumen_financiero?.titular?.cantidad_retiros_12m || 0} retiros
                      </span>
                    </div>
                    <div className="text-2xl font-black text-amber-400 font-mono mt-2">
                      {formatCurrency(data.solicitud?.total_retiros_12m || data.solicitud?.resumen_financiero?.resumen?.total_retiros_12m || 0)}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Suma total extraída de cuentas de ahorro débito y corrientes en 12 meses.
                  </p>
                </div>

                {/* 3. Mensualidades Activas */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Wallet className="w-4 h-4 text-sky-400" />
                        Mensualidades Activas
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-sky-500/20 text-sky-300">
                        {data.solicitud?.resumen_financiero?.resumen?.creditos_vigentes_titular || 
                         data.solicitud?.resumen_financiero?.titular?.total_creditos_vigentes || 0} créditos vigentes
                      </span>
                    </div>
                    <div className="text-2xl font-black text-sky-400 font-mono mt-2">
                      {formatCurrency(data.solicitud?.total_mensualidades || data.solicitud?.resumen_financiero?.resumen?.mensualidades_titular || 0)}
                      <span className="text-xs font-normal text-slate-400 ml-1">/ mes</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Compromiso mensual exigible por otros préstamos activos en Caja Popular Oblatos.
                  </p>
                </div>

                {/* 4. Morosidad e Historial */}
                <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                  data.solicitud?.tiene_morosidad || data.solicitud?.resumen_financiero?.resumen?.tiene_morosidad_titular
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-emerald-500/10 border-emerald-500/30'
                }`}>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <ShieldCheck className={`w-4 h-4 ${
                          data.solicitud?.tiene_morosidad || data.solicitud?.resumen_financiero?.resumen?.tiene_morosidad_titular
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`} />
                        Historial de Morosidad
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold ${
                        data.solicitud?.tiene_morosidad || data.solicitud?.resumen_financiero?.resumen?.tiene_morosidad_titular
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {data.solicitud?.tiene_morosidad || data.solicitud?.resumen_financiero?.resumen?.tiene_morosidad_titular
                          ? '✕ CON MORA'
                          : '✓ AL CORRIENTE'}
                      </span>
                    </div>
                    <div className="text-2xl font-black text-white font-mono mt-2">
                      {data.solicitud?.resumen_financiero?.resumen?.max_dias_mora_titular || 0}
                      <span className="text-xs font-normal text-slate-400 ml-1.5">días mora máx.</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    {data.solicitud?.tiene_morosidad || data.solicitud?.resumen_financiero?.resumen?.tiene_morosidad_titular
                      ? 'Presenta cuotas vencidas o atrasos en préstamos vigentes o anteriores.'
                      : 'Sin antecedentes de mora en la cartera de créditos de la cooperativa.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* MATRIZ DE FIRMANTES OFICIALES: TITULAR, AVALES Y SUS RESPECTIVOS CÓNYUGES */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-400" />
                  Involucrados, Cónyuges y Estatus de Firmas
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Desglose de cada firmante obligatorio según el core SIF y su relación jurídica con la apertura de crédito.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
                  ✓ Apto para firma
                </span>
                <span className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold flex items-center gap-1">
                  ✕ Con impedimento
                </span>
              </div>
            </div>

            {/* SECCIÓN 1: TITULAR Y CÓNYUGE DEL TITULAR */}
            <div className="space-y-4">
              <div className="text-xs uppercase font-extrabold tracking-wider text-sky-400 flex items-center gap-1.5">
                <User className="w-4 h-4" /> 1. Titular del Crédito & Cónyuge
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ficha Titular */}
                {data.titular && (
                  <FirmanteCard
                    firmante={data.titular}
                    badgeLabel="TITULAR PRINCIPAL"
                    badgeColor="bg-sky-600 text-white"
                    solicitudResumen={data.solicitud?.resumen_financiero}
                    solicitud={data.solicitud}
                  />
                )}

                {/* Ficha Cónyuge del Titular */}
                {data.conyugeTitular ? (
                  <FirmanteCard
                    firmante={data.conyugeTitular}
                    badgeLabel="CÓNYUGE DEL TITULAR"
                    badgeColor="bg-pink-600 text-white"
                    solicitudResumen={data.solicitud?.resumen_financiero}
                    solicitud={data.solicitud}
                  />
                ) : (
                  <div className="p-6 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-center flex flex-col items-center justify-center">
                    <Heart className="w-8 h-8 text-slate-600 mb-2" />
                    <div className="text-xs font-bold text-slate-400">Sin Cónyuge Registrado para el Titular</div>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                      No se detectó registro de cónyuge mancomunado en SIF para el solicitante principal.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 2: AVALES Y SUS RESPECTIVOS CÓNYUGES */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="text-xs uppercase font-extrabold tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> 2. Avales / Obligados Solidarios & Sus Cónyuges ({data.avales?.length || 0})
              </div>

              {data.avales && data.avales.length > 0 ? (
                <div className="space-y-4">
                  {data.avales.map((avItem, idx) => (
                    <div key={idx} className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-4">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          Aval #{idx + 1}: {avItem.nombre_completo}
                        </span>
                        {avItem.tipo_garantia_nombre && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            Garantía: {avItem.tipo_garantia_nombre}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Tarjeta del Aval */}
                        <FirmanteCard
                          firmante={avItem}
                          badgeLabel={`AVAL #${idx + 1}`}
                          badgeColor="bg-emerald-600 text-white"
                          solicitudResumen={data.solicitud?.resumen_financiero}
                          solicitud={data.solicitud}
                        />

                        {/* Tarjeta del Cónyuge del Aval */}
                        {avItem.conyuge ? (
                          <FirmanteCard
                            firmante={avItem.conyuge}
                            badgeLabel={`CÓNYUGE AVAL #${idx + 1}`}
                            badgeColor="bg-purple-600 text-white"
                            solicitudResumen={data.solicitud?.resumen_financiero}
                            solicitud={data.solicitud}
                          />
                        ) : (
                          <div className="p-4 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center flex flex-col items-center justify-center">
                            <Heart className="w-6 h-6 text-slate-600 mb-1" />
                            <div className="text-[11px] font-bold text-slate-400">Sin Cónyuge para este Aval</div>
                            <span className="text-[10px] text-slate-500">No aplica firma mancomunada</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800 text-center text-slate-400 text-xs">
                  Esta solicitud no cuenta con avales registrados en la base de datos de SIF.
                </div>
              )}
            </div>
          </div>

          {/* TABLA RESUMEN EJECUTIVA DE FIRMAS OBLIGATORIAS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-400" />
              Matriz de Control de Firmas para Pagaré y Contrato
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Rol</th>
                    <th className="py-2.5 px-3">Nombre Completo</th>
                    <th className="py-2.5 px-3">CURP / Identificación</th>
                    <th className="py-2.5 px-3 text-center">¿Firma Requerida?</th>
                    <th className="py-2.5 px-3 text-center">Firma de Campo</th>
                    <th className="py-2.5 px-3 text-right">Estatus de Aptitud</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {data.firmantes?.map((fItem, fIdx) => (
                    <tr key={fIdx} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                          {fItem.rol}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">
                        {fItem.nombre_completo}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {fItem.curp || 'No registrada'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {fItem.debe_firmar ? (
                          <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold text-[10px]">
                            OBLIGATORIA
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Opcional</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {fItem.investigacion?.firma_url ? (
                          <span className="text-emerald-400 font-bold flex items-center justify-center gap-1 text-[11px]">
                            ✓ Capturada
                          </span>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Pendiente</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {fItem.es_apto ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                            ✓ APTO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]" title={fItem.motivo_inaptitud}>
                            ✕ NO APTO
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Tarjeta individual de firmante con desglose financiero:
 * Hábito de Ahorro (12 meses mín. $50), Retiros, Mensualidades de créditos activos, Avalados y Otros créditos.
 */
function FirmanteCard({ firmante, badgeLabel, badgeColor, solicitudResumen, solicitud }) {
  const [activeTab, setActiveTab] = useState(null); // 'ahorro' | 'retiros' | 'creditos' | 'avalados' | 'otros' | null

  const tieneOtros = Array.isArray(firmante.otrosCreditos) && firmante.otrosCreditos.length > 0;

  // Extraer información financiera cruzada (solicitudResumen o detalle_financiero)
  const fin = firmante.detalle_financiero 
    || (firmante.rol === 'TITULAR' ? (solicitudResumen?.titular || solicitud?.resumen_financiero?.titular) : null)
    || (solicitudResumen?.avales?.find(a => String(a.person_id) === String(firmante.persona_id_sif)))
    || {};

  const mesesAhorro = Array.isArray(fin.detalle_meses_ahorro) ? fin.detalle_meses_ahorro : [];
  const retiros = Array.isArray(fin.retiros) ? fin.retiros : [];
  const creditosVigentes = Array.isArray(fin.creditos_vigentes) ? fin.creditos_vigentes : [];
  const detalleAvalados = Array.isArray(fin.detalle_avalados) ? fin.detalle_avalados : [];

  const mesesCumplidos = fin.meses_ahorro_cumplidos ?? (firmante.cumple_ahorro ? 12 : 0);
  const cumpleHabitoAhorro = fin.cumple_habito_ahorro ?? firmante.cumple_ahorro ?? (mesesCumplidos === 12);
  const totalRetiros = Number(fin.total_retiros_12m || firmante.total_retiros_12m || firmante.sf_retiros || 0);
  const cantRetiros = fin.cantidad_retiros_12m ?? retiros.length;
  const totalMensualidades = Number(fin.total_mensualidades || firmante.mensualidades_activas || 0);
  const maxDiasMora = Number(fin.max_dias_mora ?? firmante.max_dias_mora ?? 0);
  const tieneMora = Boolean(fin.tiene_morosidad || firmante.tiene_morosidad || maxDiasMora > 0);
  const totalAvalados = Number(fin.total_avala_vigentes || firmante.total_avala_vigentes || detalleAvalados.length);

  const toggleTab = (tabName) => {
    setActiveTab(prev => (prev === tabName ? null : tabName));
  };

  return (
    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 flex flex-col justify-between space-y-3 shadow-md hover:border-slate-700 transition">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wide uppercase ${badgeColor}`}>
            {badgeLabel}
          </span>
          {firmante.es_apto ? (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
              ✓ APTO
            </span>
          ) : (
            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded flex items-center gap-1">
              ✕ NO APTO
            </span>
          )}
        </div>

        <h4 className="font-extrabold text-sm text-white">{firmante.nombre_completo}</h4>

        {/* Motivo de inaptitud si existe */}
        {!firmante.es_apto && firmante.motivo_inaptitud && (
          <div className="mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
            <span><strong>Motivo:</strong> {firmante.motivo_inaptitud}</span>
          </div>
        )}

        {/* Datos Personales */}
        <div className="mt-2.5 text-xs text-slate-400 space-y-1">
          <div className="font-mono text-[11px]">
            CURP: <span className="text-slate-300">{firmante.curp || 'N/A'}</span> | RFC: <span className="text-slate-300">{firmante.rfc || 'N/A'}</span>
          </div>
          {firmante.telefono_contacto && (
            <div className="flex items-center gap-1 text-[11px] text-slate-300">
              <Phone className="w-3 h-3 text-sky-400" />
              <span>{firmante.telefono_contacto}</span>
            </div>
          )}
          {firmante.calle && (
            <div className="text-[11px] text-slate-400 flex items-start gap-1">
              <MapPin className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
              <span>{firmante.calle} #{firmante.numero_exterior || 'S/N'}, {firmante.colonia || ''} ({firmante.municipio || ''})</span>
            </div>
          )}
        </div>

        {/* Evidencia de Visita Domiciliaria */}
        {firmante.investigacion && (
          <div className="mt-3 pt-2.5 border-t border-slate-900 text-xs flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Visita #{firmante.investigacion.id_sif_research}:{' '}
              <strong className={firmante.investigacion.estado === 'COMPLETADA' ? 'text-emerald-400' : 'text-amber-400'}>
                {firmante.investigacion.estado}
              </strong>
            </span>
            <Link
              to={`/investigaciones/${firmante.investigacion.id_sif_research}`}
              className="text-sky-400 hover:text-sky-300 text-[11px] font-bold flex items-center gap-0.5 hover:underline"
            >
              Ver Estudio <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          </div>
        )}

        {/* INSIGNIAS FINANCIERAS RÁPIDAS (NORMATIVA LIBRETA) */}
        <div className="mt-3 pt-2.5 border-t border-slate-900 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
          <div className={`p-1.5 rounded-lg border text-center font-mono ${
            cumpleHabitoAhorro 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <span className="block text-[9px] uppercase font-bold opacity-75">Ahorro 12M</span>
            <strong>{mesesCumplidos}/12m (Mín $50)</strong>
          </div>

          <div className={`p-1.5 rounded-lg border text-center font-mono ${
            totalRetiros > 0
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}>
            <span className="block text-[9px] uppercase font-bold opacity-75">Retiros 12M</span>
            <strong>{formatCurrency(totalRetiros)}</strong>
          </div>

          <div className={`p-1.5 rounded-lg border text-center font-mono ${
            totalMensualidades > 0
              ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}>
            <span className="block text-[9px] uppercase font-bold opacity-75">Mensualidad</span>
            <strong>{formatCurrency(totalMensualidades)}/m</strong>
          </div>

          <div className={`p-1.5 rounded-lg border text-center font-mono ${
            tieneMora
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 font-bold'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}>
            <span className="block text-[9px] uppercase font-bold opacity-75">Morosidad</span>
            <strong>{maxDiasMora > 0 ? `${maxDiasMora}d mora` : '0d mora'}</strong>
          </div>
        </div>
      </div>

      {/* BARRA DE PESTAÑAS INTERACTIVAS */}
      <div className="pt-2 border-t border-slate-900 space-y-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => toggleTab('ahorro')}
            className={`px-2.5 py-1 rounded-lg border transition whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'ahorro'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border-slate-800'
            }`}
          >
            <PiggyBank className="w-3 h-3 text-amber-400" />
            <span>Depósitos ({mesesCumplidos}/12)</span>
          </button>

          <button
            type="button"
            onClick={() => toggleTab('retiros')}
            className={`px-2.5 py-1 rounded-lg border transition whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'retiros'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border-slate-800'
            }`}
          >
            <ArrowDownRight className="w-3 h-3 text-rose-400" />
            <span>Retiros ({cantRetiros})</span>
          </button>

          <button
            type="button"
            onClick={() => toggleTab('creditos')}
            className={`px-2.5 py-1 rounded-lg border transition whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'creditos'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm'
                : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border-slate-800'
            }`}
          >
            <Wallet className="w-3 h-3 text-sky-400" />
            <span>Créditos Activos ({creditosVigentes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => toggleTab('avalados')}
            className={`px-2.5 py-1 rounded-lg border transition whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'avalados'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border-slate-800'
            }`}
          >
            <Users className="w-3 h-3 text-purple-400" />
            <span>Avala ({totalAvalados})</span>
          </button>

          <button
            type="button"
            onClick={() => toggleTab('otros')}
            className={`px-2.5 py-1 rounded-lg border transition whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'otros'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border-slate-800'
            }`}
          >
            <CreditCard className="w-3 h-3 text-emerald-400" />
            <span>Historial ({firmante.total_otros_creditos || 0})</span>
          </button>
        </div>

        {/* CONTENIDO DE PESTAÑA: DEPÓSITOS DE AHORRO (12 MESES) */}
        {activeTab === 'ahorro' && (
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-800">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <PiggyBank className="w-3.5 h-3.5 text-amber-400" />
                Hábito de Ahorro: Depósito mín. $50 pesos cada mes (12 meses)
              </span>
              <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                cumpleHabitoAhorro ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {cumpleHabitoAhorro ? '✓ CUMPLIÓ 12/12' : `✕ ${mesesCumplidos}/12 MESES`}
              </span>
            </div>

            {mesesAhorro.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 pt-1">
                {mesesAhorro.map((m, idx) => (
                  <div
                    key={idx}
                    className={`p-1.5 rounded-lg border text-center transition ${
                      m.cumplio
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="text-[10px] font-mono font-bold">{formatMonthLabel(m.mes)}</div>
                    <div className="text-[10px] font-mono font-black mt-0.5">{formatCurrency(m.total_depositado)}</div>
                    <div className="text-[9px] font-bold mt-0.5 flex items-center justify-center gap-0.5">
                      {m.cumplio ? (
                        <><span>✓</span><span>Mín $50</span></>
                      ) : (
                        <><span>✕</span><span>Sin depósito</span></>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic p-3 text-center">
                Sin movimientos de ahorro registrados en la ventana de 12 meses.
              </div>
            )}
          </div>
        )}

        {/* CONTENIDO DE PESTAÑA: RETIROS DE AHORRO (12 MESES) */}
        {activeTab === 'retiros' && (
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-800">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                Retiros de Cuentas de Ahorro y Corrientes (12 meses)
              </span>
              <span className="font-mono font-black text-rose-400 text-[11px]">
                Total: -{formatCurrency(totalRetiros)}
              </span>
            </div>

            {retiros.length > 0 ? (
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                      <th className="py-1 px-2">Fecha</th>
                      <th className="py-1 px-2">Cuenta / Producto</th>
                      <th className="py-1 px-2">Concepto</th>
                      <th className="py-1 px-2 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {retiros.map((r, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-800/30">
                        <td className="py-1.5 px-2 font-mono text-slate-300 whitespace-nowrap">{formatShortDate(r.fecha)}</td>
                        <td className="py-1.5 px-2 text-slate-300">
                          <span className="font-semibold text-white block">{r.producto || 'Ahorro'}</span>
                          <span className="text-[9px] text-slate-500 font-mono">{r.cuenta}</span>
                        </td>
                        <td className="py-1.5 px-2 text-slate-400 text-[10px]">{r.descripcion || 'Retiro de cuenta'}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
                          -{formatCurrency(r.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic p-3 text-center">
                ✓ No registra retiros de ahorro en los últimos 12 meses.
              </div>
            )}
          </div>
        )}

        {/* CONTENIDO DE PESTAÑA: CRÉDITOS ACTIVOS & MENSUALIDADES */}
        {activeTab === 'creditos' && (
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-800">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-sky-400" />
                Créditos Vigentes & Compromiso en Mensualidades
              </span>
              <span className="font-mono font-black text-sky-400 text-[11px]">
                Total: {formatCurrency(totalMensualidades)} / mes
              </span>
            </div>

            {creditosVigentes.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {creditosVigentes.map((cv, cvIdx) => (
                  <div key={cvIdx} className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                    <div>
                      <div className="font-mono font-bold text-sky-400 flex items-center gap-2">
                        <span>Folio: {cv.folio}</span>
                        {cv.dias_mora > 0 ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">
                            {cv.dias_mora} días mora
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            ✓ Al corriente
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Monto Aprobado: <strong className="text-white font-mono">{formatCurrency(cv.monto_aprobado)}</strong>
                        {cv.cuotas_vencidas > 0 && <span className="text-rose-400 font-bold ml-1.5">({cv.cuotas_vencidas} vencidas)</span>}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Mensualidad</span>
                      <strong className="text-amber-400 font-mono text-xs">{formatCurrency(cv.cuota_mensual)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic p-3 text-center">
                Sin otros créditos vigentes activos en la cooperativa.
              </div>
            )}
          </div>
        )}

        {/* CONTENIDO DE PESTAÑA: CRÉDITOS AVALADOS (RESPALDOS) */}
        {activeTab === 'avalados' && (
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-800">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-400" />
                Créditos Donde Funge como Aval ({totalAvalados})
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                Garantías otorgadas activas
              </span>
            </div>

            {detalleAvalados.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {detalleAvalados.map((avld, avIdx) => (
                  <div key={avIdx} className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                    <div>
                      <div className="font-mono font-bold text-purple-300 flex items-center gap-2">
                        <span>Folio: {avld.folio}</span>
                        {avld.dias_mora > 0 ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">
                            Avalado con {avld.dias_mora}d mora
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                            ✓ Avalado al corriente
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5">
                        Avala a: <strong className="text-white">{avld.titular_nombre || 'Titular'}</strong>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Mensualidad</span>
                      <strong className="text-slate-200 font-mono text-xs">{formatCurrency(avld.cuota_mensual)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic p-3 text-center">
                No funge como aval de otros créditos activos en CPO.
              </div>
            )}
          </div>
        )}

        {/* CONTENIDO DE PESTAÑA: HISTORIAL DE SOLICITUDES PREVIAS EN CPO */}
        {activeTab === 'otros' && (
          <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-800">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                Historial de Solicitudes Anteriores en CPO
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {firmante.total_otros_creditos || 0} registro(s)
              </span>
            </div>

            {tieneOtros ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {firmante.otrosCreditos.map((c, cIdx) => (
                  <div key={cIdx} className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] flex items-center justify-between gap-2">
                    <div>
                      <div className="font-mono font-bold text-sky-400">{c.folio}</div>
                      <div className="text-[10px] text-slate-400">
                        Rol: <strong className="text-slate-300">{c.rol_en_credito}</strong> | {c.producto_nombre || 'Crédito'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400">{formatCurrency(c.monto_solicitado)}</div>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {c.dictamen_aptitud || 'Estado ' + c.estado_sif}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic p-3 text-center">
                No tiene otros créditos registrados en la base de datos de CPO.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
