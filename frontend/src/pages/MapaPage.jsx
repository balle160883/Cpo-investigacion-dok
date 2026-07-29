import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { fetchInvestigaciones, fetchUbicacionesInvestigadores } from '../services/api';
import { Navigation, UserCheck, RefreshCw, Layers } from 'lucide-react';

// Mapbox Token from configuration
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export default function MapaPage() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const [investigadores, setInvestigadores] = useState([]);
  const [investigaciones, setInvestigaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

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

    // Auto-refresh posiciones cada 15 segundos
    const interval = setInterval(() => {
      loadMapData();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const centrarEnUbicacion = (lng, lat, title) => {
    if (map.current && lng && lat) {
      map.current.flyTo({
        center: [parseFloat(lng), parseFloat(lat)],
        zoom: 14,
        essential: true,
      });
    }
  };

  async function loadMapData() {
    setLoading(true);
    try {
      // Limpiar marcadores previos
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // 1. Obtener Investigaciones
      const resInv = await fetchInvestigaciones({ limit: 100 });
      const rawInvs = resInv.data || [];

      const invsConCoords = rawInvs.map((item, idx) => {
        let lat = parseFloat(item.latitud);
        let lng = parseFloat(item.longitud);

        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
          // Asignar coordenada dispersa en zona metropolitana de Guadalajara si no tiene lat/lng original
          lat = 20.6597 + ((idx % 7) * 0.007 - 0.02);
          lng = -103.3496 + ((idx % 9) * 0.007 - 0.02);
        }
        return { ...item, lat, lng };
      });
      setInvestigaciones(invsConCoords);

      // Renderizar Marcadores de Investigaciones (Azul / Verde)
      invsConCoords.forEach((item) => {
        const isCompleted = item.estado === 'COMPLETADA';
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
          .setLngLat([item.lng, item.lat])
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
        markersRef.current.push(marker);
      });

      // 2. Obtener Ubicaciones de Investigadores Activos
      const ubics = await fetchUbicacionesInvestigadores();
      const listInvestigadores = Array.isArray(ubics) ? ubics : [];
      setInvestigadores(listInvestigadores);

      // Renderizar Marcadores de Investigadores (Verde Esmeralda Pulsante con Icono)
      listInvestigadores.forEach((inv, idx) => {
        let lat = parseFloat(inv.latitud);
        let lng = parseFloat(inv.longitud);

        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
          lat = 20.6597 + (idx * 0.01);
          lng = -103.3496 + (idx * 0.01);
        }

        const el = document.createElement('div');
        el.style.width = '38px';
        el.style.height = '38px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#059669';
        el.style.border = '3px solid #ffffff';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = '#ffffff';
        el.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.8)';
        el.style.cursor = 'pointer';
        el.style.animation = 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite';
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
                <div style="font-size: 10px; font-weight: bold; color: #059669; text-transform: uppercase;">
                  📡 INVESTIGADOR EN CAMPO
                </div>
                <strong style="font-size: 13px; color: #0f172a;">${inv.nombre}</strong><br/>
                <span style="font-size: 11px; color: #475569;">📞 ${inv.telefono || inv.email}</span><br/>
                <span style="font-size: 10px; color: #10b981; font-weight: bold;">🔋 Batería: ${inv.bateria_nivel || 100}%</span>
              </div>
            `)
          )
          .addTo(map.current);
        markersRef.current.push(marker);
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
              EN LÍNEA
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {investigadores.length > 0 ? (
              investigadores.map((inv, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setSelectedItem(inv);
                    centrarEnUbicacion(inv.longitud, inv.latitud, inv.nombre);
                  }}
                  className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/50 rounded-xl cursor-pointer transition space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {inv.nombre}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">
                      {inv.bateria_nivel || 100}% 🔋
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>{inv.telefono || 'Investigador CPO'}</span>
                    <span className="text-[10px] text-sky-400 hover:underline font-semibold">📍 Centrar en Mapa</span>
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

