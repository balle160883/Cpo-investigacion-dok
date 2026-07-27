import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { fetchInvestigaciones, fetchUbicacionesInvestigadores } from '../services/api';
import { MapPin, Navigation, UserCheck, Layers } from 'lucide-react';

// Mapbox Token from configuration
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export default function MapaPage() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const [invCount, setInvCount] = useState(0);
  const [investigadores, setInvestigadores] = useState([]);

  useEffect(() => {
    if (map.current) return; // initialize map only once

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-103.3496, 20.6597], // Guadalajara / Oblatos coordinates default
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    loadMapData();

    // Refresh investigator positions every 15 seconds
    const interval = setInterval(() => {
      loadMapData();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  async function loadMapData() {
    try {
      // Clear existing markers before placing updated ones
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // 1. Fetch investigations with coordinates
      const res = await fetchInvestigaciones({ limit: 100 });
      const data = res.data || [];
      setInvCount(data.length);

      data.forEach((item) => {
        if (item.latitud && item.longitud) {
          const isCompleted = item.estado === 'COMPLETADA';
          const el = document.createElement('div');
          el.className = `w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg cursor-pointer transition transform hover:scale-125 ${
            isCompleted ? 'bg-emerald-500 border-2 border-emerald-300' : 'bg-sky-500 border-2 border-sky-300'
          }`;
          el.innerText = item.tipo_sujeto === 'CLIENTE' ? 'S' : 'A';

          const marker = new mapboxgl.Marker(el)
            .setLngLat([parseFloat(item.longitud), parseFloat(item.latitud)])
            .setPopup(
              new mapboxgl.Popup({ offset: 25 }).setHTML(`
                <div style="color: #0f172a; padding: 4px;">
                  <strong style="font-size: 12px;">${item.sujeto_nombre || 'Socio'}</strong><br/>
                  <span style="font-size: 11px; color: #475569;">Folio: ${item.solicitud_folio || item.id_sif_research}</span><br/>
                  <span style="font-size: 10px; color: #0284c7; font-weight: bold;">${item.estado}</span>
                </div>
              `)
            )
            .addTo(map.current);
          markersRef.current.push(marker);
        }
      });

      // 2. Fetch live investigator locations
      const ubics = await fetchUbicacionesInvestigadores();
      setInvestigadores(ubics || []);

      ubics.forEach((inv) => {
        if (inv.latitud && inv.longitud) {
          const el = document.createElement('div');
          el.className = 'w-9 h-9 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white shadow-xl animate-pulse cursor-pointer';
          el.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>`;

          const marker = new mapboxgl.Marker(el)
            .setLngLat([parseFloat(inv.longitud), parseFloat(inv.latitud)])
            .setPopup(
              new mapboxgl.Popup({ offset: 25 }).setHTML(`
                <div style="color: #0f172a; padding: 4px;">
                  <strong style="font-size: 13px; color: #059669;">📡 ${inv.nombre}</strong><br/>
                  <span style="font-size: 11px;">Batería: ${inv.bateria_nivel}%</span><br/>
                  <span style="font-size: 10px; color: #64748b;">En línea</span>
                </div>
              `)
            )
            .addTo(map.current);
          markersRef.current.push(marker);
        }
      });
    } catch (err) {
      console.error('Error cargando mapa:', err);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Mapa de Geolocalización en Tiempo Real</h2>
          <p className="text-slate-400 text-sm">Monitoreo de ubicaciones de visitas domiciliarias y recorrido de investigadores.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <span className="w-3 h-3 rounded-full bg-sky-500"></span> Visita Solicitante / Aval
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span> Investigador Activo
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative w-full h-[calc(100vh-12rem)] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
        <div ref={mapContainer} className="w-full h-full" />
      </div>
    </div>
  );
}
