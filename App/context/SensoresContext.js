import React, {
  createContext, useContext,
  useState, useEffect, useRef, useCallback
} from 'react';
import { useBluetooth } from './BluetoothContext';

const Ctx = createContext(null);

const SENSORES_INICIAL = {
  distancia:   999,
  temperatura: 0,
  humedad:     0,
  color:       'N/A',
  ir_der:      false,
  ir_izq:      false,
  hw_estado:   'ON',
  ultima:      null,
};

export function SensoresProvider({ children }) {
  const { setOnData } = useBluetooth();
  const [sensores, setSensores] = useState(SENSORES_INICIAL);
  const [logs, setLogs]         = useState([
    { id: 0, tipo: 'sistema', texto: 'Sistema iniciado — Eskorpi v3.3', ts: new Date() }
  ]);

  // Usar refs para evitar dependencias en useEffect que rompen el ciclo
  const setOnDataRef  = useRef(setOnData);
  const setSensoresRef = useRef(setSensores);
  const setLogsRef    = useRef(setLogs);

  // Actualizar refs cuando cambian (sin causar re-renders)
  useEffect(() => { setOnDataRef.current  = setOnData;   }, [setOnData]);
  useEffect(() => { setSensoresRef.current = setSensores; }, [setSensores]);
  useEffect(() => { setLogsRef.current    = setLogs;     }, [setLogs]);

  const addLog = useCallback((tipo, texto) => {
    setLogsRef.current(prev => {
      const entry = { id: Date.now() + Math.random(), tipo, texto, ts: new Date() };
      return [...prev.slice(-299), entry];
    });
  }, []); // sin dependencias — estable para siempre

  // Registrar handler UNA SOLA VEZ al montar
  // [] como dependencias = nunca se re-ejecuta, nunca se limpia hasta desmontar
  useEffect(() => {
    const handler = (linea) => {
      // Log crudo siempre
      setLogsRef.current(prev => {
        const entry = { id: Date.now() + Math.random(), tipo: 'rx', texto: linea, ts: new Date() };
        return [...prev.slice(-299), entry];
      });

      // Parsear y actualizar sensores
      setSensoresRef.current(prev => {
        const s = { ...prev, ultima: new Date() };

        if (linea.startsWith('US:')) {
          const d = parseFloat(linea.substring(3));
          if (!isNaN(d) && d >= 2 && d <= 400) s.distancia = d;

        } else if (linea.startsWith('CLIMA:')) {
          const partes = linea.substring(6).split(',');
          const t = parseFloat(partes[0]);
          const h = parseFloat(partes[1]);
          if (!isNaN(t)) s.temperatura = t;
          if (!isNaN(h)) s.humedad     = h;

        } else if (linea.startsWith('COLOR:')) {
          const c = linea.substring(6).trim().toUpperCase();
          if (c) s.color = c;

        } else if (linea.startsWith('STATUS:')) {
          s.hw_estado = linea.substring(7).trim().toUpperCase();

        } else if (linea === 'OBS_IR_DER') {
          s.ir_der = true;
          setTimeout(() =>
            setSensoresRef.current(p => ({ ...p, ir_der: false })), 2500);

        } else if (linea === 'OBS_IR_IZQ') {
          s.ir_izq = true;
          setTimeout(() =>
            setSensoresRef.current(p => ({ ...p, ir_izq: false })), 2500);
        }

        return s;
      });
    };

    // Registrar handler — estable, no se reemplaza nunca
    setOnDataRef.current(handler);

    // Añadir log de inicio
    setLogsRef.current(prev => [
      ...prev,
      { id: Date.now(), tipo: 'sistema', texto: '✓ Escuchando datos del robot...', ts: new Date() }
    ]);

    // NO limpiar el handler al desmontar — queremos que persista
    // mientras la app esté viva
  }, []); // ← [] = solo se ejecuta UNA VEZ al montar

  return (
    <Ctx.Provider value={{ sensores, logs, addLog }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSensores = () => useContext(Ctx);
