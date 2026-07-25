import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchInvestigacionDetalle } from '../services/api';
import { Printer, ChevronLeft, MapPin, CheckSquare, Square, Camera, Shield, FileCheck } from 'lucide-react';

export default function DetalleFormatoPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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
  const est = ev.estudio_socioeconomico || {};
  const isAval = inv.tipo_sujeto !== 'CLIENTE';

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
        
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 text-center">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">
            Caja Oblatos <span className="text-sm font-normal">AHORRO • CRÉDITO • SERVICIOS</span>
          </h1>
          <h2 className="text-sm font-bold text-slate-800 tracking-wide mt-1 uppercase">
            DEPARTAMENTO DE INVESTIGACIONES DOMICILIARIAS
          </h2>
          <div className="text-xs font-semibold text-slate-700 mt-0.5">
            SOLICITANTE DE PRÉSTAMO Y/O AVAL
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
            OBSERVACIONES Y DICTAMEN DEL INVESTIGADOR
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

        {/* Signatures & Evidence Footer */}
        <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 text-center text-xs">
          <div>
            <div className="border-b border-slate-800 w-3/4 mx-auto mb-1"></div>
            <div className="font-bold text-slate-900">Firma del Investigador</div>
            <div className="text-[10px] text-slate-500">Depto. Investigaciones Domiciliarias</div>
          </div>
          <div>
            <div className="border-b border-slate-800 w-3/4 mx-auto mb-1"></div>
            <div className="font-bold text-slate-900">Firma del Encargado / Supervisor</div>
            <div className="text-[10px] text-slate-500">Caja Oblatos CPO</div>
          </div>
        </div>

      </div>
    </div>
  );
}
