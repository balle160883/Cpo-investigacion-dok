import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { getAssignedInvestigaciones, enviarUbicacionGPS } from '../api/apiClient';

export default function VisitasScreen({ navigation, route }) {
  const [currentUser, setCurrentUser] = useState(route.params?.user || { nombre: 'Investigador' });
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS'); // TODOS | PENDIENTE | COMPLETADA

  useEffect(() => {
    initUserAndData();
    reportarGPSActual();

    // RASTREO GPS EN TIEMPO REAL: Transmite coordenadas cada 15 segundos
    const gpsInterval = setInterval(() => {
      reportarGPSActual();
    }, 15000);

    return () => clearInterval(gpsInterval);
  }, []);

  async function reportarGPSActual() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (loc && loc.coords) {
        await enviarUbicacionGPS(loc.coords.latitude, loc.coords.longitude, 100);
      }
    } catch (e) {
      console.log('Error transmitiendo ubicación GPS:', e);
    }
  }

  async function initUserAndData() {
    let activeUser = route.params?.user;
    if (!activeUser || !activeUser.id) {
      try {
        const rawUser = await AsyncStorage.getItem('userData');
        if (rawUser) {
          activeUser = JSON.parse(rawUser);
          setCurrentUser(activeUser);
        }
      } catch (e) {}
    }
    loadData(activeUser?.id);
  }

  async function loadData(userId) {
    try {
      const targetId = userId || currentUser?.id;
      const res = await getAssignedInvestigaciones(targetId);
      setVisitas(res.data || []);
    } catch (err) {
      console.log('Error visitas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadData(currentUser?.id);
  };

  const visitasFiltradas = visitas.filter((item) => {
    if (filtroEstado !== 'TODOS') {
      if (filtroEstado === 'PENDIENTE') {
        if (item.estado === 'COMPLETADA') return false;
      } else if (filtroEstado === 'COMPLETADA') {
        if (item.estado !== 'COMPLETADA') return false;
      }
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    const enColonia = (item.colonia || '').toLowerCase().includes(query);
    const enCalle = (item.calle || '').toLowerCase().includes(query);
    const enMunicipio = (item.municipio || '').toLowerCase().includes(query);
    const enEstado = (item.estado_provincia || '').toLowerCase().includes(query);
    const enNombre = (item.sujeto_nombre || '').toLowerCase().includes(query);
    const enFolio = (item.id_sif_research || '').toString().includes(query) || (item.solicitud_folio || '').toString().includes(query);

    return enColonia || enCalle || enMunicipio || enEstado || enNombre || enFolio;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hola, {currentUser?.nombre || 'Investigador'}</Text>
        <Text style={styles.subtext}>Investigaciones asignadas del día</Text>
      </View>

      {/* BUSCADOR EN TIEMPO REAL POR COLONIA / SOCIO / FOLIO */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por colonia, socio o folio..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* BOTONES DE FILTRO RÁPIDO POR ESTADO */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filtroEstado === 'TODOS' && styles.filterChipActive]}
          onPress={() => setFiltroEstado('TODOS')}
        >
          <Text style={[styles.filterChipText, filtroEstado === 'TODOS' && styles.filterChipTextActive]}>
            Todos ({visitas.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filtroEstado === 'PENDIENTE' && styles.filterChipActive]}
          onPress={() => setFiltroEstado('PENDIENTE')}
        >
          <Text style={[styles.filterChipText, filtroEstado === 'PENDIENTE' && styles.filterChipTextActive]}>
            Pendientes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filtroEstado === 'COMPLETADA' && styles.filterChipActive]}
          onPress={() => setFiltroEstado('COMPLETADA')}
        >
          <Text style={[styles.filterChipText, filtroEstado === 'COMPLETADA' && styles.filterChipTextActive]}>
            Completadas
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTADOR DE RESULTADOS */}
      {searchQuery.length > 0 && (
        <Text style={styles.resultCount}>
          Mostrando {visitasFiltradas.length} de {visitas.length} investigaciones
        </Text>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#0284c7" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={visitasFiltradas}
          keyExtractor={(item) => item.id_sif_research.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0284c7" />}
          ListEmptyComponent={(
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No se encontraron resultados para "${searchQuery}"`
                  : 'No tienes visitas domiciliarias asignadas por el momento.'}
              </Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                <Text style={styles.refreshBtnText}>🔄 Actualizar lista</Text>
              </TouchableOpacity>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('DetalleInvestigacion', { id: item.id_sif_research })}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.badge, item.tipo_sujeto === 'CLIENTE' ? styles.badgeSol : styles.badgeAval]}>
                  <Text style={styles.badgeText}>
                    {item.tipo_sujeto === 'CLIENTE' ? 'SOLICITANTE' : 'AVAL'}
                  </Text>
                </View>
                <Text style={styles.folio}>Folio: #{item.id_sif_research}</Text>
              </View>

              <Text style={styles.nombre}>{item.sujeto_nombre || 'Socio Sin Nombre'}</Text>
              
              <Text style={styles.direccion}>
                📍 {item.calle ? `${item.calle} #${item.numero_exterior || ''}` : 'Sin Calle'}
              </Text>
              
              {/* COLONIA, MUNICIPIO Y ESTADO */}
              <Text style={styles.ubicacionDetalle}>
                🏡 {item.colonia ? `Col. ${item.colonia}` : 'Sin Colonia'}, {item.municipio || 'Guadalajara'}, {item.estado_provincia || 'Jalisco'}
              </Text>

              <View style={styles.cardFooter}>
                <Text style={styles.monto}>
                  Monto: ${parseFloat(item.monto_solicitado || 0).toLocaleString('es-MX')}
                </Text>
                <Text style={[styles.estado, item.estado === 'COMPLETADA' ? styles.estadoComp : styles.estadoPend]}>
                  {item.estado}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  header: { marginBottom: 12, marginTop: 40 },
  greeting: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  subtext: { fontSize: 13, color: '#94a3b8' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: '#ffffff', fontSize: 13, paddingVertical: 2 },
  clearSearchBtn: { padding: 4 },
  clearSearchText: { color: '#94a3b8', fontSize: 14, fontWeight: 'bold' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: { backgroundColor: '#0284c7', borderColor: '#38bdf8' },
  filterChipText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  filterChipTextActive: { color: '#ffffff', fontWeight: 'bold' },
  resultCount: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold', marginBottom: 8 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeSol: { backgroundColor: 'rgba(2, 132, 199, 0.2)' },
  badgeAval: { backgroundColor: 'rgba(168, 85, 247, 0.2)' },
  badgeText: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold' },
  folio: { color: '#64748b', fontSize: 12, fontFamily: 'monospace' },
  nombre: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  direccion: { fontSize: 13, color: '#cbd5e1', marginBottom: 2 },
  ubicacionDetalle: { fontSize: 12, color: '#38bdf8', fontWeight: '500', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#334155' },
  monto: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  estado: { fontSize: 11, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  estadoComp: { color: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.1)' },
  estadoPend: { color: '#fbbf24', backgroundColor: 'rgba(251, 191, 36, 0.1)' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#f8fafc', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 20 },
  refreshBtn: { backgroundColor: '#0284c7', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  refreshBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
});

