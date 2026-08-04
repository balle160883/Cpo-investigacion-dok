import React, { useState, useEffect } from 'react';
import { 
  fetchNotificacionesSolicitud, 
  enviarNotificacionInterareas, 
  registrarAcuseLecturaNotificacion, 
  marcarRequerimientoAtendidoApi 
} from '../services/api';

export default function NotificacionesInterareasModal({ solicitudId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Formulario nueva notificación
  const [showNueva, setShowNueva] = useState(false);
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [remitenteArea, setRemitenteArea] = useState('ANALISIS');
  const [destinatarioArea, setDestinatarioArea] = useState('SUCURSAL');
  const [tipoNotificacion, setTipoNotificacion] = useState('DEVOLUCION_DOCUMENTAL');
  const [plazoHoras, setPlazoHoras] = useState(24);
  const [submitting, setSubmitting] = useState(false);

  // Modal Atender Requerimiento
  const [selectedNotifAtender, setSelectedNotifAtender] = useState(null);
  const [respuestaAtencion, setRespuestaAtencion] = useState('');

  useEffect(() => {
    loadNotificaciones();
  }, [solicitudId]);

  async function loadNotificaciones() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchNotificacionesSolicitud(solicitudId);
      setData(res);
    } catch (err) {
      setError(err.message || 'Error al cargar historial de notificaciones');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnviarSubmit(e) {
    e.preventDefault();
    if (!asunto.trim() || !mensaje.trim()) {
      alert('Por favor completa el asunto y mensaje.');
      return;
    }
    setSubmitting(true);
    try {
      await enviarNotificacionInterareas({
        solicitudId,
        remitenteArea,
        destinatarioArea,
        tipoNotificacion,
        asunto: asunto.trim(),
        mensaje: mensaje.trim(),
        plazoLimiteHoras: Number(plazoHoras),
      });
      setAsunto('');
      setMensaje('');
      setShowNueva(false);
      loadNotificaciones();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAcuse(id) {
    try {
      await registrarAcuseLecturaNotificacion(id);
      loadNotificaciones();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleAtenderSubmit() {
    if (!selectedNotifAtender || !respuestaAtencion.trim()) {
      alert('Ingresa la respuesta detallada de cómo se atendió el requerimiento.');
      return;
    }
    setSubmitting(true);
    try {
      await marcarRequerimientoAtendidoApi(selectedNotifAtender.id, respuestaAtencion.trim());
      setSelectedNotifAtender(null);
      setRespuestaAtencion('');
      loadNotificaciones();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-100">Comunicación Interáreas & Histórico de Devoluciones</h2>
              <span className="text-xs px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Solicitud #{solicitudId}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Trazabilidad completa entre Análisis, Sucursal y Operaciones (Folios 004 y 009)</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {loading ? (
            <div className="py-16 text-center text-slate-400 animate-pulse">
              Cargando historial de notificaciones y acuses...
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Banner de Alerta por Devoluciones Vencidas */}
              {data.requiere_atencion_urgente && (
                <div className="p-4 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 flex items-center justify-between shadow-lg shadow-rose-950">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚨</span>
                    <div>
                      <div className="font-bold text-sm">¡Alerta de Devolución Vencida!</div>
                      <div className="text-xs text-rose-400/90">Existen <span className="font-bold">{data.total_vencidos}</span> observaciones que superaron el plazo de {24}h sin respuesta de la sucursal.</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Contadores */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Total Mensajes</div>
                  <div className="text-xl font-bold text-slate-100">{data.total_notificaciones}</div>
                </div>
                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <div className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold">Pendientes Atención</div>
                  <div className="text-xl font-bold text-amber-300">{data.pendientes_atencion}</div>
                </div>
                <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5">
                  <div className="text-[11px] uppercase tracking-wider text-rose-400 font-semibold">Observaciones Vencidas</div>
                  <div className="text-xl font-bold text-rose-300">{data.total_vencidos}</div>
                </div>
              </div>

              {/* Botón Abrir Formulario Nueva Notificación */}
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Historial del Expediente</h3>
                <button
                  onClick={() => setShowNueva(!showNueva)}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-md shadow-blue-900"
                >
                  {showNueva ? '✕ Cancelar' : '✉ Redactar Notificación / Observación'}
                </button>
              </div>

              {/* Formulario Nueva Notificación */}
              {showNueva && (
                <form onSubmit={handleEnviarSubmit} className="p-5 border border-slate-700 bg-slate-950/80 rounded-xl space-y-4 shadow-xl">
                  <h4 className="font-bold text-blue-400 text-sm">Enviar Comunicación Interáreas</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Área Remitente:</label>
                      <select
                        value={remitenteArea}
                        onChange={(e) => setRemitenteArea(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                      >
                        <option value="ANALISIS">Análisis de Crédito</option>
                        <option value="SUCURSAL">Sucursal Operativa</option>
                        <option value="OPERATIVA">Seguimiento Operativo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Área Destino:</label>
                      <select
                        value={destinatarioArea}
                        onChange={(e) => setDestinatarioArea(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                      >
                        <option value="SUCURSAL">Sucursal Operativa</option>
                        <option value="ANALISIS">Análisis de Crédito</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-medium mb-1">Tipo de Notificación:</label>
                      <select
                        value={tipoNotificacion}
                        onChange={(e) => setTipoNotificacion(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                      >
                        <option value="DEVOLUCION_DOCUMENTAL">Devolución Documental</option>
                        <option value="OBSERVACION">Observación General</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-xs font-medium mb-1">Asunto / Título:</label>
                    <input
                      type="text"
                      value={asunto}
                      onChange={(e) => setAsunto(e.target.value)}
                      placeholder="Ej. Inconsistencia en Comprobante de Domicilio"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-xs font-medium mb-1">Mensaje / Detalle de Observaciones:</label>
                    <textarea
                      rows={3}
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      placeholder="Describe claramente la observación o corrección solicitada..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-xs"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Plazo límite de respuesta:</span>
                      <input
                        type="number"
                        value={plazoHoras}
                        onChange={(e) => setPlazoHoras(e.target.value)}
                        className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-center font-bold text-slate-200"
                      />
                      <span>horas</span>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
                    >
                      Enviar Notificación
                    </button>
                  </div>
                </form>
              )}

              {/* Lista del Historial de Comunicaciones */}
              <div className="space-y-4">
                {data.notificaciones.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                    No hay notificaciones ni observaciones registradas para esta solicitud.
                  </div>
                ) : (
                  data.notificaciones.map((n) => (
                    <div 
                      key={n.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        n.vencido 
                          ? 'bg-rose-950/20 border-rose-500/40' 
                          : n.tipo_notificacion === 'REQUERIMIENTO_ATENDIDO' 
                          ? 'bg-emerald-950/20 border-emerald-500/30' 
                          : 'bg-slate-950/40 border-slate-800'
                      }`}
                    >
                      {/* Header Notificación */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100 text-sm">{n.asunto}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              n.tipo_notificacion === 'DEVOLUCION_DOCUMENTAL' 
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                : n.tipo_notificacion === 'REQUERIMIENTO_ATENDIDO' 
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                : 'bg-slate-800 text-slate-300'
                            }`}>
                              {n.tipo_notificacion}
                            </span>
                            {n.vencido && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                ⚠ VENCIDO ({n.plazo_limite_horas}h)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            De: <strong className="text-slate-200">{n.remitente_nombre} ({n.remitente_area})</strong> ➔ Para: <strong className="text-slate-200">{n.destinatario_area}</strong> • {new Date(n.fecha_envio).toLocaleString()}
                          </div>
                        </div>

                        {/* Estado Acuse & Atendido */}
                        <div className="text-right flex flex-col items-end gap-1">
                          {n.leido ? (
                            <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              ✓ Acuse de Lectura: {n.usuario_lectura || 'Confirmado'} ({new Date(n.fecha_lectura).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAcuse(n.id)}
                              className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded transition-colors"
                            >
                              👁 Confirmar Acuse de Lectura
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Mensaje */}
                      <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 my-2 leading-relaxed">
                        {n.mensaje}
                      </p>

                      {/* Si fue atendidio */}
                      {n.atendido && (
                        <div className="mt-3 p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-emerald-400">
                            <span>✓ REQUERIMIENTO ATENDIDO POR SUCURSAL</span>
                            <span className="text-[10px] text-slate-400 font-normal">({new Date(n.fecha_atencion).toLocaleString()})</span>
                          </div>
                          <div>Atendido por: <strong>{n.usuario_atencion}</strong></div>
                          <div className="italic text-emerald-300/90">Respuesta: " {n.respuesta_atencion} "</div>
                        </div>
                      )}

                      {/* Botón Marcar Requerimiento Atendido (Folio 009) */}
                      {!n.atendido && n.tipo_notificacion === 'DEVOLUCION_DOCUMENTAL' && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => { setSelectedNotifAtender(n); setRespuestaAtencion(''); }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow-md shadow-emerald-950 flex items-center gap-1.5"
                          >
                            <span>🔄</span> Marcar Requerimiento Atendido (Sucursal)
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Submodal para Responder Requerimiento Atendido */}
              {selectedNotifAtender && (
                <div className="p-5 border border-emerald-500/40 bg-slate-950 rounded-xl space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-bold text-emerald-400 text-sm">
                      🔄 Responder y Marcar como Requerimiento Atendido
                    </h3>
                    <button onClick={() => setSelectedNotifAtender(null)} className="text-slate-400 hover:text-slate-200">✕</button>
                  </div>

                  <div className="text-xs text-slate-300">
                    Estás respondiendo a la devolución: <strong className="text-white">"{selectedNotifAtender.asunto}"</strong>
                  </div>

                  <div>
                    <label className="block text-slate-300 text-xs font-medium mb-1">Evidencia / Respuesta de Solución por la Sucursal:</label>
                    <textarea
                      rows={3}
                      value={respuestaAtencion}
                      onChange={(e) => setRespuestaAtencion(e.target.value)}
                      placeholder="Ej. Se actualizó el comprobante de domicilio legible con antigüedad menor a 3 meses y se cargó al expediente digital."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-1">
                    <button
                      onClick={() => setSelectedNotifAtender(null)}
                      className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={submitting}
                      onClick={handleAtenderSubmit}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                    >
                      Confirmar y Notificar al Analista
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
}
