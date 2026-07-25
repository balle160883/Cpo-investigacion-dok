import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { getInvestigacionDetalle } from '../api/apiClient';

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

  function abrirNavegacion() {
    const lat = inv.latitud || 20.6597;
    const lng = inv.longitud || -103.3496;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url);
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.typeBadge}>{inv.tipo_sujeto === 'CLIENTE' ? 'SOLICITANTE DE PRÉSTAMO' : 'AVAL DE PRÉSTAMO'}</Text>
        <Text style={styles.nombre}>{inv.sujeto_nombre}</Text>
        <Text style={styles.meta}>Socio N° {inv.persona_id_sif} • Solicitud #{inv.solicitud_folio}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Domicilio del Socio</Text>
        <Text style={styles.text}>Calle: {inv.calle || 'Sin calle'} #{inv.numero_exterior || ''}</Text>
        <Text style={styles.text}>Código Postal: {inv.codigo_postal || 'N/A'}</Text>
        <Text style={styles.text}>Referencias: {inv.referencias || 'Sin referencias'}</Text>

        <TouchableOpacity style={styles.navButton} onPress={abrirNavegacion}>
          <Text style={styles.navButtonText}>🗺️ Abrir en Google Maps / GPS</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.capturaButton}
        onPress={() => navigation.navigate('CapturaFormato', { id, inv })}
      >
        <Text style={styles.capturaButtonText}>📋 Capturar Estudio Socio-Económico</Text>
      </TouchableOpacity>
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
  navButton: { backgroundColor: '#334155', padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  navButtonText: { color: '#38bdf8', fontWeight: 'bold', fontSize: 13 },
  capturaButton: { backgroundColor: '#0284c7', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8, marginBottom: 40 },
  capturaButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
});
