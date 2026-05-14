import React, {
  createContext, useContext, useState,
  useRef, useCallback
} from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';

let RNBluetooth = null;
try {
  RNBluetooth = require('react-native-bluetooth-classic').default;
} catch (_) {}

const Ctx = createContext(null);

async function pedirPermisosBT() {
  if (Platform.OS !== 'android' || Platform.Version < 31) return true;
  try {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ]);
    const ok = Object.values(res).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
    if (!ok) Alert.alert('Permiso BT requerido',
      'Ve a Ajustes → Apps → Eskorpi → Permisos → Dispositivos cercanos → Permitir.');
    return ok;
  } catch (e) { return false; }
}

export function BluetoothProvider({ children }) {
  const [dispositivos, setDispositivos]     = useState([]);
  const [conectado, setConectado]           = useState(false);
  const [dispositivoActual, setDispositivo] = useState(null);
  const [buscando, setBuscando]             = useState(false);
  const [conectando, setConectando]         = useState(false);

  const connRef    = useRef(null);
  const listenRef  = useRef(null);
  const bufferRef  = useRef('');
  const handlerRef = useRef(null); // ← ref directa, nunca en estado

  // SensoresContext llama esto para registrar su handler
  const setOnData = useCallback((fn) => {
    handlerRef.current = fn;
  }, []); // ← sin dependencias, función estable para siempre

  // Envía línea al handler de SensoresContext
  const dispatchLinea = (linea) => {
    if (handlerRef.current) {
      handlerRef.current(linea);
    }
  };

  const buscarDispositivos = async () => {
    setBuscando(true);
    try {
      if (!RNBluetooth) {
        await new Promise(r => setTimeout(r, 700));
        setDispositivos([{ address: '00:11:22:33:44:55', name: 'HC-05 (Mock)' }]);
        return;
      }
      const ok = await pedirPermisosBT();
      if (!ok) return;
      const lista = await RNBluetooth.getBondedDevices();
      setDispositivos(lista ?? []);
      if (!lista?.length) Alert.alert('Sin dispositivos',
        'Empareja el HC-05 en Ajustes Bluetooth del móvil (PIN: 1234) y vuelve a buscar.');
    } catch (e) {
      Alert.alert('Error Bluetooth', e.message);
    } finally {
      setBuscando(false);
    }
  };

  const conectar = async (dispositivo) => {
    setConectando(true);
    try {
      if (!RNBluetooth) {
        await new Promise(r => setTimeout(r, 600));
        setConectado(true);
        setDispositivo(dispositivo);
        _iniciarSimulacion();
        return true;
      }
      const ok = await pedirPermisosBT();
      if (!ok) return false;

      const conn = await RNBluetooth.connectToDevice(dispositivo.address, { connectorType: 'rfcomm', delimiter: '\n', charset: 'utf-8' });
      connRef.current  = conn;
      bufferRef.current = '';
      setConectado(true);
      setDispositivo(dispositivo);

      // v1.73-rc: suscripción global en RNBluetooth, no sobre conn
      // d.data lleva el chunk; también puede venir como d.message en algunos builds
      listenRef.current = RNBluetooth.onDataReceived((d) => {
        const chunk = d.data ?? d.message ?? '';
        bufferRef.current += chunk;
        const lineas = bufferRef.current.split('\n');
        bufferRef.current = lineas.pop(); // última línea puede estar incompleta
        lineas.forEach(l => {
          const linea = l.trim();
          if (linea) dispatchLinea(linea);
        });
      });

      return true;
    } catch (e) {
      Alert.alert('Error de conexión', e.message);
      return false;
    } finally {
      setConectando(false);
    }
  };

  const desconectar = async () => {
    _pararSimulacion();
    listenRef.current?.remove();
    bufferRef.current = '';
    try { await connRef.current?.disconnect(); } catch (_) {}
    connRef.current = null;
    setConectado(false);
    setDispositivo(null);
  };

  const enviar = async (cmd) => {
    if (!conectado) return false;
    if (!RNBluetooth || !connRef.current) {
      console.log('[BT·MOCK TX]', cmd);
      return true;
    }
    try { await connRef.current.write(`${cmd}\n`); return true; }
    catch (e) { console.error('[BT TX]', e); return false; }
  };

  // ── Mock para desarrollo sin hardware ──────────────────────
  const simRef = useRef(null);
  const _iniciarSimulacion = () => {
    let dist = 45, temp = 22.5, hum = 55, ci = 2;
    const colores = ['ROJO', 'VERDE', 'AZUL', 'BLANCO', 'NEGRO'];
    simRef.current = setInterval(() => {
      dist = Math.max(8, Math.min(120, dist + (Math.random() - 0.5) * 2));
      dispatchLinea(`US:${dist.toFixed(1)}`);
      if (Math.random() < 0.05) {
        temp = Math.max(20, Math.min(26, temp + (Math.random() - 0.5) * 0.1));
        hum  = Math.max(40, Math.min(65, hum  + (Math.random() - 0.5) * 0.5));
        dispatchLinea(`CLIMA:${temp.toFixed(1)},${hum.toFixed(1)}`);
      }
      if (Math.random() < 0.08) {
        ci = Math.floor(Math.random() * colores.length);
        dispatchLinea(`COLOR:${colores[ci]}`);
      }
    }, 300);
  };
  const _pararSimulacion = () => {
    if (simRef.current) { clearInterval(simRef.current); simRef.current = null; }
  };

  return (
    <Ctx.Provider value={{
      dispositivos, conectado, dispositivoActual, buscando, conectando,
      buscarDispositivos, conectar, desconectar, enviar, setOnData,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useBluetooth = () => useContext(Ctx);
