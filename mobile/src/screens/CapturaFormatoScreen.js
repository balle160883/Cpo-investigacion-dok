import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { guardarEvidenciaInvestigacion } from '../api/apiClient';

export default function CapturaFormatoScreen({ route, navigation }) {
  const { id, inv } = route.params;
  const isAval = inv?.tipo_sujeto !== 'CLIENTE';

  // Form Fields based on Word Formats
  const [quienAtendio, setQuienAtendio] = useState('titular'); // titular | familiar
  const [nombreAtendio, setNombreAtendio] = useState('');
  const [parentescoAtendio, setParentescoAtendio] = useState('');
  const [viveConSolicitante, setViveConSolicitante] = useState('SI');

  const [presentoId, setPresentoId] = useState('SI');
  const [tipoId, setTipoId] = useState('INE');
  const [folioId, setFolioId] = useState('');

  const [casaColor, setCasaColor] = useState('');
  const [puertaColor, setPuertaColor] = useState('');
  const [numeroNiveles, setNumeroNiveles] = useState('1');

  const [estadoCivil, setEstadoCivil] = useState('casado');
  const [ocupacionConyuge, setOcupacionConyuge] = useState('');
  const [situacionVivienda, setSituacionVivienda] = useState('propia');
  const [montoPagoMensual, setMontoPagoMensual] = useState('0');
  const [tiempoResidencia, setTiempoResidencia] = useState('3 años');

  const [personasMayores18, setPersonasMayores18] = useState('2');
  const [personasMenores18, setPersonasMenores18] = useState('0');
  const [personasGeneranIngresos, setPersonasGeneranIngresos] = useState('1');

  const [valorCasa, setValorCasa] = useState('0');
  const [valorMuebles, setValorMuebles] = useState('0');
  const [valorAuto, setValorAuto] = useState('0');

  const [dictamen, setDictamen] = useState('DOMICILIO CONFIRMADO');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleGuardar() {
    setSaving(true);
    try {
      const estudio_socioeconomico = {
        quien_atendio: quienAtendio,
        nombre_atendio: nombreAtendio,
        parentesco_atendio: parentescoAtendio,
        vive_con_solicitante: viveConSolicitante === 'SI',
        presento_identificacion: presentoId === 'SI',
        tipo_identificacion: tipoId,
        folio_identificacion: folioId,
        casa_color: casaColor,
        puerta_cancel_color: puertaColor,
        numero_niveles: parseInt(numeroNiveles || '1'),
        estado_civil: estadoCivil,
        ocupacion_conyuge: ocupacionConyuge,
        situacion_vivienda: situacionVivienda,
        monto_pago_mensual: parseFloat(montoPagoMensual || 0),
        tiempo_residencia: tiempoResidencia,
        personas_mayores_18: parseInt(personasMayores18 || '0'),
        personas_menores_18: parseInt(personasMenores18 || '0'),
        personas_generan_ingresos: parseInt(personasGeneranIngresos || '0'),
        valor_estimado_casa: parseFloat(valorCasa || 0),
        valor_estimado_muebles: parseFloat(valorMuebles || 0),
        valor_estimado_automovil: parseFloat(valorAuto || 0),
      };

      await guardarEvidenciaInvestigacion(id, {
        estudio_socioeconomico,
        dictamen,
        notas_investigador: observaciones,
        latitud_checkin: 20.6597,
        longitud_checkin: -103.3496,
      });

      Alert.alert('Éxito', 'Estudio socio-económico guardado correctamente', [
        { text: 'OK', onPress: () => navigation.navigate('Visitas') },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>
        FORMATO DIGITAL: {isAval ? 'AVAL' : 'SOLICITANTE'}
      </Text>

      {/* 1. INFORMACIÓN Y VERIFICACIÓN */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Verificación e Identificación</Text>
        
        <Text style={styles.label}>Proporcionó la Información:</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.chip, quienAtendio === 'titular' && styles.chipActive]}
            onPress={() => setQuienAtendio('titular')}
          >
            <Text style={styles.chipText}>Titular</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, quienAtendio === 'familiar' && styles.chipActive]}
            onPress={() => setQuienAtendio('familiar')}
          >
            <Text style={styles.chipText}>Familiar</Text>
          </TouchableOpacity>
        </View>

        {quienAtendio === 'familiar' && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>Nombre del Familiar:</Text>
            <TextInput style={styles.input} value={nombreAtendio} onChangeText={setNombreAtendio} />
            <Text style={styles.label}>Parentesco:</Text>
            <TextInput style={styles.input} value={parentescoAtendio} onChangeText={setParentescoAtendio} />
          </View>
        )}

        <Text style={styles.label}>Identificación Oficial:</Text>
        <TextInput style={styles.input} placeholder="Folio de INE/Pasaporte" placeholderTextColor="#64748b" value={folioId} onChangeText={setFolioId} />
      </View>

      {/* 2. PARTICULARES DEL DOMICILIO */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Particulares del Inmueble</Text>
        <Text style={styles.label}>Casa Color:</Text>
        <TextInput style={styles.input} value={casaColor} onChangeText={setCasaColor} placeholder="Ej. Blanco / Azul" placeholderTextColor="#64748b" />
        
        <Text style={styles.label}>Puerta / Cancel Color:</Text>
        <TextInput style={styles.input} value={puertaColor} onChangeText={setPuertaColor} placeholder="Ej. Negro / Forja" placeholderTextColor="#64748b" />

        <Text style={styles.label}>Número de Niveles:</Text>
        <TextInput style={styles.input} value={numeroNiveles} onChangeText={setNumeroNiveles} keyboardType="numeric" />
      </View>

      {/* 3. STATUS SOCIO-ECONÓMICO */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Status Socio-Económico</Text>
        
        <Text style={styles.label}>Vivienda:</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.chip, situacionVivienda === 'propia' && styles.chipActive]} onPress={() => setSituacionVivienda('propia')}>
            <Text style={styles.chipText}>Propia</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, situacionVivienda === 'rentada' && styles.chipActive]} onPress={() => setSituacionVivienda('rentada')}>
            <Text style={styles.chipText}>Rentada</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, situacionVivienda === 'padres' && styles.chipActive]} onPress={() => setSituacionVivienda('padres')}>
            <Text style={styles.chipText}>Padres</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Valor Estimado de Casa ($):</Text>
        <TextInput style={styles.input} value={valorCasa} onChangeText={setValorCasa} keyboardType="numeric" />

        <Text style={styles.label}>Valor Estimado de Muebles ($):</Text>
        <TextInput style={styles.input} value={valorMuebles} onChangeText={setValorMuebles} keyboardType="numeric" />
      </View>

      {/* 4. DICTAMEN Y OBSERVACIONES */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Observaciones del Investigador</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          multiline
          placeholder="Escribe observaciones detalladas de la visita..."
          placeholderTextColor="#64748b"
          value={observaciones}
          onChangeText={setObservaciones}
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleGuardar} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar y Enviar Dictamen</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#38bdf8', marginBottom: 16, marginTop: 40, textAlign: 'center' },
  section: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#ffffff', marginBottom: 12 },
  label: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 10, color: '#ffffff', fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  chip: { backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: '#0284c7', borderColor: '#38bdf8' },
  chipText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  saveButton: { backgroundColor: '#10b981', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 50 },
  saveButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
});
