import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { getInvestigacionDetalle, actualizarTelefonoInvestigacion } from '../api/apiClient';
import { abrirGoogleMapsNativo, abrirWazeNativo } from '../utils/navigationHelper';
import { formatNombreSucursal, esAval } from '../utils/formatters';

export default function DetalleInvestigacionScreen({ route, navigation }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estados para gestión y edición de teléfono
  const [telefonoActual, setTelefonoActual] = useState('');
  const [telefonoSecundario, setTelefonoSecundario] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [inputTelefono, setInputTelefono] = useState('');
  const [guardandoTel, setGuardandoTel] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await getInvestigacionDetalle(id);
        setData(res);
        const inv = res?.investigacion || {};
        const telPrincipal = inv.telefono_principal || inv.telefono || res?.evidencia?.estudio_socioeconomico?.telefono_visitado || '';
        setTelefonoActual(telPrincipal);
        setTelefonoSecundario(inv.telefono_secundario || '');
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

  function handleLlamar(numero) {
    if (!numero || !String(numero).trim()) {
      Alert.alert(
        'Sin Teléfono',
        'No hay un número registrado para esta persona. Puedes capturarlo tocando en "Editar Teléfono".'
      );
      return;
    }
    const cleanNumber = String(numero).replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanNumber}`).catch(() => {
      Alert.alert('Error', 'No se pudo abrir la aplicación de llamadas en este dispositivo.');
    });
  }

  function handleWhatsApp(numero) {
    if (!numero || !String(numero).trim()) {
      Alert.alert(
        'Sin Teléfono',
        'No hay un número registrado. Puedes capturarlo tocando en "Editar Teléfono".'
      );
      return;
    }
    let clean = String(numero).replace(/[^0-9]/g, '');
    if (clean.length === 10) clean = `52${clean}`;
    const url = `https://wa.me/${clean}?text=${encodeURIComponent('Hola, me comunico de CPO respecto a la visita de investigación.')}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'No se pudo abrir WhatsApp.');
    });
  }

  function abrirModalEditar() {
    setInputTelefono(telefonoActual);
    setModalVisible(true);
  }

  async function handleGuardarNuevoTelefono() {
    if (!inputTelefono.trim()) {
      Alert.alert('Campo requerido', 'Por favor ingresa un número de teléfono válido.');
      return;
    }
    setGuardandoTel(true);
    try {
      const res = await actualizarTelefonoInvestigacion(id, inputTelefono.trim(), telefonoSecundario);
      if (res.success) {
        setTelefonoActual(inputTelefono.trim());
        // Actualizar datos locales en memoria
        if (data && data.investigacion) {
          data.investigacion.telefono_principal = inputTelefono.trim();
          data.investigacion.telefono = inputTelefono.trim();
        }
        setModalVisible(false);
        Alert.alert(
          '✅ Teléfono Actualizado',
          'El nuevo número telefónico ha sido guardado correctamente en la base de datos y se reflejará en el formato oficial.'
        );
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo actualizar el teléfono.');
    } finally {
      setGuardandoTel(false);
    }
  }

  const isAval = esAval(inv);
  const folioCredito = inv.solicitud_folio || (inv.solicitud_id_sif ? `#${inv.solicitud_id_sif}` : 'N/A');
  const sucNombre = formatNombreSucursal(inv.sucursal_id, inv.sucursal_nombre);

  return (
    <ScrollView style={styles.container}>
      {/* 1. Encabezado de la Investigación */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <View style={[styles.badge, !isAval ? styles.badgeSol : styles.badgeAval]}>
            <Text style={[styles.badgeText, !isAval ? styles.badgeTextSol : styles.badgeTextAval]}>
              {!isAval ? '👤 SOLICITANTE DE PRÉSTAMO' : '🤝 AVAL DE CRÉDITO'}
            </Text>
          </View>
          <Text style={styles.folioHeader}>#{inv.id_sif_research || id}</Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Text style={styles.solicitudFolio}>Sol: {folioCredito}</Text>
          <View style={styles.sucursalContainer}>
            <Text style={styles.sucursalText}>🏢 Suc. {sucNombre}</Text>
          </View>
        </View>

        <Text style={styles.nombre}>{inv.sujeto_nombre || 'Socio Sin Nombre'}</Text>
        <Text style={styles.meta}>Socio N° {inv.persona_id_sif || 'N/A'} • Monto: ${parseFloat(inv.monto_solicitado || 0).toLocaleString('es-MX')}</Text>
      </View>

      {/* 2. SECCIÓN DE TELÉFONO Y CONTACTO */}
      <View style={styles.section}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={styles.sectionTitle}>📞 Teléfono de Contacto</Text>
          <TouchableOpacity onPress={abrirModalEditar} style={styles.editTelBtn}>
            <Text style={styles.editTelBtnText}>✏️ {telefonoActual ? 'Cambiar' : 'Agregar'}</Text>
          </TouchableOpacity>
        </View>

        {telefonoActual ? (
          <View style={styles.telContainer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.telNumberText}>{telefonoActual}</Text>
              <Text style={styles.telLabelText}>Teléfono Principal / Visita</Text>
            </View>
          </View>
        ) : (
          <View style={styles.telWarningBox}>
            <Text style={styles.telWarningText}>⚠️ Sin teléfono registrado. Presiona "Agregar" para registrarlo.</Text>
          </View>
        )}

        {/* Botones de acción rápida: Llamar y WhatsApp */}
        <View style={styles.telActionsRow}>
          <TouchableOpacity
            style={[styles.callBtn, !telefonoActual && styles.btnDisabled]}
            onPress={() => handleLlamar(telefonoActual)}
            disabled={!telefonoActual}
          >
            <Text style={styles.callBtnText}>📞 Llamar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.waBtn, !telefonoActual && styles.btnDisabled]}
            onPress={() => handleWhatsApp(telefonoActual)}
            disabled={!telefonoActual}
          >
            <Text style={styles.waBtnText}>💬 WhatsApp</Text>
          </TouchableOpacity>
        </View>

        {/* Si tiene teléfono secundario registrado */}
        {Boolean(telefonoSecundario) && (
          <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' }}>
            <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>Teléfono Secundario / Referencia:</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: 'bold' }}>{telefonoSecundario}</Text>
              <TouchableOpacity
                style={styles.secondaryCallBtn}
                onPress={() => handleLlamar(telefonoSecundario)}
              >
                <Text style={styles.secondaryCallBtnText}>📞 Marcar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* 3. Domicilio de la Investigación */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Domicilio de la Investigación</Text>
        <Text style={styles.text}>Calle: {inv.calle || 'Sin calle'} #{inv.numero_exterior || ''} {inv.numero_interior ? `Int ${inv.numero_interior}` : ''}</Text>
        <Text style={styles.text}>Colonia: {inv.colonia || 'Sin colonia'}</Text>
        <Text style={styles.text}>Municipio / Estado: {inv.municipio || 'N/A'}{inv.estado_provincia ? `, ${inv.estado_provincia}` : ''}</Text>
        <Text style={styles.text}>Código Postal: {inv.codigo_postal || 'N/A'}</Text>
        <Text style={styles.text}>Referencias: {inv.referencias || 'Sin referencias'}</Text>

        <Text style={styles.navLabel}>Navegación GPS:</Text>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.googleBtn} onPress={abrirGoogleMaps}>
            <Text style={styles.googleBtnText}>🗺️ Google Maps</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.wazeBtn} onPress={abrirWaze}>
            <Text style={styles.wazeBtnText}>🚙 Waze</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. Botón de Captura o Banner de Bloqueo */}
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
          onPress={() => navigation.navigate('CapturaFormato', { id, inv: { ...inv, telefono_principal: telefonoActual, telefono: telefonoActual } })}
        >
          <Text style={styles.capturaButtonText}>📋 Capturar Estudio Socio-Económico</Text>
        </TouchableOpacity>
      )}

      {/* MODAL PARA EDITAR / CAMBIAR TELÉFONO */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>✏️ Editar Teléfono de Contacto</Text>
            <Text style={styles.modalSubtitle}>
              Ingresa el número telefónico correcto. Al guardar se sincronizará automáticamente con la base de datos y aparecerá en el formato web.
            </Text>

            <Text style={styles.modalInputLabel}>Número Telefónico (10 dígitos):</Text>
            <TextInput
              style={styles.modalInput}
              value={inputTelefono}
              onChangeText={setInputTelefono}
              placeholder="Ej. 33 1234 5678"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              autoFocus={true}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={guardandoTel}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleGuardarNuevoTelefono}
                disabled={guardandoTel}
              >
                {guardandoTel ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>💾 Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  folioHeader: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' },
  solicitudFolio: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  sucursalContainer: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  sucursalText: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeSol: { backgroundColor: 'rgba(2, 132, 199, 0.2)', borderColor: 'rgba(56, 189, 248, 0.4)' },
  badgeAval: { backgroundColor: 'rgba(168, 85, 247, 0.2)', borderColor: 'rgba(192, 132, 252, 0.4)' },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  badgeTextSol: { color: '#38bdf8' },
  badgeTextAval: { color: '#c084fc' },
  typeBadge: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  nombre: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  section: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#ffffff' },
  text: { color: '#cbd5e1', fontSize: 13, marginBottom: 6 },
  navLabel: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginTop: 12, marginBottom: 8 },
  navRow: { flexDirection: 'row', gap: 10 },
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

  // Estilos específicos de Teléfono
  telContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
  },
  telNumberText: { color: '#38bdf8', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.5 },
  telLabelText: { color: '#64748b', fontSize: 11, marginTop: 2 },
  telWarningBox: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  telWarningText: { color: '#facc15', fontSize: 12 },
  editTelBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  editTelBtnText: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold' },
  telActionsRow: { flexDirection: 'row', gap: 10 },
  callBtn: {
    flex: 1,
    backgroundColor: '#059669',
    padding: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#047857',
    elevation: 3,
  },
  callBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  waBtn: {
    flex: 1,
    backgroundColor: '#25D366',
    padding: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1EBE5D',
    elevation: 3,
  },
  waBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  btnDisabled: { opacity: 0.4 },
  secondaryCallBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  secondaryCallBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },

  // Estilos del Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#475569',
    elevation: 10,
  },
  modalTitle: { color: '#ffffff', fontSize: 17, fontWeight: 'bold', marginBottom: 8 },
  modalSubtitle: { color: '#94a3b8', fontSize: 12, marginBottom: 16, lineHeight: 18 },
  modalInputLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  modalInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    color: '#ffffff',
    fontSize: 16,
    padding: 12,
    marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#64748b',
  },
  modalCancelBtnText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: '#0284c7',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSaveBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
});
