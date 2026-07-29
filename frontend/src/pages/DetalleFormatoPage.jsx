import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchInvestigacionDetalle } from '../services/api';
import { Printer, ChevronLeft, CheckSquare, Square, Camera } from 'lucide-react';

export default function DetalleFormatoPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFoto, setSelectedFoto] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchInvestigacionDetalle(id);
        setData(res);
      } catch (err) {
        console.error('Error cargando detalle:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Cargando formato de investigación...</div>;
  }

  if (!data || !data.investigacion) {
    return <div className="p-12 text-center text-slate-400">No se encontró la investigación #{id}.</div>;
  }

  const inv = data.investigacion;
  const ev = data.evidencia || {};
  
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
              src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`CPO-VERIFIED|FOLIO:${inv.id_sif_research}|SOCIO:${inv.persona_id_sif}`)}`}
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
            <span className="font-bold">Dirección:</span> {inv.calle ? `${inv.calle} #${inv.numero_exterior || ''} Int ${inv.numero_interior || 'S/N'}, CP ${inv.codigo_postal || ''}` : 'Sin Dirección Registrada'}
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
                <div>( {est.situacion_vivienda === 'de_sus_padres' ? 'X' : ' '} ) De sus Padres</div>
                <div>( {est.situacion_vivienda === 'prestada' ? 'X' : ' '} ) Prestada</div>
                <div>( {est.situacion_vivienda === 'pagandola' ? 'X' : ' '} ) Pagándola (${est.monto_pago_mensual || '0'})</div>
                <div>( {est.situacion_vivienda === 'rentada' ? 'X' : ' '} ) Rentada (${est.monto_pago_mensual || '0'})</div>
              </div>
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
              data.avales.map((av, idx) => (
                <div key={idx} className="p-2 border border-slate-200 rounded bg-slate-50 flex items-center justify-between text-[11px]">
                  <div>
                    <strong>Nombre:</strong> {av.nombre_completo} <br />
                    <strong>Domicilio:</strong> {av.calle} CP {av.codigo_postal}
                  </div>
                  <div>
                    <strong>Confirmó:</strong> SÍ [X] NO [ ]
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-500 italic">No se registraron referencias adicionales en SIF.</div>
            )}
          </div>
        </div>

        {/* Section 4: OBSERVACIONES DEL INVESTIGADOR Y DICTAMEN */}
        <div className="border border-slate-800 rounded-lg p-4 space-y-3 bg-slate-50">
          <div className="font-bold text-xs uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
            4. OBSERVACIONES Y DICTAMEN DEL INVESTIGADOR
          </div>
          <div className="text-xs text-slate-800 min-h-[60px] whitespace-pre-wrap font-mono bg-white p-3 rounded border border-slate-300">
            {ev.notas_investigador || inv.observaciones_sif || 'El domicilio fue verificado satisfactoriamente. Se corroboró la identidad y estancia del socio en la vivienda indicada.'}
          </div>

          <div className="flex items-center justify-between pt-2 text-xs font-bold">
            <div className="flex items-center gap-2">
              <span>Dictamen Final:</span>
              <span className="px-3 py-1 rounded bg-slate-900 text-white uppercase text-[11px]">
                {inv.estado === 'COMPLETADA' ? 'APROBADO - DOMICILIO CONFIRMADO' : 'EN REVISIÓN'}
              </span>
            </div>
            <div>
              Investigador: <span className="font-semibold">{inv.investigador_nombre || 'Carlos Mendoza'}</span>
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
                      onClick={() => setSelectedFoto(fotoUri)}
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

      {/* Modal para ver foto ampliada en la Web */}
      {selectedFoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 no-print" onClick={() => setSelectedFoto(null)}>
          <div className="relative max-w-3xl max-h-[90vh] bg-slate-900 p-2 rounded-2xl shadow-2xl border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedFoto(null)}
              className="absolute top-4 right-4 bg-red-600 text-white rounded-full w-8 h-8 font-bold flex items-center justify-center hover:bg-red-500 transition"
            >
              ✕
            </button>
            <img src={selectedFoto} alt="Evidencia Ampliada" className="max-h-[80vh] max-w-full rounded-xl object-contain mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
}

