import React, { useState, useEffect } from 'react';
import { 
  fetchAgendaVisitas, 
  programarOReagendarVisitaApi 
} from '../services/api';

export default function AgendaVisitasModal({ investigacionId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [metricas, setMetricas] = useState({});
  const [error, setError] = useState(null);

  // Filtros
  const [tipoGestion, setTipoGestion] = useState('');
  const [estadoAgenda, setEstadoAgenda] = useState('');
  const [categoriaProducto, setCategoriaProducto] = useState('');

  // Submodal Reagenda / Programación
  const [showProgramar, setShowProgramar] = useState(false);
  const [selectedInvestigacionId, setSelectedInvestigacionId] = useState(investigacionId || '');
  const [fechaProgramada, setFechaProgramada] = useState('');
  const [motivoReagenda, setMotivoReagenda] = useState('');
  const [formTipoGestion, setFormTipoGestion] = useState('INVESTIGACION');
  const [formCategoria, setFormCategoria] = useState('CONSUMO');
  const [formZona, setFormZona] = useState('ZONA_CENTRO');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAgenda();
  }, [tipoGestion, estadoAgenda, categoriaProducto, investigacionId]);

  async function loadAgenda() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (tipoGestion) params.tipoGestion = tipoGestion;
      if (estadoAgenda) params.estadoAgenda = estadoAgenda;
      if (categoriaProducto) params.categoriaProducto = categoriaProducto;
      if (investigacionId) params.buscar = String(investigacionId);

      const res = await fetchAgendaVisitas(params);
      setData(res.data || []);
      setMetricas(res.metricas || {});
    } catch (err) {
      setError(err.message || 'Error al cargar la agenda de visitas');
    } finally {
      setLoading(false);
    }
  }

  async function handleProgramarSubmit(e) {
    e.preventDefault();
    if (!selectedInvestigacionId || !fechaProgramada) {
      alert('Ingresa el ID de la investigación y la fecha/hora programada.');
      return;
    }
    setSubmitting(true);
    try {
      await programarOReagendarVisitaApi({
        investigacionId: selectedInvestigacionId,
        fechaProgramada,
        motivoReagenda: motivoReagenda.trim() || undefined,
        tipoGestion: formTipoGestion,
        categoriaProducto: formCategoria,
        zonaGeografica: formZona,
      });
      setShowProgramar(false);
      setMotivoReagenda('');
      loadAgenda();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'COMPLETADA':
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✓ Completada</span>;
      case 'VENCIDA':
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-sm animate-pulse">⚠ Vencida</span>;
      case 'REAGENDADA':
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">🔄 Reagendada</span>;
      case 'EN_CAMPO':
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">🚗 En Campo</span>;
      case 'PROGRAMADA':
      default:
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">📅 Programada</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-100">Agenda Dinámica y Control de Visitas Domiciliarias</h2>
              {investigacionId && (
                <span className="text-xs px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Filtro ID #{investigacionId}</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">Gestión de Investigación de Crédito & Cobranza, Reagendamiento y Duración de Entrevistas (Folios 001, 005 y 007)</p>
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
              Cargando agenda dinámica y calculando tiempos de entrevista...
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
              {error}
            </div>
          ) : (
            <>
              {/* Tarjetas de Métricas de Agenda */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
                  <div className="text-[10px] uppercase font-semibold text-blue-400">Programadas</div>
                  <div className="text-xl font-bold text-blue-200">{metricas.programadas || 0}</div>
                </div>
                <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/5">
                  <div className="text-[10px] uppercase font-semibold text-purple-400">Reagendadas</div>
                  <div className="text-xl font-bold text-purple-200">{metricas.reagendadas || 0}</div>
                </div>
                <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5">
                  <div className="text-[10px] uppercase font-semibold text-rose-400">Vencidas</div>
                  <div className="text-xl font-bold text-rose-300">{metricas.vencidas || 0}</div>
                </div>
                <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                  <div className="text-[10px] uppercase font-semibold text-emerald-400">Completadas</div>
                  <div className="text-xl font-bold text-emerald-200">{metricas.completadas || 0}</div>
                </div>
                <div className="p-3 rounded-xl border border-sky-500/20 bg-sky-500/5 col-span-2 sm:col-span-1">
                  <div className="text-[10px] uppercase font-semibold text-sky-400">Promedio Duración</div>
                  <div className="text-xl font-bold text-sky-200">{metricas.promedio_duracion_minutos || 0} <span className="text-xs text-slate-400">min</span></div>
                </div>
              </div>

              {/* Barra de Filtros */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Tipo de Gestión:</label>
                    <select
                      value={tipoGestion}
                      onChange={(e) => setTipoGestion(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200"
                    >
                      <option value="">Todas (Investigación + Cobranza)</option>
                      <option value="INVESTIGACION">🔍 Investigación de Crédito</option>
                      <option value="COBRANZA">💰 Gestión de Cobranza</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Estado de Visita:</label>
                    <select
                      value={estadoAgenda}
                      onChange={(e) => setEstadoAgenda(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200"
                    >
                      <option value="">Todos los Estados</option>
                      <option value="PROGRAMADA">Programadas</option>
                      <option value="REAGENDADA">Reagendadas</option>
                      <option value="VENCIDA">Vencidas</option>
                      <option value="COMPLETADA">Completadas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Categoría Producto:</label>
                    <select
                      value={categoriaProducto}
                      onChange={(e) => setCategoriaProducto(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200"
                    >
                      <option value="">Todas las Categorías</option>
                      <option value="CONSUMO">Consumo</option>
                      <option value="COMERCIAL">Comercial</option>
                      <option value="VIVIENDA">Vivienda</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => setShowProgramar(!showProgramar)}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors shadow-md shadow-purple-950"
                >
                  {showProgramar ? '✕ Cancelar' : '📅 Programar / Reagendar Visita'}
                </button>
              </div>

              {/* Formulario Programar / Reagendar */}
              {showProgramar && (
                <form onSubmit={handleProgramarSubmit} className="p-5 border border-purple-500/40 bg-slate-950 rounded-xl space-y-4 shadow-xl">
                  <h4 className="font-bold text-purple-300 text-sm">📅 Programar o Reagendar Visita Domiciliaria</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">ID Investigación:</label>
                      <input
                        type="text"
                        value={selectedInvestigacionId}
                        onChange={(e) => setSelectedInvestigacionId(e.target.value)}
                        placeholder="Ej. 1115902"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Fecha y Hora Programada:</label>
                      <input
                        type="datetime-local"
                        value={fechaProgramada}
                        onChange={(e) => setFechaProgramada(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Tipo de Gestión:</label>
                      <select
                        value={formTipoGestion}
                        onChange={(e) => setFormTipoGestion(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                      >
                        <option value="INVESTIGACION">🔍 Investigación de Crédito</option>
                        <option value="COBRANZA">💰 Gestión de Cobranza</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">Categoría del Producto:</label>
                      <select
                        value={formCategoria}
                        onChange={(e) => setFormCategoria(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                      >
                        <option value="CONSUMO">Consumo</option>
                        <option value="COMERCIAL">Comercial</option>
                        <option value="VIVIENDA">Vivienda</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Zona Geográfica:</label>
                      <select
                        value={formZona}
                        onChange={(e) => setFormZona(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                      >
                        <option value="ZONA_CENTRO">Guadalajara Centro / Oblatos</option>
                        <option value="ZONA_NORTE">Zapopan Norte</option>
                        <option value="ZONA_SUR">Tlaquepaque / Tonalá</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Motivo de Reagenda (Obligatorio en caso de cambio de fecha):</label>
                    <textarea
                      rows={2}
                      value={motivoReagenda}
                      onChange={(e) => setMotivoReagenda(e.target.value)}
                      placeholder="Ej. Solicitante solicitó cambio de horario por motivos laborales / Domicilio sin personas presentes."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-colors"
                    >
                      Confirmar Programación / Reagenda
                    </button>
                  </div>
                </form>
              )}

              {/* Tabla de Visitas Programadas */}
              <div className="overflow-hidden border border-slate-800 rounded-xl bg-slate-950/20">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/80 uppercase font-semibold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Sujeto / Folio</th>
                      <th className="p-3">Gestión / Producto</th>
                      <th className="p-3">Fecha Programada</th>
                      <th className="p-3">Estatus</th>
                      <th className="p-3">Duración Entrevista</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {data.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                          No hay visitas registradas con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      data.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3">
                            <div className="font-semibold text-slate-100">{row.sujeto_nombre || `Investigación #${row.investigacion_id_sif}`}</div>
                            <div className="text-[11px] text-slate-400">Folio: {row.solicitud_folio || '—'} • {row.calle || ''} {row.numero_exterior || ''}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.tipo_gestion === 'COBRANZA' 
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}>
                              {row.tipo_gestion === 'COBRANZA' ? '💰 COBRANZA' : '🔍 INVESTIGACIÓN'}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-1">{row.categoria_producto} • {row.zona_geografica}</div>
                          </td>
                          <td className="p-3 font-mono text-slate-200">
                            {new Date(row.fecha_programada).toLocaleString()}
                          </td>
                          <td className="p-3">
                            {getEstadoBadge(row.estado_agenda)}
                          </td>
                          <td className="p-3">
                            {row.duracion_minutos > 0 ? (
                              <div className="font-bold text-emerald-400 font-mono text-xs">
                                ⏱ {row.duracion_minutos} min
                                <div className="text-[10px] text-slate-400 font-normal">
                                  {new Date(row.hora_inicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(row.hora_fin).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedInvestigacionId(row.investigacion_id_sif);
                                setFormTipoGestion(row.tipo_gestion || 'INVESTIGACION');
                                setFormCategoria(row.categoria_producto || 'CONSUMO');
                                setShowProgramar(true);
                              }}
                              className="px-2.5 py-1 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-colors"
                            >
                              🔄 Reagendar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
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
