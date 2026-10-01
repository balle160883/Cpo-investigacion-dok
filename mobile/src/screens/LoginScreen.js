import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { login, primerCambioPassword, getToken, getUser } from '../api/apiClient';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAutoLogin, setCheckingAutoLogin] = useState(true);

  // Estado para cambio obligatorio de contraseña en primer ingreso
  const [requiereCambioPassword, setRequiereCambioPassword] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  useEffect(() => {
    verificarSesionExistente();
  }, []);

  async function verificarSesionExistente() {
    try {
      const token = await getToken();
      const user = await getUser();
      if (token && user && !user.debe_cambiar_password) {
        navigation.replace('Visitas', { user });
        return;
      }
    } catch (e) {
      console.log('Error verificando sesión previa:', e);
    } finally {
      setCheckingAutoLogin(false);
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Atención', 'Ingresa tu correo y contraseña');
      return;
    }
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      
      if (data.debe_cambiar_password) {
        setPendingUser(data.user);
        setRequiereCambioPassword(true);
        Alert.alert(
          'Actualización de Seguridad',
          'Has iniciado con una clave temporal. Por seguridad, debes establecer una contraseña personal antes de continuar.'
        );
        return;
      }

      navigation.replace('Visitas', { user: data.user });
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCambiarPassword() {
    if (!nuevaPassword || !confirmarPassword) {
      Alert.alert('Atención', 'Ingresa la nueva contraseña y su confirmación.');
      return;
    }

    if (nuevaPassword.length < 6) {
      Alert.alert('Contraseña corta', 'La nueva contraseña debe tener mínimo 6 caracteres.');
      return;
    }

    if (nuevaPassword === 'Seguridad2026@') {
      Alert.alert('Contraseña no válida', 'Debes crear una contraseña distinta a la clave temporal.');
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }

    setCambiandoPassword(true);
    try {
      const res = await primerCambioPassword(
        nuevaPassword,
        confirmarPassword,
        email.trim(),
        password
      );

      Alert.alert(
        '¡Listo!',
        'Tu contraseña ha sido personalizada exitosamente. A partir de ahora ingresarás con esta nueva clave.',
        [
          {
            text: 'Continuar',
            onPress: () => {
              navigation.replace('Visitas', { user: res.user || pendingUser });
            }
          }
        ]
      );
    } catch (err) {
      Alert.alert('Error al guardar contraseña', err.message);
    } finally {
      setCambiandoPassword(false);
    }
  }

  if (checkingAutoLogin) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={{ color: '#94a3b8', marginTop: 16, fontSize: 14 }}>Iniciando sesión...</Text>
      </View>
    );
  }

  // Vista de Cambio Obligatorio de Contraseña
  if (requiereCambioPassword) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.logoContainer}>
          <View style={[styles.badgeIcon, { backgroundColor: '#f59e0b' }]}>
            <Text style={styles.logoText}>🔒</Text>
          </View>
          <Text style={styles.title}>Nueva Contraseña</Text>
          <Text style={styles.subtitle}>
            Hola {pendingUser?.nombre || 'Investigador'}, personaliza tu acceso para continuar
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.helperText}>
            Por motivos de seguridad institucional, define tu contraseña personal privada (mínimo 6 caracteres).
          </Text>

          <Text style={styles.label}>Nueva Contraseña:</Text>
          <TextInput
            style={styles.input}
            value={nuevaPassword}
            onChangeText={setNuevaPassword}
            placeholder="Escribe tu nueva contraseña"
            placeholderTextColor="#64748b"
            secureTextEntry
          />

          <Text style={styles.label}>Confirmar Nueva Contraseña:</Text>
          <TextInput
            style={styles.input}
            value={confirmarPassword}
            onChangeText={setConfirmarPassword}
            placeholder="Repite tu nueva contraseña"
            placeholderTextColor="#64748b"
            secureTextEntry
          />

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#10b981' }]} 
            onPress={handleCambiarPassword} 
            disabled={cambiandoPassword}
          >
            {cambiandoPassword ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Guardar y Entrar al Sistema</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => {
              setRequiereCambioPassword(false);
              setPassword('');
              setNuevaPassword('');
              setConfirmarPassword('');
            }}
            disabled={cambiandoPassword}
          >
            <Text style={styles.cancelButtonText}>Volver al Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Vista de Login habitual
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.badgeIcon}>
          <Text style={styles.logoText}>CPO</Text>
        </View>
        <Text style={styles.title}>Caja Oblatos</Text>
        <Text style={styles.subtitle}>Investigaciones Domiciliarias</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Correo Electrónico o Usuario:</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="ejemplo@cajaoblatos.com.mx"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Contraseña:</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#64748b"
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar Sesión en Campo</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  badgeIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 22,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  helperText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 10,
  },
  form: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#0284c7',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 22,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cancelButton: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
