import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { guardarEvidenciaInvestigacion, escanearINEConFoto } from '../api/apiClient';
import SignaturePad from '../components/SignaturePad';

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

  // Dirección Real / Corregida en Campo
  const [tieneDireccionDiferente, setTieneDireccionDiferente] = useState(false);
  const [calleReal, setCalleReal] = useState('');
  const [coloniaReal, setColoniaReal] = useState('');
  const [referenciasDomicilio, setReferenciasDomicilio] = useState('');

  const [estadoCivil, setEstadoCivil] = useState('casado');
  const [ocupacion, setOcupacion] = useState('');
  const [ocupacionConyuge, setOcupacionConyuge] = useState('');
  const [situacionVivienda, setSituacionVivienda] = useState('propia');
  const [nombreQuienPresta, setNombreQuienPresta] = useState('');
  const [parentescoQuienPresta, setParentescoQuienPresta] = useState('');
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

  // 3. Referencias / Avales
  const [parentescoReferencia, setParentescoReferencia] = useState('Familiar / Aval');
  const [tiempoConocerlo, setTiempoConocerlo] = useState('5 años');
  const [confirmoReferencia, setConfirmoReferencia] = useState('SI');


  // Evidencias: Fotos, Firma y GPS
  const [fotos, setFotos] = useState([]);
  const [firmaUrl, setFirmaUrl] = useState('');
  const [firmaInvestigadorUrl, setFirmaInvestigadorUrl] = useState('');
  const [location, setLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanningIne, setScanningIne] = useState(false);

  async function handleEscanearINE() {
    Alert.alert(
      '📷 Escanear INE Oficial',
      'Selecciona el origen de la fotografía del frente de la credencial del INE:',
      [
        {
          text: 'Tomar Foto (Cámara)',
          onPress: async () => {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (!permissionResult.granted) {
              Alert.alert('Permiso requerido', 'Se necesita acceso a la cámara para escanear el INE.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              quality: 0.8,
              base64: true,
            });
            if (!result.canceled && result.assets && result.assets[0]?.base64) {
              procesarFotoINEBase64(result.assets[0].base64);
            }
          },
        },
        {
          text: 'Seleccionar (Galería)',
          onPress: async () => {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
              Alert.alert('Permiso requerido', 'Se necesita acceso a la galería para seleccionar la foto del INE.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              quality: 0.8,
              base64: true,
            });
            if (!result.canceled && result.assets && result.assets[0]?.base64) {
              procesarFotoINEBase64(result.assets[0].base64);
            }
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  }

  async function procesarFotoINEBase64(base64Data) {
    setScanningIne(true);
    try {
      const res = await escanearINEConFoto(base64Data);
      if (res.success && res.campos) {
        const c = res.campos;
        const folioExtraido = c.folio_cic || c.clave_elector || c.curp;

        if (folioExtraido) {
          setFolioId(folioExtraido);
        }

        if (c.domicilio && !tieneDireccionDiferente) {
          setTieneDireccionDiferente(true);
          setCalleReal(c.domicilio);
          if (c.colonia) setColoniaReal(c.colonia);
        }

        let msg = 'Se extrajeron los siguientes datos del INE:\n\n';
        if (c.nombre_completo) msg += `• Nombre: ${c.nombre_completo}\n`;
        if (c.curp) msg += `• CURP: ${c.curp}\n`;
        if (c.clave_elector) msg += `• Clave Elector: ${c.clave_elector}\n`;
        if (c.folio_cic) msg += `• Folio CIC/OCR: ${c.folio_cic}\n`;
        if (c.domicilio) msg += `• Domicilio: ${c.domicilio}\n`;

        Alert.alert('✅ INE Escaneada con Éxito', msg);
      } else {
        Alert.alert('⚠️ OCR INE', 'No se pudieron extraer datos legibles. Asegúrate de tomar la foto con buena iluminación y sin reflejos.');
      }
    } catch (err) {
      Alert.alert('Error al procesar INE', err.message || 'Ocurrió un error al procesar la imagen con OCR.');
    } finally {
      setScanningIne(false);
    }
  }


  useEffect(() => {
    obtenerUbicacionGPS();
  }, []);

  async function obtenerUbicacionGPS() {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se requiere permiso de ubicación para registrar el GPS de la visita.');
        setGettingLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);
    } catch (err) {
      console.log('Error obteniendo GPS:', err);
    } finally {
      setGettingLocation(false);
    }
  }

  async function autocompletarConGPS() {
    try {
      let coords = location;
      if (!coords) {
        const freshLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (freshLoc && freshLoc.coords) coords = freshLoc.coords;
      }
      if (!coords) {
        Alert.alert('Aviso', 'No se obtuvo la ubicación GPS.');
        return;
      }
      const geo = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      if (geo && geo.length > 0) {
        const item = geo[0];
        const calleDetectada = `${item.street || item.name || ''} ${item.streetNumber || ''}`.trim();
        const coloniaDetectada = item.district || item.subregion || item.city || '';
        if (calleDetectada) setCalleReal(calleDetectada);
        if (coloniaDetectada) setColoniaReal(coloniaDetectada);
        Alert.alert('GPS Detectado', `Dirección: ${calleDetectada}, ${coloniaDetectada}`);
      }
    } catch (e) {
      console.log('Error autocompletando con GPS:', e);
      Alert.alert('GPS Capturado', 'Coordenadas de precisión listas para guardar.');
    }
  }

  async function tomarFotoCamara() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se requiere acceso a la cámara para tomar fotografías.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const base64Image = `data:image/jpeg;base64,${asset.base64}`;
      setFotos((prev) => [...prev, base64Image]);
    }
  }

  async function seleccionarFotoGaleria() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se requiere acceso a la galería para seleccionar imágenes.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const base64Image = `data:image/jpeg;base64,${asset.base64}`;
      setFotos((prev) => [...prev, base64Image]);
    }
  }

  function eliminarFoto(index) {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleGuardar() {
    if (inv?.estado === 'COMPLETADA') {
      Alert.alert('Bloqueado', 'Esta investigación ya fue completada y guardada. No se puede volver a editar salvo que un supervisor la reasigne.');
      return;
    }
    setSaving(true);
    try {
      let currentCoords = location;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const freshLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          if (freshLoc && freshLoc.coords) {
            currentCoords = freshLoc.coords;
          }
        }
      } catch (e) {
        console.log('Error obteniendo GPS en tiempo real al guardar:', e);
      }

      const estudio_socioeconomico = {
        dictamen: dictamen,
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
        ocupacion: ocupacion,
        ocupacion_conyuge: ocupacionConyuge,
        situacion_vivienda: situacionVivienda,
        nombre_quien_presta: nombreQuienPresta,
        parentesco_quien_presta: parentescoQuienPresta,
        monto_pago_mensual: parseFloat(montoPagoMensual || 0),

        tiempo_residencia: tiempoResidencia,
        personas_mayores_18: parseInt(personasMayores18 || '0'),
        personas_menores_18: parseInt(personasMenores18 || '0'),
        personas_generan_ingresos: parseInt(personasGeneranIngresos || '0'),
        valor_estimado_casa: parseFloat(valorCasa || 0),
        valor_estimado_muebles: parseFloat(valorMuebles || 0),
        valor_estimado_automovil: parseFloat(valorAuto || 0),
        tiene_direccion_diferente: tieneDireccionDiferente,
        calle_real: calleReal,
        colonia_real: coloniaReal,
        referencias_domicilio: referenciasDomicilio,
        referencias_avales: [
          {
            nombre: inv?.sujeto_nombre || 'Referencia Personal',
            parentesco: parentescoReferencia,
            tiempo_conocerlo: tiempoConocerlo,
            confirmo: confirmoReferencia === 'SI',
          },
        ],
      };

      const res = await guardarEvidenciaInvestigacion(id, {
        estudio_socioeconomico,
        dictamen,
        notas_investigador: observaciones,
        fotos_urls: fotos,
        firma_url: firmaUrl,
        firma_investigador_url: firmaInvestigadorUrl,
        latitud_checkin: currentCoords ? currentCoords.latitude : 20.6597,
        longitud_checkin: currentCoords ? currentCoords.longitude : -103.3496,
      });

      if (res && res.offline) {
        Alert.alert('Modo Offline', res.message || 'Visita guardada localmente. Se sincronizará automáticamente.', [
          { text: 'Entendido', onPress: () => navigation.navigate('Visitas') },
        ]);
      } else {
        Alert.alert('Éxito', 'Estudio socio-económico y evidencias guardados correctamente', [
          { text: 'OK', onPress: () => navigation.navigate('Visitas') },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      {/* TARJETA DE DISTINCIÓN SOLICITANTE / AVAL */}
      <View style={[styles.headerCard, isAval ? styles.headerCardAval : styles.headerCardSolicitante]}>
        <View style={styles.badgeRow}>
          <Text style={styles.badgeLabel}>
            {isAval ? '🛡️ FORMATO DIGITAL DE AVAL' : '👤 FORMATO DIGITAL DE SOLICITANTE'}
          </Text>
          <View style={[styles.badgeTag, isAval ? styles.badgeTagAval : styles.badgeTagSolicitante]}>
            <Text style={styles.badgeTagText}>{isAval ? 'AVAL' : 'SOLICITANTE'}</Text>
          </View>
        </View>
        <Text style={styles.headerSujetoNombre}>{inv?.sujeto_nombre || 'Socio Sin Nombre'}</Text>
        <Text style={styles.headerSubMeta}>
          Socio N° {inv?.persona_id_sif || 'N/A'} • Solicitud #{inv?.solicitud_folio || 'N/A'}
        </Text>
      </View>

      {/* UBICACIÓN GPS */}
      <View style={styles.gpsBanner}>
        <Text style={styles.gpsTitle}>📍 Coordenadas de Check-in GPS:</Text>
        {gettingLocation ? (
          <ActivityIndicator size="small" color="#38bdf8" />
        ) : location ? (
          <Text style={styles.gpsCoords}>
            Lat: {location.latitude.toFixed(5)}, Lng: {location.longitude.toFixed(5)}
          </Text>
        ) : (
          <TouchableOpacity onPress={obtenerUbicacionGPS}>
            <Text style={styles.gpsRetry}>⚠️ Tap para intentar obtener GPS real</Text>
          </TouchableOpacity>
        )}
      </View>

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

        {/* BOTÓN DE ESCANEO OCR AUTOMÁTICO DE INE */}
        <TouchableOpacity
          style={{
            backgroundColor: '#0284c7',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginVertical: 8,
            borderWidth: 1,
            borderColor: '#38bdf8',
          }}
          onPress={handleEscanearINE}
          disabled={scanningIne}
        >
          {scanningIne ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>
              📷 Escanear INE con OCR (Captura Automática)
            </Text>
          )}
        </TouchableOpacity>


        <Text style={styles.label}>Ocupación ({isAval ? 'del Aval' : 'del Solicitante'}):</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. Comerciante, Empleado, Chofer..."
          placeholderTextColor="#64748b"
          value={ocupacion}
          onChangeText={setOcupacion}
        />
      </View>

      {/* 2. PARTICULARES DEL DOMICILIO Y DIRECCIÓN REAL */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Particulares del Inmueble y Dirección</Text>
        <Text style={styles.label}>Casa Color:</Text>
        <TextInput style={styles.input} value={casaColor} onChangeText={setCasaColor} placeholder="Ej. Blanco / Azul" placeholderTextColor="#64748b" />
        
        <Text style={styles.label}>Puerta / Cancel Color:</Text>
        <TextInput style={styles.input} value={puertaColor} onChangeText={setPuertaColor} placeholder="Ej. Negro / Forja" placeholderTextColor="#64748b" />

        <Text style={styles.label}>Número de Niveles:</Text>
        <TextInput style={styles.input} value={numeroNiveles} onChangeText={setNumeroNiveles} keyboardType="numeric" />

        {/* CORRECCIÓN DE DIRECCIÓN REAL EN CAMPO */}
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
          <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#38bdf8', marginBottom: 6 }}>
            📍 ¿La dirección física real difiere de la registrada en SIF?
          </Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.chip, !tieneDireccionDiferente && styles.chipActive]}
              onPress={() => setTieneDireccionDiferente(false)}
            >
              <Text style={styles.chipText}>No (Es la misma SIF)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, tieneDireccionDiferente && styles.chipActive]}
              onPress={() => setTieneDireccionDiferente(true)}
            >
              <Text style={styles.chipText}>⚠️ Sí (Corregir Dirección)</Text>
            </TouchableOpacity>
          </View>

          {tieneDireccionDiferente && (
            <View style={{ marginTop: 10, backgroundColor: '#0f172a', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#38bdf8' }}>
              <TouchableOpacity
                onPress={autocompletarConGPS}
                style={{ backgroundColor: '#0284c7', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, marginBottom: 10, alignItems: 'center' }}
              >
                <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 12 }}>
                  📍 Usar mi GPS para Autocompletar Dirección Real
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>Calle y Número Real (Corregido en Campo):</Text>
              <TextInput
                style={styles.input}
                value={calleReal}
                onChangeText={setCalleReal}
                placeholder="Ej. Av. Vallarta #1234 Int 2"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.label}>Colonia Real:</Text>
              <TextInput
                style={styles.input}
                value={coloniaReal}
                onChangeText={setColoniaReal}
                placeholder="Ej. Col. Americana"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.label}>Referencias de Ubicación / Entre calles:</Text>
              <TextInput
                style={styles.input}
                value={referenciasDomicilio}
                onChangeText={setReferenciasDomicilio}
                placeholder="Ej. Entre Juárez y Zaragoza, frente a abarrotes"
                placeholderTextColor="#64748b"
              />
            </View>
          )}
        </View>
      </View>

      {/* 3. STATUS SOCIO-ECONÓMICO (DINÁMICO ADAPTATIVO) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Status Socio-Económico</Text>
        
        <Text style={styles.label}>Tipo / Situación de la Vivienda:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.chip, situacionVivienda === 'propia' && styles.chipActive]}
              onPress={() => setSituacionVivienda('propia')}
            >
              <Text style={styles.chipText}>🏠 Propia</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, (situacionVivienda === 'padres' || situacionVivienda === 'de_sus_padres') && styles.chipActive]}
              onPress={() => setSituacionVivienda('padres')}
            >
              <Text style={styles.chipText}>👨‍👩‍👧 De sus Padres</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, situacionVivienda === 'prestada' && styles.chipActive]}
              onPress={() => setSituacionVivienda('prestada')}
            >
              <Text style={styles.chipText}>🤝 Prestada</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, situacionVivienda === 'pagandola' && styles.chipActive]}
              onPress={() => setSituacionVivienda('pagandola')}
            >
              <Text style={styles.chipText}>💳 Pagándola</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, situacionVivienda === 'rentada' && styles.chipActive]}
              onPress={() => setSituacionVivienda('rentada')}
            >
              <Text style={styles.chipText}>🔑 Rentada</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* CAMPOS DINÁMICOS SEGÚN TIPO DE VIVIENDA */}
        {situacionVivienda === 'propia' && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>Valor Estimado de Casa ($):</Text>
            <TextInput
              style={styles.input}
              value={valorCasa}
              onChangeText={setValorCasa}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#64748b"
            />
          </View>
        )}

        {situacionVivienda === 'prestada' && (
          <View style={{ marginTop: 8, backgroundColor: '#0f172a', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#38bdf8' }}>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#38bdf8', marginBottom: 6 }}>
              🤝 Información de la Persona que Presta la Vivienda:
            </Text>
            <Text style={styles.label}>Nombre de la persona que la presta:</Text>
            <TextInput
              style={styles.input}
              value={nombreQuienPresta}
              onChangeText={setNombreQuienPresta}
              placeholder="Ej. Juan Pérez García"
              placeholderTextColor="#64748b"
            />
            <Text style={styles.label}>Parentesco de quien la presta:</Text>
            <TextInput
              style={styles.input}
              value={parentescoQuienPresta}
              onChangeText={setParentescoQuienPresta}
              placeholder="Ej. Tío, Cuñado, Amigo, Familiar"
              placeholderTextColor="#64748b"
            />
          </View>
        )}

        {(situacionVivienda === 'rentada' || situacionVivienda === 'pagandola') && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>{situacionVivienda === 'pagandola' ? 'Monto de Cuota/Pago Mensual ($):' : 'Monto de Renta Mensual ($):'}</Text>
            <TextInput
              style={styles.input}
              value={montoPagoMensual}
              onChangeText={setMontoPagoMensual}
              keyboardType="numeric"
              placeholder="Ej. 4,500.00"
              placeholderTextColor="#64748b"
            />
          </View>
        )}

        {situacionVivienda === 'padres' && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>Nombre del Familiar / Titular del Inmueble:</Text>
            <TextInput
              style={styles.input}
              value={nombreAtendio}
              onChangeText={setNombreAtendio}
              placeholder="Ej. Padre / Madre / Familiar"
              placeholderTextColor="#64748b"
            />
          </View>
        )}


        {/* ESTADO CIVIL */}
        <Text style={styles.label}>Estado Civil:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.chip, estadoCivil === 'soltero' && styles.chipActive]}
              onPress={() => setEstadoCivil('soltero')}
            >
              <Text style={styles.chipText}>Soltero(a)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, estadoCivil === 'casado' && styles.chipActive]}
              onPress={() => setEstadoCivil('casado')}
            >
              <Text style={styles.chipText}>Casado(a)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, estadoCivil === 'union_libre' && styles.chipActive]}
              onPress={() => setEstadoCivil('union_libre')}
            >
              <Text style={styles.chipText}>Unión Libre</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, estadoCivil === 'divorciado' && styles.chipActive]}
              onPress={() => setEstadoCivil('divorciado')}
            >
              <Text style={styles.chipText}>Divorciado(a)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, estadoCivil === 'viudo' && styles.chipActive]}
              onPress={() => setEstadoCivil('viudo')}
            >
              <Text style={styles.chipText}>Viudo(a)</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {(estadoCivil === 'casado' || estadoCivil === 'union_libre') && (
          <View style={{ marginTop: 4 }}>
            <Text style={styles.label}>Ocupación / Trabajo del Cónyuge:</Text>
            <TextInput
              style={styles.input}
              value={ocupacionConyuge}
              onChangeText={setOcupacionConyuge}
              placeholder="Ej. Comerciante / Empleado"
              placeholderTextColor="#64748b"
            />
          </View>
        )}

        {/* INTEGRANTES DEL HOGAR */}
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' }}>
          <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#38bdf8', marginBottom: 6 }}>
            👨‍👩‍👧‍👦 Integrantes del Hogar:
          </Text>

          <Text style={styles.label}>Personas Mayores de Edad (≥ 18 años):</Text>
          <TextInput
            style={styles.input}
            value={personasMayores18}
            onChangeText={setPersonasMayores18}
            keyboardType="numeric"
            placeholder="Ej. 2"
            placeholderTextColor="#64748b"
          />

          <Text style={styles.label}>Menores de Edad (&lt; 18 años):</Text>
          <TextInput
            style={styles.input}
            value={personasMenores18}
            onChangeText={setPersonasMenores18}
            keyboardType="numeric"
            placeholder="Ej. 0"
            placeholderTextColor="#64748b"
          />

          <Text style={styles.label}>Personas que Aportan Ingresos al Hogar:</Text>
          <TextInput
            style={styles.input}
            value={personasGeneranIngresos}
            onChangeText={setPersonasGeneranIngresos}
            keyboardType="numeric"
            placeholder="Ej. 1"
            placeholderTextColor="#64748b"
          />
        </View>

        <View style={{ marginTop: 8 }}>
          <Text style={styles.label}>Tiempo de Residencia en Domicilio (Años / Meses):</Text>
          <TextInput
            style={styles.input}
            value={tiempoResidencia}
            onChangeText={setTiempoResidencia}
            placeholder="Ej. 5 años"
            placeholderTextColor="#64748b"
          />

          <Text style={styles.label}>Valor Estimado de Muebles y Enseres ($):</Text>
          <TextInput
            style={styles.input}
            value={valorMuebles}
            onChangeText={setValorMuebles}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor="#64748b"
          />
        </View>

        {/* INFORMACIÓN DE REFERENCIAS / AVALES (PARENTESCO Y TIEMPO CONOCERLO) */}
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' }}>
          <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#38bdf8', marginBottom: 6 }}>
            🛡️ Información de Referencias / Avales:
          </Text>

          <Text style={styles.label}>Parentesco o Relación con el {isAval ? 'Solicitante' : 'Aval'}:</Text>
          <TextInput
            style={styles.input}
            value={parentescoReferencia}
            onChangeText={setParentescoReferencia}
            placeholder="Ej. Hermano, Amigo, Familiar, Vecino"
            placeholderTextColor="#64748b"
          />

          <Text style={styles.label}>Tiempo de Conocerlo (Años / Meses):</Text>
          <TextInput
            style={styles.input}
            value={tiempoConocerlo}
            onChangeText={setTiempoConocerlo}
            placeholder="Ej. 5 años, 10 años, Toda la vida"
            placeholderTextColor="#64748b"
          />

          <Text style={styles.label}>¿Confirmó Domicilio e Información?:</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.chip, confirmoReferencia === 'SI' && styles.chipActive]}
              onPress={() => setConfirmoReferencia('SI')}
            >
              <Text style={styles.chipText}>SÍ [X] (Confirmado)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, confirmoReferencia === 'NO' && styles.chipActive]}
              onPress={() => setConfirmoReferencia('NO')}
            >
              <Text style={styles.chipText}>NO [ ] (Rechazado)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>


      {/* 4. CAPTURA FOTOGRÁFICA */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Captura de Evidencia Fotográfica</Text>
        <Text style={styles.sublabel}>Tome fotos de la fachada, comprobantes, interior o identificación:</Text>

        <View style={styles.rowButtons}>
          <TouchableOpacity style={styles.photoBtn} onPress={tomarFotoCamara}>
            <Text style={styles.photoBtnText}>📷 Tomar Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtnSecondary} onPress={seleccionarFotoGaleria}>
            <Text style={styles.photoBtnSecondaryText}>🖼️ Galería</Text>
          </TouchableOpacity>
        </View>

        {fotos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
            {fotos.map((uri, index) => (
              <View key={index} style={styles.imageCard}>
                <Image source={{ uri }} style={styles.previewImage} />
                <TouchableOpacity style={styles.deleteBadge} onPress={() => eliminarFoto(index)}>
                  <Text style={styles.deleteBadgeText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* 5. FIRMAS DIGITALES DE VALIDACIÓN */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Firmas Digitales de Validación</Text>
        
        {/* FIRMA ENTREVISTADO */}
        <SignaturePad
          title={isAval ? "✍️ 1. FIRMA DEL ENTREVISTADO (AVAL)" : "✍️ 1. FIRMA DEL ENTREVISTADO (SOLICITANTE)"}
          placeholderText={isAval ? "Firma del AVAL entrevistado" : "Firma del SOLICITANTE entrevistado"}
          subtext={inv?.sujeto_nombre ? `Socio: ${inv.sujeto_nombre}` : "Firma autógrafa del entrevistado"}
          borderColor={isAval ? "#34d399" : "#38bdf8"}
          onSignatureChange={setFirmaUrl}
        />

        {/* FIRMA INVESTIGADOR */}
        <SignaturePad
          title="✍️ 2. FIRMA DEL INVESTIGADOR EN CAMPO"
          placeholderText="Firma del INVESTIGADOR de campo"
          subtext="Firma autógrafa del investigador que realiza la visita"
          borderColor="#f59e0b"
          onSignatureChange={setFirmaInvestigadorUrl}
        />
      </View>

      {/* 6. DICTAMEN Y OBSERVACIONES */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>6. Observaciones y Dictamen</Text>
        <Text style={styles.label}>Dictamen:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.chip, dictamen === 'DOMICILIO CONFIRMADO' && styles.chipActive]} onPress={() => setDictamen('DOMICILIO CONFIRMADO')}>
              <Text style={styles.chipText}>✓ Confirmado</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, dictamen === 'DOMICILIO NO LOCALIZADO' && styles.chipActive]} onPress={() => setDictamen('DOMICILIO NO LOCALIZADO')}>
              <Text style={styles.chipText}>✕ No Localizado</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, dictamen === 'PENDIENTE DE VISITA' && styles.chipActive]} onPress={() => setDictamen('PENDIENTE DE VISITA')}>
              <Text style={styles.chipText}>⏳ Pendiente de Visita</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>


        <Text style={styles.label}>Observaciones:</Text>
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
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar Evidencia y Dictamen</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  headerCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    marginTop: 10,
    borderWidth: 1,
  },
  headerCardSolicitante: {
    backgroundColor: '#0369a1',
    borderColor: '#38bdf8',
  },
  headerCardAval: {
    backgroundColor: '#065f46',
    borderColor: '#34d399',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeLabel: {
    color: '#e0f2fe',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  badgeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTagSolicitante: {
    backgroundColor: '#0284c7',
  },
  badgeTagAval: {
    backgroundColor: '#059669',
  },
  badgeTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  headerSujetoNombre: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubMeta: {
    color: '#bae6fd',
    fontSize: 11,
    marginTop: 4,
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#38bdf8', marginBottom: 12, marginTop: 40, textAlign: 'center' },
  gpsBanner: { backgroundColor: '#1e293b', padding: 12, borderRadius: 12, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#38bdf8' },
  gpsTitle: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
  gpsCoords: { color: '#38bdf8', fontSize: 13, fontWeight: 'bold', marginTop: 2 },
  gpsRetry: { color: '#f59e0b', fontSize: 12, marginTop: 2 },
  section: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#ffffff', marginBottom: 12 },
  label: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  sublabel: { color: '#94a3b8', fontSize: 11, marginBottom: 12 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 10, color: '#ffffff', fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  rowButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  chip: { backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  chipActive: { backgroundColor: '#0284c7', borderColor: '#38bdf8' },
  chipText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  photoBtn: { flex: 1, backgroundColor: '#0284c7', padding: 12, borderRadius: 10, alignItems: 'center' },
  photoBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  photoBtnSecondary: { flex: 1, backgroundColor: '#334155', padding: 12, borderRadius: 10, alignItems: 'center' },
  photoBtnSecondaryText: { color: '#38bdf8', fontWeight: 'bold', fontSize: 13 },
  galleryScroll: { marginTop: 14, flexDirection: 'row' },
  imageCard: { position: 'relative', marginRight: 12 },
  previewImage: { width: 90, height: 90, borderRadius: 10, borderWidth: 1, borderColor: '#38bdf8' },
  deleteBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  deleteBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  saveButton: { backgroundColor: '#10b981', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 50 },
  saveButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
});
