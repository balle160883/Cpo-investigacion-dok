import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from './src/screens/LoginScreen';
import VisitasScreen from './src/screens/VisitasScreen';
import DetalleInvestigacionScreen from './src/screens/DetalleInvestigacionScreen';
import CapturaFormatoScreen from './src/screens/CapturaFormatoScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Visitas" component={VisitasScreen} options={{ title: 'Mis Investigaciones' }} />
        <Stack.Screen name="DetalleInvestigacion" component={DetalleInvestigacionScreen} options={{ title: 'Detalle de Visita' }} />
        <Stack.Screen name="CapturaFormato" component={CapturaFormatoScreen} options={{ title: 'Captura de Formato Oficial' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
