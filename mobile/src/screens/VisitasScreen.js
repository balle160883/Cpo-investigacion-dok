import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { getAssignedInvestigaciones } from '../api/apiClient';

export default function VisitasScreen({ navigation, route }) {
  const user = route.params?.user || { nombre: 'Investigador' };
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await getAssignedInvestigaciones(user.id);
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
    loadData();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hola, {user.nombre}</Text>
        <Text style={styles.subtext}>Investigaciones asignadas del día</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0284c7" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={visitas}
          keyExtractor={(item) => item.id_sif_research.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0284c7" />}
          ListEmptyComponent={(
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>Sin investigaciones asignadas</Text>
              <Text style={styles.emptySubtitle}>No tienes visitas domiciliarias asignadas por el momento.</Text>
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
  header: { marginBottom: 16, marginTop: 40 },
  greeting: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  subtext: { fontSize: 13, color: '#94a3b8' },
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
  direccion: { fontSize: 13, color: '#cbd5e1', marginBottom: 12 },
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
