import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { io } from 'socket.io-client';
import { fetchInvestigaciones, fetchUbicacionesInvestigadores } from '../services/api';
import { Navigation, UserCheck, RefreshCw, Layers, Wifi } from 'lucide-react';

// Mapbox Token from configuration
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function MapaPage() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const socketRef = useRef(null);
  const invMarkersRef = useRef(new Map());
  const reqMarkersRef = useRef(new Map());
  const [investigadores, setInvestigadores] = useState([]);
  const [investigaciones, setInvestigaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

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
      // 1. Obtener Investigaciones
      const resInv = await fetchInvestigaciones({ limit: 100 });
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
                    <span style="font-size: 10px; color: #64748b;">Colonia: ${item.colonia || 'S/N'}</span>
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

  return (
    <div className="space-y-4">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Navigation className="w-6 h-6 text-sky-400" /> Mapa de Geolocalización en Tiempo Real
          </h2>
          <p className="text-slate-400 text-sm">Monitoreo activo de investigadores y visitas domiciliarias en Guadalajara.</p>
        </div>

        <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
            <span className="w-3 h-3 rounded-full bg-sky-500"></span> Solicitante / Aval
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span> Investigador Activo
          </div>
        </div>
      </div>

      {/* Main Container with Sidebar & Map */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-12rem)] min-h-[500px]">
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
                📍 Visitas Recientes ({investigaciones.length})
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {investigaciones.slice(0, 10).map((inv, idx) => (
                  <div
                    key={idx}
                    onClick={() => centrarEnUbicacion(inv.lng, inv.lat, inv.sujeto_nombre)}
                    className="p-2 text-[11px] bg-slate-800/40 hover:bg-slate-800 rounded-lg border border-slate-800 cursor-pointer flex items-center justify-between"
                  >
                    <span className="text-slate-200 font-semibold truncate max-w-[140px]">{inv.sujeto_nombre}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${inv.estado === 'COMPLETADA' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'}`}>
                      {inv.estado}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Map Container Right */}
        <div className="lg:col-span-3 relative w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
          <div ref={mapContainer} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}

