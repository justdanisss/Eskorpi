import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'groq_api_key';

const Ctx = createContext(null);

export function GroqProvider({ children }) {
  const [groqKey, setGroqKey]     = useState('');
  const [cargando, setCargando]   = useState(true);

  // Cargar key guardada al arrancar
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(val => { if (val) setGroqKey(val); })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const guardarKey = async (key) => {
    const limpia = key.trim();
    setGroqKey(limpia);
    try {
      if (limpia) {
        await AsyncStorage.setItem(STORAGE_KEY, limpia);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
  };

  return (
    <Ctx.Provider value={{ groqKey, guardarKey, cargando }}>
      {children}
    </Ctx.Provider>
  );
}

export const useGroq = () => useContext(Ctx);
