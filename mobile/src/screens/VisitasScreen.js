import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, TextInput, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { getAssignedInvestigaciones, enviarUbicacionGPS, getPendingOfflineSurveys, syncPendingSurveys } from '../api/apiClient';
import { abrirNavegacionNativa } from '../utils/navigationHelper';




function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null;
  if (nLat2 === 0 && nLon2 === 0) return null;

  const R = 6371; // Radio de la Tierra en KM
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Helper: formatea fecha en DD/Mon/AAAA
function formatFechaCorta(fechaStr) {
  if (!fechaStr) return '';
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const d = new Date(fechaStr);
  if (isNaN(d)) return '';
  return `${String(d.getDate()).padStart(2,'0')}/${meses[d.getMonth()]}/${d.getFullYear()}`;
}

export default function VisitasScreen({ navigation, route }) {
  const [currentUser, setCurrentUser] = useState(route.params?.user || { nombre: 'Investigador' });
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS'); // TODOS | PENDIENTE | COMPLETADA
  const [ordenarCercania, setOrdenarCercania] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    initUserAndData();
    reportarGPSActual();
    checkPendingSurveys();

    // RASTREO GPS EN TIEMPO REAL: Transmite coordenadas cada 5 segundos (Casi en vivo)
    const gpsInterval = setInterval(() => {
      reportarGPSActual();
    }, 5000);

    return () => clearInterval(gpsInterval);
  }, []);

  async function checkPendingSurveys() {
    try {
      const pending = await getPendingOfflineSurveys();
      setPendingOfflineCount(pending.length);
    } catch (e) {}
  }

  async function handleSyncManual() {
    setSyncing(true);
    try {
      const res = await syncPendingSurveys();
      await checkPendingSurveys();
      if (res.synced > 0) {
        Alert.alert('Sincronización Exitosa', `Se enviaron ${res.synced} encuestas pendientes al servidor.`);
        loadData(currentUser?.id);
      } else if (res.failed > 0) {
        Alert.alert('Aviso', `No se pudo conectar al servidor. Se reintentará cuando haya internet.`);
      } else {
        Alert.alert('Al día', 'No hay encuestas pendientes por enviar.');
      }
    } catch (e) {
      console.log('Error syncing:', e);
    } finally {
      setSyncing(false);
    }
  }

  async function reportarGPSActual() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (loc && loc.coords) {
        setUserLocation(loc.coords);
        await enviarUbicacionGPS(loc.coords.latitude, loc.coords.longitude, 100);
      }
    } catch (e) {
      console.log('Error transmitiendo ubicación GPS:', e);
    }
  }

  function abrirNavegacionSencilla(item) {
    abrirNavegacionNativa(item);
  }

  async function initUserAndData() {
    let activeUser = route.params?.user;
    if (!activeUser || !activeUser.id) {
      try {
        const rawUser = await AsyncStorage.getItem('userData');
        if (rawUser) {
          activeUser = JSON.parse(rawUser);
        }
      } catch (e) {}
    }
    if (activeUser) {
      setCurrentUser(activeUser);
    }
    loadData(activeUser?.id);
  }

  async function handleRelogin() {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userData');
    navigation.replace('Login');
  }

  async function loadData(userId) {
    setLoadError(null);
    try {
      const targetId = userId || currentUser?.id;
      const res = await getAssignedInvestigaciones(targetId);
      setVisitas(res.data || []);
      setLoadError(null);
      checkPendingSurveys();
    } catch (err) {
      console.log('Error visitas:', err);
      const msg = err.message || 'Error al conectar con el servidor';
      if (msg.includes('SESION_EXPIRADA') || msg.includes('Token') || msg.includes('401')) {
        Alert.alert(
          'Sesión Expirada',
          'Tu token de sesión ya no es válido. Por favor vuelve a ingresar tus credenciales.',
          [{ text: 'Iniciar Sesión', onPress: handleRelogin }]
        );
      } else {
        setLoadError(msg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadData(currentUser?.id);
    handleSyncManual();
  };

  const listConDistancia = visitas.map((item) => {
    const dist = userLocation
      ? calcularDistanciaKm(userLocation.latitude, userLocation.longitude, item.latitud, item.longitud)
      : null;
    return { ...item, distanciaKm: dist };
  });

  const visitasFiltradas = listConDistancia.filter((item) => {
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

  if (ordenarCercania) {
    visitasFiltradas.sort((a, b) => {
      if (a.distanciaKm === null) return 1;
      if (b.distanciaKm === null) return -1;
      return a.distanciaKm - b.distanciaKm;
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hola, {currentUser?.nombre || 'Investigador'}</Text>
        <Text style={styles.subtext}>Investigaciones asignadas del día</Text>
      </View>

      {/* BANNER DE SINCRONIZACIÓN OFFLINE PENDIENTE */}
      {pendingOfflineCount > 0 && (
        <TouchableOpacity
          style={styles.syncBanner}
          onPress={handleSyncManual}
          disabled={syncing}
        >
          <Text style={styles.syncBannerText}>
            {syncing ? '⏳ Sincronizando en campo...' : `⚡ Sincronizar ${pendingOfflineCount} visita(s) guardada(s) localmente`}
          </Text>
        </TouchableOpacity>
      )}

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

      {/* BOTONES DE FILTRO RÁPIDO Y ORDENAMIENTO POR CERCANÍA */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filtroEstado === 'TODOS' && !ordenarCercania && styles.filterChipActive]}
          onPress={() => { setFiltroEstado('TODOS'); setOrdenarCercania(false); }}
        >
          <Text style={[styles.filterChipText, filtroEstado === 'TODOS' && !ordenarCercania && styles.filterChipTextActive]}>
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
        <TouchableOpacity
          style={[styles.filterChip, ordenarCercania && styles.filterChipActive]}
          onPress={() => setOrdenarCercania(!ordenarCercania)}
        >
          <Text style={[styles.filterChipText, ordenarCercania && styles.filterChipTextActive]}>
            📍 Cercanas
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTADOR DE RESULTADOS Y CERCANÍA */}
      {(searchQuery.length > 0 || ordenarCercania) && (
        <Text style={styles.resultCount}>
          {ordenarCercania ? '📍 Ordenado por cercanía a tu ubicación GPS' : `Mostrando ${visitasFiltradas.length} de ${visitas.length} investigaciones`}
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
              <Text style={styles.emptyIcon}>{loadError ? '⚠️' : '🔍'}</Text>
              <Text style={styles.emptyTitle}>{loadError ? 'Error al Cargar' : 'Sin resultados'}</Text>
              <Text style={styles.emptySubtitle}>
                {loadError
                  ? loadError
                  : searchQuery
                  ? `No se encontraron resultados para "${searchQuery}"`
                  : 'No tienes visitas domiciliarias asignadas por el momento.'}
              </Text>
              <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                <Text style={styles.refreshBtnText}>🔄 Actualizar lista</Text>
              </TouchableOpacity>
              {loadError && (
                <TouchableOpacity
                  style={[styles.refreshBtn, { backgroundColor: '#dc2626', marginTop: 10 }]}
                  onPress={handleRelogin}
                >
                  <Text style={styles.refreshBtnText}>🔑 Re-Iniciar Sesión</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('DetalleInvestigacion', { id: item.id_sif_research })}
            >
              <View style={styles.cardHeader}>
                {(() => {
                  const isAvalItem = item?.es_aval === true || (item?.tipo_sujeto || '').toUpperCase().includes('AVAL');
                  return (
                    <View style={[styles.badge, !isAvalItem ? styles.badgeSol : styles.badgeAval]}>
                      <Text style={styles.badgeText}>
                        {!isAvalItem ? '👤 SOLICITANTE' : '🤝 AVAL'}
                      </Text>
                    </View>
                  );
                })()}

                {item.distanciaKm !== null && (
                  <View style={styles.distanciaBadgeContainer}>
                    <Text style={styles.distanciaBadgeText}>📏 a {item.distanciaKm} km</Text>
                  </View>
                )}

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

              {/* BADGE VIGENCIA 90 DÍAS */}
              {item.visita_vigente && (
                <View style={styles.vigenciaBadge}>
                  <Text style={styles.vigenciaBadgeText}>
                    ✅ Visita vigente hasta {formatFechaCorta(item.visita_vigente_hasta)} — Puede reutilizarse
                  </Text>
                </View>
              )}

              {/* RECHAZO MOTIVO BANNER */}
              {item.estado === 'RECHAZADA' && (
                <View style={styles.rechazoBadge}>
                  <Text style={styles.rechazoBadgeTitle}>❌ RECHAZADA — Corrección Requerida:</Text>
                  <Text style={styles.rechazoBadgeText}>
                    {item.comentarios_validacion || 'Se solicitó corregir la información o fotografías enviadas.'}
                  </Text>
                </View>
              )}

              <View style={styles.cardFooter}>
                <Text style={styles.monto}>
                  Monto: ${parseFloat(item.monto_solicitado || 0).toLocaleString('es-MX')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.navQuickBtn}
                    onPress={() => abrirNavegacionSencilla(item)}
                  >
                    <Text style={styles.navQuickText}>🗺️ Ruta</Text>
                  </TouchableOpacity>
                  <Text style={[
                    styles.estado,
                    item.estado === 'VALIDADA' ? styles.estadoValidadas :
                    item.estado === 'RECHAZADA' ? styles.estadoRechazadas :
                    item.estado === 'COMPLETADA' ? styles.estadoComp : styles.estadoPend
                  ]}>
                    {item.estado === 'VALIDADA' ? 'VALIDADA ✅' : item.estado === 'RECHAZADA' ? 'RECHAZADA ❌' : item.estado}
                  </Text>
                </View>
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
  syncBanner: {
    backgroundColor: '#d97706',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  syncBannerText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
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
  distanciaBadgeContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  distanciaBadgeText: { color: '#34d399', fontSize: 10, fontWeight: 'bold' },
  folio: { color: '#64748b', fontSize: 12, fontFamily: 'monospace' },
  nombre: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  direccion: { fontSize: 13, color: '#cbd5e1', marginBottom: 2 },
  ubicacionDetalle: { fontSize: 12, color: '#38bdf8', fontWeight: '500', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#334155' },
  monto: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  navQuickBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 4,
  },
  navQuickText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  estado: { fontSize: 11, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  estadoComp: { color: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.1)' },
  estadoPend: { color: '#fbbf24', backgroundColor: 'rgba(251, 191, 36, 0.1)' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#f8fafc', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 20 },
  refreshBtn: { backgroundColor: '#0284c7', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  refreshBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  estadoValidadas: { color: '#34d399', backgroundColor: 'rgba(52, 211, 153, 0.2)' },
  estadoRechazadas: { color: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.2)' },
  rechazoBadge: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
    marginBottom: 2,
  },
  rechazoBadgeTitle: { color: '#f87171', fontSize: 11, fontWeight: 'bold' },
  rechazoBadgeText: { color: '#fca5a5', fontSize: 11, marginTop: 2 },
  vigenciaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 8,
    marginBottom: 2,
  },
  vigenciaBadgeText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: 'bold',
  },
});



