import React, { useState, useEffect } from 'react';
import { 
  fetchChecklistDocumental, 
  cargarDocumentoExpediente, 
  validarDocumentoExpediente, 
  registrarExcepcionDocumental 
} from '../services/api';

export default function ChecklistDocumentalModal({ solicitudId, tipoCredito = 'GENERAL', onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Estado para el modal de validación / observaciones de un documento específico
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [actionType, setActionType] = useState('VALIDAR'); // 'VALIDAR', 'CARGAR', 'EXCEPCION'
  const [observaciones, setObservaciones] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [fileUrlInput, setFileUrlInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadChecklist();
  }, [solicitudId, tipoCredito]);

  async function loadChecklist() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchChecklistDocumental(solicitudId, tipoCredito);
      setData(res);
    } catch (err) {
      setError(err.message || 'Error cargando expediente documental');
    } finally {
      setLoading(false);
    }
  }

  async function handleValidarSubmit(estadoValidacion) {
    if (!selectedDoc) return;
    setSubmitting(true);
    try {
      await validarDocumentoExpediente(selectedDoc.id_catalogo || selectedDoc.codigo_documento, {
        estadoValidacion,
        observaciones,
        esLegible: true,
      });
      setSelectedDoc(null);
      setObservaciones('');
      loadChecklist();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExcepcionSubmit() {
    if (!selectedDoc || !justificacion.trim()) {
      alert('Debes ingresar una justificación detallada para la excepción.');
      return;
    }
    setSubmitting(true);
    try {
      await registrarExcepcionDocumental({
        solicitudId,
        codigoDocumento: selectedDoc.codigo_documento,
        justificacion,
      });
      setSelectedDoc(null);
      setJustificacion('');
      loadChecklist();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCargarSubmit() {
    if (!selectedDoc || !fileUrlInput.trim()) {
      alert('Debes ingresar la URL o ruta del documento.');
      return;
    }
    setSubmitting(true);
    try {
      await cargarDocumentoExpediente({
        solicitudId,
        codigoDocumento: selectedDoc.codigo_documento,
        nombreArchivo: `${selectedDoc.codigo_documento}_${Date.now()}.pdf`,
        archivoUrl: fileUrlInput.trim(),
        formatoArchivo: 'PDF',
      });
      setSelectedDoc(null);
      setFileUrlInput('');
      loadChecklist();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const getSemaforoBadge = (semaforo) => {
    switch (semaforo) {
      case 'VERDE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-950">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            🟢 VERDE — EXPEDIENTE COMPLETO Y VALIDADO
          </span>
        );
      case 'AMARILLO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-950">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            🟡 AMARILLO — EN REVISIÓN DE ANÁLISIS
          </span>
        );
      case 'ROJO':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-sm shadow-rose-950">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-bounce"></span>
            🔴 ROJO — FALTAN DOCUMENTOS O FUERON RECHAZADOS
          </span>
        );
    }
  };

  const getEstadoBadge = (estado, esExcepcion) => {
    if (esExcepcion) {
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">⚡ Excepción Registrada</span>;
    }
    switch (estado) {
      case 'APROBADO':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✓ Aprobado</span>;
      case 'RECHAZADO':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">✕ Rechazado</span>;
      case 'PENDIENTE':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">⏳ Pendiente Revisión</span>;
      case 'NO_CARGADO':
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-700/60 text-slate-400 border border-slate-600/30">⚠ Sin Cargar</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-100">Checklist e Integridad del Expediente Digital</h2>
              <span className="text-xs px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Solicitud #{solicitudId}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Control Inteligente de Documentación por Tipo de Crédito ({tipoCredito})</p>
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
              Cargando checklist documental y evaluando semáforo...
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Banner Semáforo Visual */}
              <div className="p-4 rounded-xl border bg-slate-950/40 border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Estado de Integridad Documental</div>
                  <div className="text-sm font-medium text-slate-200">{data.semaforo_mensaje}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Avance: <span className="text-emerald-400 font-bold">{data.total_aprobados}</span> de <span className="text-slate-300 font-bold">{data.total_requeridos}</span> documentos obligatorios aprobados
                  </div>
                </div>
                <div>{getSemaforoBadge(data.semaforo)}</div>
              </div>

              {/* Tabla de Documentos */}
              <div className="overflow-hidden border border-slate-800 rounded-xl bg-slate-950/20">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 uppercase font-semibold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Documento</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Estatus</th>
                      <th className="p-3">Legibilidad / Obs</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {data.documentos.map((doc) => (
                      <tr key={doc.codigo_documento} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-slate-200">{doc.nombre_documento}</div>
                          <div className="text-[11px] text-slate-400">{doc.descripcion}</div>
                        </td>
                        <td className="p-3">
                          {doc.obligatorio ? (
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">OBLIGATORIO</span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded">OPCIONAL</span>
                          )}
                        </td>
                        <td className="p-3">
                          {getEstadoBadge(doc.estado_validacion, doc.es_excepcion)}
                        </td>
                        <td className="p-3 max-w-xs text-slate-400">
                          {doc.observaciones_analista && (
                            <div className="text-amber-300 text-[11px] italic">" {doc.observaciones_analista} "</div>
                          )}
                          {doc.justificacion_excepcion && (
                            <div className="text-purple-300 text-[11px] italic">Motivo exc: " {doc.justificacion_excepcion} "</div>
                          )}
                          {!doc.observaciones_analista && !doc.justificacion_excepcion && (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {/* Botón Cargar */}
                          <button
                            onClick={() => { setSelectedDoc(doc); setActionType('CARGAR'); }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          >
                            📁 {doc.cargado ? 'Reemplazar' : 'Cargar'}
                          </button>

                          {/* Botón Validar / Analizar */}
                          <button
                            onClick={() => { setSelectedDoc(doc); setActionType('VALIDAR'); }}
                            className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-colors"
                          >
                            🔍 Validar
                          </button>

                          {/* Botón Excepción */}
                          <button
                            onClick={() => { setSelectedDoc(doc); setActionType('EXCEPCION'); }}
                            className="px-2.5 py-1 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-colors"
                            title="Registrar entrega física posterior con justificación"
                          >
                            ⚡ Excepción
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Submodal para Ejecutar Acción */}
              {selectedDoc && (
                <div className="p-5 border border-slate-700 bg-slate-900 rounded-xl space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-bold text-slate-200">
                      {actionType === 'VALIDAR' && `🔍 Evaluar Documento: ${selectedDoc.nombre_documento}`}
                      {actionType === 'CARGAR' && `📁 Adjuntar Archivo: ${selectedDoc.nombre_documento}`}
                      {actionType === 'EXCEPCION' && `⚡ Justificar Excepción: ${selectedDoc.nombre_documento}`}
                    </h3>
                    <button onClick={() => setSelectedDoc(null)} className="text-slate-400 hover:text-slate-200">✕</button>
                  </div>

                  {actionType === 'VALIDAR' && (
                    <div className="space-y-3 text-sm">
                      <label className="block text-slate-300 font-medium">Observaciones del Analista:</label>
                      <textarea
                        rows={2}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Ej. El documento es perfectamente legible / Ej. La imagen está desenfocada"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex gap-3 justify-end pt-2">
                        <button
                          disabled={submitting}
                          onClick={() => handleValidarSubmit('RECHAZADO')}
                          className="px-4 py-2 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-200 font-medium border border-rose-500/40 transition-colors"
                        >
                          ✕ Rechazar Documento
                        </button>
                        <button
                          disabled={submitting}
                          onClick={() => handleValidarSubmit('APROBADO')}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 shadow-md shadow-emerald-950 transition-colors"
                        >
                          ✓ Aprobar Documento
                        </button>
                      </div>
                    </div>
                  )}

                  {actionType === 'CARGAR' && (
                    <div className="space-y-3 text-sm">
                      <label className="block text-slate-300 font-medium">Ruta / URL del Documento Escaneado:</label>
                      <input
                        type="text"
                        value={fileUrlInput}
                        onChange={(e) => setFileUrlInput(e.target.value)}
                        placeholder="https://servidor.cajaoblatos.com/expedientes/ine_001.pdf"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
                      />
                      <div className="flex gap-3 justify-end pt-2">
                        <button
                          disabled={submitting}
                          onClick={handleCargarSubmit}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors"
                        >
                          Guardar en Expediente
                        </button>
                      </div>
                    </div>
                  )}

                  {actionType === 'EXCEPCION' && (
                    <div className="space-y-3 text-sm">
                      <label className="block text-slate-300 font-medium">Motivo Auditado de la Excepción (Entrega Física en Sucursal):</label>
                      <textarea
                        rows={2}
                        value={justificacion}
                        onChange={(e) => setJustificacion(e.target.value)}
                        placeholder="Ej. El cliente entregará el comprobante físico al momento de la firma en sucursal."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                      />
                      <div className="flex gap-3 justify-end pt-2">
                        <button
                          disabled={submitting}
                          onClick={handleExcepcionSubmit}
                          className="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 transition-colors"
                        >
                          Registrar Excepción
                        </button>
                      </div>
                    </div>
                  )}
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
