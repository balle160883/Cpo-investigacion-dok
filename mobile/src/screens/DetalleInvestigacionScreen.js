import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Alert } from 'react-native';
import { getInvestigacionDetalle } from '../api/apiClient';
import { abrirGoogleMapsNativo, abrirWazeNativo } from '../utils/navigationHelper';

export default function DetalleInvestigacionScreen({ route, navigation }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await getInvestigacionDetalle(id);
        setData(res);
      } catch (err) {
        console.log('Error detalle:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <ActivityIndicator size="large" color="#0284c7" style={{ flex: 1, backgroundColor: '#0f172a' }} />;

  const inv = data?.investigacion || {};

  function abrirGoogleMaps() {
    abrirGoogleMapsNativo(inv);
  }

  function abrirWaze() {
    abrirWazeNativo(inv);
  }

  return (


    <ScrollView style={styles.container}>
      <View style={styles.card}>
        {(() => {
          const isAval = inv?.es_aval === true || (inv?.tipo_sujeto || '').toUpperCase().includes('AVAL');
          return (
            <Text style={styles.typeBadge}>
              {isAval ? '🤝 AVAL DE CRÉDITO' : '👤 SOLICITANTE DE PRÉSTAMO'}
            </Text>
          );
        })()}
        <Text style={styles.nombre}>{inv.sujeto_nombre || 'Socio Sin Nombre'}</Text>
        <Text style={styles.meta}>Socio N° {inv.persona_id_sif || 'N/A'} • Solicitud #{inv.solicitud_folio || 'N/A'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Domicilio de la Investigación</Text>
        <Text style={styles.text}>Calle: {inv.calle || 'Sin calle'} #{inv.numero_exterior || ''} {inv.numero_interior ? `Int ${inv.numero_interior}` : ''}</Text>
        <Text style={styles.text}>Colonia: {inv.colonia || 'Sin colonia'}</Text>
        <Text style={styles.text}>Municipio / Estado: {inv.municipio || 'Guadalajara'}, {inv.estado_provincia || 'Jalisco'}</Text>
        <Text style={styles.text}>Código Postal: {inv.codigo_postal || 'N/A'}</Text>
        <Text style={styles.text}>Referencias: {inv.referencias || 'Sin referencias'}</Text>

        <Text style={styles.navLabel}>📍 Abrir en Navegación:</Text>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.googleBtn} onPress={abrirGoogleMaps}>
            <Text style={styles.googleBtnText}>🗺️ Google Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.wazeBtn} onPress={abrirWaze}>
            <Text style={styles.wazeBtnText}>🚙 Waze</Text>
          </TouchableOpacity>
        </View>
      </View>

      {inv.estado === 'COMPLETADA' ? (
        <View style={{ backgroundColor: '#1e293b', borderLeftWidth: 4, borderLeftColor: '#10b981', padding: 16, borderRadius: 12, marginTop: 8, marginBottom: 40 }}>
          <Text style={{ color: '#10b981', fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>
            🔒 INVESTIGACIÓN COMPLETADA Y BLOQUEADA
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
            Esta visita ya fue guardada con evidencias, fotos y firmas. No se puede modificar salvo que un supervisor la reasigne.
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.capturaButton}
          onPress={() => navigation.navigate('CapturaFormato', { id, inv })}
        >
          <Text style={styles.capturaButtonText}>📋 Capturar Estudio Socio-Económico</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  typeBadge: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  nombre: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  section: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#ffffff', marginBottom: 12 },
  text: { color: '#cbd5e1', fontSize: 13, marginBottom: 6 },
  navLabel: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginTop: 12, marginBottom: 8 },
  navRow: { flexDirection: 'row', gap: 10 },
  // Google Maps: azul corporativo de Google
  googleBtn: {
    flex: 1,
    backgroundColor: '#1A73E8',
    padding: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1557B0',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  googleBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  // Waze: color cian/turquesa característico de Waze
  wazeBtn: {
    flex: 1,
    backgroundColor: '#1CA5F5',
    padding: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0E8DD4',
    shadowColor: '#1CA5F5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  wazeBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  capturaButton: { backgroundColor: '#10b981', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8, marginBottom: 40 },
  capturaButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
});

