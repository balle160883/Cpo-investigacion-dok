import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { io } from 'socket.io-client';
import { fetchInvestigaciones, fetchUbicacionesInvestigadores, fetchInvestigadores, asignarInvestigadorLote } from '../services/api';
import { Navigation, UserCheck, RefreshCw, Layers, Wifi, CheckSquare, Square, MapPin, UserPlus, X, ShieldAlert } from 'lucide-react';
import Toast from '../components/Toast';

// Mapbox Token from configuration
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MapaPage() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const socketRef = useRef(null);
  const invMarkersRef = useRef(new Map());
  const reqMarkersRef = useRef(new Map());
  const [investigadores, setInvestigadores] = useState([]);
  const [investigadoresCatalogo, setInvestigadoresCatalogo] = useState([]);
  const [investigaciones, setInvestigaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Estados para Asignación Inteligente en Lote por Zona
  const [loteMode, setLoteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [targetInvestigadorId, setTargetInvestigadorId] = useState('');
  const [assigningLote, setAssigningLote] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [radiusKm, setRadiusKm] = useState(5);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-103.3496, 20.6597], // Guadalajara centro
      zoom: 11.5,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    loadMapData();

    // Conectar Socket.io para actualización instantánea vía WebSockets
    try {
      const socketUrl = API_BASE_URL.replace('/api', '');
      socketRef.current = io(socketUrl, {
        reconnection: true,
        reconnectionDelay: 2000,
      });

      socketRef.current.on('connect', () => {
        setWsConnected(true);
      });

      socketRef.current.on('disconnect', () => {
        setWsConnected(false);
      });

      socketRef.current.on('ubicacion_actualizada', (data) => {
        loadMapData();
      });
    } catch (e) {
      console.warn('Socket.io error:', e);
    }

    // Auto-refresh posiciones cada 10 segundos como respaldo
    const interval = setInterval(() => {
      loadMapData();
    }, 10000);

    return () => {
      clearInterval(interval);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const centrarEnUbicacion = (lng, lat, title) => {
    if (map.current && lng && lat) {
      map.current.flyTo({
        center: [parseFloat(lng), parseFloat(lat)],
        zoom: 15,
        essential: true,
      });
    }
  };

  async function loadMapData() {
    try {
      // Cargar catálogo de investigadores para la asignación en lote
      try {
        const catInvs = await fetchInvestigadores();
        setInvestigadoresCatalogo(catInvs || []);
        if (catInvs && catInvs.length > 0 && !targetInvestigadorId) {
          setTargetInvestigadorId(catInvs[0].id);
        }
      } catch (e) {}

      // 1. Obtener Investigaciones
      const resInv = await fetchInvestigaciones({ limit: 150 });
      const rawInvs = resInv.data || [];
      setInvestigaciones(rawInvs);

      // Renderizar Marcadores de Investigaciones SOLAMENTE con coordenadas reales
      const activeReqKeys = new Set();
      rawInvs.forEach((item) => {
        const lat = parseFloat(item.latitud);
        const lng = parseFloat(item.longitud);

        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          const key = `req-${item.id_sif_research}`;
          activeReqKeys.add(key);
          const isCompleted = item.estado === 'COMPLETADA';

          if (!reqMarkersRef.current.has(key)) {
            const el = document.createElement('div');
            el.className = `req-marker-${item.id_sif_research}`;
            el.style.width = '28px';
            el.style.height = '28px';
            el.style.borderRadius = '50%';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.fontSize = '11px';
            el.style.fontWeight = 'bold';
            el.style.color = '#ffffff';
            el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
            el.style.cursor = 'pointer';
            el.style.border = '2px solid #ffffff';
            el.style.backgroundColor = isCompleted ? '#10b981' : '#0284c7';
            el.innerText = item.tipo_sujeto === 'CLIENTE' ? 'S' : 'A';

            const marker = new mapboxgl.Marker(el)
              .setLngLat([lng, lat])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 }).setHTML(`
                  <div style="color: #0f172a; padding: 6px; font-family: sans-serif;">
                    <div style="font-size: 10px; font-weight: bold; color: ${isCompleted ? '#059669' : '#0284c7'}; text-transform: uppercase;">
                      ${item.tipo_sujeto === 'CLIENTE' ? 'Solicitante' : 'Aval'} • ${item.estado}
                    </div>
                    <strong style="font-size: 13px; color: #0f172a;">${item.sujeto_nombre || 'Socio'}</strong><br/>
                    <span style="font-size: 11px; color: #475569;">📍 ${item.calle || 'Calle N/A'} #${item.numero_exterior || ''}</span><br/>
                    <span style="font-size: 10px; color: #64748b;">Colonia: ${item.colonia || 'S/N'}</span><br/>
                    <span style="font-size: 10px; color: #0284c7; font-weight: bold;">Investigador: ${item.investigador_nombre || 'Sin Asignar'}</span>
                  </div>
                `)
              )
              .addTo(map.current);
            reqMarkersRef.current.set(key, marker);
          } else {
            reqMarkersRef.current.get(key).setLngLat([lng, lat]);
          }
        }
      });

      // 2. Obtener Ubicaciones de Investigadores Activos
      const ubics = await fetchUbicacionesInvestigadores();
      const listInvestigadores = Array.isArray(ubics) ? ubics : [];
      setInvestigadores(listInvestigadores);

      // Renderizar y Actualizar Marcadores de Investigadores con Movimiento Animado Suave
      const activeInvKeys = new Set();
      listInvestigadores.forEach((inv) => {
        const lat = parseFloat(inv.latitud);
        const lng = parseFloat(inv.longitud);

        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          const key = `inv-${inv.investigador_id}`;
          activeInvKeys.add(key);
          const isOnline = inv.en_linea;

          if (!invMarkersRef.current.has(key)) {
            const el = document.createElement('div');
            el.className = 'custom-inv-marker';
            el.style.width = '38px';
            el.style.height = '38px';
            el.style.borderRadius = '50%';
            el.style.backgroundColor = isOnline ? '#059669' : '#64748b';
            el.style.border = '3px solid #ffffff';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.color = '#ffffff';
            el.style.boxShadow = isOnline ? '0 0 16px rgba(16, 185, 129, 0.8)' : '0 4px 12px rgba(0,0,0,0.4)';
            el.style.cursor = 'pointer';
            el.style.transition = 'transform 0.8s ease-out, background-color 0.5s ease';
            el.innerHTML = `
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            `;

            const marker = new mapboxgl.Marker(el)
              .setLngLat([lng, lat])
              .setPopup(
                new mapboxgl.Popup({ offset: 25 }).setHTML(`
                  <div style="color: #0f172a; padding: 6px; font-family: sans-serif;">
                    <div style="font-size: 10px; font-weight: bold; color: ${isOnline ? '#059669' : '#475569'}; text-transform: uppercase;">
                      ${isOnline ? '📡 INVESTIGADOR EN CAMPO (EN LÍNEA)' : '📍 ÚLTIMA UBICACIÓN CONOCIDA'}
                    </div>
                    <strong style="font-size: 13px; color: #0f172a;">${inv.nombre}</strong><br/>
                    <span style="font-size: 11px; color: #475569;">📞 ${inv.telefono || inv.email}</span><br/>
                    <span style="font-size: 10px; color: ${isOnline ? '#10b981' : '#64748b'}; font-weight: bold;">
                      ${isOnline ? `🔋 Batería: ${inv.bateria_nivel || 100}%` : 'App cerrada / Sin emisión GPS'}
                    </span>
                  </div>
                `)
              )
              .addTo(map.current);

            invMarkersRef.current.set(key, { marker, el });
          } else {
            // Actualización suave de coordenadas sin recrear DOM
            const { marker, el } = invMarkersRef.current.get(key);
            marker.setLngLat([lng, lat]);
            el.style.backgroundColor = isOnline ? '#059669' : '#64748b';
            el.style.boxShadow = isOnline ? '0 0 16px rgba(16, 185, 129, 0.8)' : '0 4px 12px rgba(0,0,0,0.4)';
          }
        }
      });

    } catch (err) {
      console.error('Error cargando mapa:', err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelectId(id) {
    const idStr = String(id);
    setSelectedIds((prev) =>
      prev.includes(idStr) ? prev.filter((item) => item !== idStr) : [...prev, idStr]
    );
  }

  function seleccionarPorRadio(km) {
    if (!map.current) return;
    const center = map.current.getCenter();
    const centerLat = center.lat;
    const centerLng = center.lng;

    const matchedIds = [];
    investigaciones.forEach((item) => {
      const lat = parseFloat(item.latitud);
      const lng = parseFloat(item.longitud);

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        const dist = getDistanceKm(centerLat, centerLng, lat, lng);
        if (dist <= km) {
          matchedIds.push(String(item.id_sif_research));
        }
      }
    });

    setSelectedIds(matchedIds);
    setToast({
      message: `Se seleccionaron ${matchedIds.length} investigaciones en un radio de ${km} km desde el centro del mapa.`,
      type: matchedIds.length > 0 ? 'success' : 'warning',
    });
  }

  async function handleAsignarLoteSubmit() {
    if (selectedIds.length === 0 || !targetInvestigadorId) {
      setToast({ message: 'Selecciona al menos una investigación y un investigador.', type: 'warning' });
      return;
    }

    setAssigningLote(true);
    try {
      const res = await asignarInvestigadorLote(selectedIds, targetInvestigadorId);
      setToast({ message: res.message || `Investigaciones asignadas con éxito.`, type: 'success' });
      setSelectedIds([]);
      setLoteMode(false);
      await loadMapData();
    } catch (err) {
      setToast({ message: 'Error asignando en lote: ' + err.message, type: 'error' });
    } finally {
      setAssigningLote(false);
    }
  }

  return (
    <div className="space-y-4">
      {toast.message && <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />}

      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Navigation className="w-6 h-6 text-sky-400" /> Mapa de Geolocalización en Tiempo Real
          </h2>
          <p className="text-slate-400 text-sm">Monitoreo activo y asignación inteligente por zona geográfica.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setLoteMode(!loteMode)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
              loteMode
                ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500 shadow-lg shadow-sky-600/30 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-sky-300" />
            {loteMode ? 'Cancelar Asignación en Lote' : 'Modo Asignación en Lote'}
          </button>

          <button
            onClick={loadMapData}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar Ubicaciones
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
            <Wifi className={`w-3.5 h-3.5 ${wsConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span className={wsConnected ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
              {wsConnected ? 'Live Sockets' : 'Polling'}
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar para Filtrado por Radio Geográfico cuando está activo el Modo Lote */}
      {loteMode && (
        <div className="bg-slate-900 border border-sky-500/50 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Seleccionar por Radio desde Centro del Mapa:
            </span>
            <div className="flex items-center gap-2">
              {[2, 5, 10, 15].map((km) => (
                <button
                  key={km}
                  onClick={() => {
                    setRadiusKm(km);
                    seleccionarPorRadio(km);
                  }}
                  className="bg-slate-800 hover:bg-sky-600 text-white border border-slate-700 text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                >
                  📍 {km} km
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-3">
            <span>Seleccionadas: <strong className="text-white font-mono text-sm">{selectedIds.length}</strong></span>
            {selectedIds.length > 0 && (
              <button
                onClick={() => setSelectedIds([])}
                className="text-rose-400 hover:underline text-xs flex items-center gap-1 font-semibold"
              >
                <X className="w-3.5 h-3.5" /> Desmarcar Todo
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Container with Sidebar & Map */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-14rem)] min-h-[500px]">
        {/* Sidebar Left: Active Investigators List */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col space-y-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-400" /> Investigadores ({investigadores.length})
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">
              {investigadores.filter((inv) => inv.en_linea).length} EN LÍNEA
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {investigadores.length > 0 ? (
              investigadores.map((inv, i) => (
                <div
                  key={i}
                  onClick={() => {
                    if (inv.latitud && inv.longitud) {
                      setSelectedItem(inv);
                      centrarEnUbicacion(inv.longitud, inv.latitud, inv.nombre);
                    }
                  }}
                  className={`p-3 border rounded-xl cursor-pointer transition space-y-1 ${
                    inv.en_linea
                      ? 'bg-slate-800/80 hover:bg-slate-800 border-emerald-500/50 hover:border-emerald-400 shadow-md'
                      : 'bg-slate-900/60 hover:bg-slate-800/40 border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${inv.en_linea ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                      {inv.nombre}
                    </span>
                    {inv.en_linea ? (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">
                        {inv.bateria_nivel || 100}% 🔋
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500 uppercase font-semibold">
                        Desconectado
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>{inv.telefono || 'Investigador CPO'}</span>
                    {inv.en_linea && inv.latitud && (
                      <span className="text-[10px] text-sky-400 hover:underline font-semibold">📍 Centrar en Mapa</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-xs text-slate-500 py-8 italic">
                Cargando lista de investigadores...
              </div>
            )}

            <div className="pt-3 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                📍 Visitas Disponibles ({investigaciones.length})
              </span>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {investigaciones.map((inv, idx) => {
                  const idStr = String(inv.id_sif_research);
                  const isSelected = selectedIds.includes(idStr);
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (loteMode) {
                          toggleSelectId(idStr);
                        } else {
                          centrarEnUbicacion(inv.longitud, inv.latitud, inv.sujeto_nombre);
                        }
                      }}
                      className={`p-2.5 text-[11px] rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-sky-900/60 border-sky-400 text-white shadow-lg'
                          : 'bg-slate-800/40 hover:bg-slate-800 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate max-w-[170px]">
                        {loteMode && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectId(idStr)}
                            className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                          />
                        )}
                        <span className="font-semibold truncate">{inv.sujeto_nombre}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${inv.estado === 'COMPLETADA' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'}`}>
                        {inv.estado}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Map Container Right */}
        <div className="lg:col-span-3 relative w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
          <div ref={mapContainer} className="w-full h-full" />

          {/* Panel Flotante Inferior para Confirmar Asignación en Lote */}
          {selectedIds.length > 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md border border-sky-500/60 px-6 py-4 rounded-2xl shadow-2xl flex flex-wrap items-center gap-4 z-10 max-w-xl w-[90%]">
              <div className="flex-1">
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4" /> Asignación Inteligente en Lote
                </span>
                <p className="text-xs text-slate-300">
                  <strong className="text-white font-mono">{selectedIds.length}</strong> investigaciones seleccionadas por zona.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={targetInvestigadorId}
                  onChange={(e) => setTargetInvestigadorId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="">Seleccionar Investigador...</option>
                  {investigadoresCatalogo.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.nombre} ({inv.rol || 'investigador'})
                    </option>
                  ))}
                </select>

                <button
                  disabled={assigningLote || !targetInvestigadorId}
                  onClick={handleAsignarLoteSubmit}
                  className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-lg shadow-sky-600/30 flex items-center gap-2 whitespace-nowrap"
                >
                  {assigningLote ? 'Asignando...' : `Asignar ${selectedIds.length} en Lote`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

