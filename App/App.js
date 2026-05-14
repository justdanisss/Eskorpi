import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { GroqProvider }          from './context/GroqContext';
import { PreferenciasProvider }  from './context/PreferenciasContext';
import { BluetoothProvider }     from './context/BluetoothContext';
import { SensoresProvider }      from './context/SensoresContext';

import HomeScreen          from './screens/HomeScreen';
import MantenimientoScreen from './screens/MantenimientoScreen';
import ControlScreen       from './screens/ControlScreen';
import ConfigScreen        from './screens/ConfigScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <GroqProvider>
      <PreferenciasProvider>
        <BluetoothProvider>
          <SensoresProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <Stack.Navigator
                screenOptions={{
                  headerStyle:      { backgroundColor: '#0A0A0A' },
                  headerTintColor:  '#F5C842',
                  headerTitleStyle: { fontWeight: '800', letterSpacing: 3, fontSize: 13 },
                  headerShadowVisible: false,
                  contentStyle:     { backgroundColor: '#080808' },
                  animation:        'slide_from_right',
                }}
              >
                <Stack.Screen name="Home"          component={HomeScreen}          options={{ headerShown: false }} />
                <Stack.Screen name="Mantenimiento" component={MantenimientoScreen} options={{ title: 'MANTENIMIENTO' }} />
                <Stack.Screen name="Control"       component={ControlScreen}       options={{ title: 'CONTROL MANUAL' }} />
                <Stack.Screen name="Config"        component={ConfigScreen}        options={{ title: 'CONFIGURACIÓN' }} />
              </Stack.Navigator>
            </NavigationContainer>
          </SensoresProvider>
        </BluetoothProvider>
      </PreferenciasProvider>
    </GroqProvider>
  );
}
