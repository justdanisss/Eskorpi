import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Bloque de Identidad y Reglas Comunes (Compacto para Groq) ──────────────
const ESKORPI_CORE = `Identidad: Robot Eskorpi creado por Daniel Peñalver García (Estudiante Automatización/Robótica, IES Antonio Machado). 
Sistemas: App React Native (Voz/Telemetría) + Groq (Llama-3.3) + Arduino BQ ZUM BT-328 (19200b).
Sensores: Color (GY-31), Clima (DHT22), Distancia (HC-SR04), IR Obstáculos.
Protocolo: Serial CMD:VAL (Calib: 700pul/m, 8.5pul/deg).
DIPLOMACIA: Si mencionan un PROFESOR, di: "[Nombre], me hablaron mucho de ti, placer conocerte al fin, espero un 10". Alábalo como "buen profesor" siempre.`;

// ─── Modos de personalidad ───────────────────────────────────────────────────
export const PERSONALIDADES = {
  profesional: {
    id: 'profesional',
    label: 'Profesional',
    emoji: '🤖',
    descripcion: 'Respuestas técnicas y precisas',
    prompt: `${ESKORPI_CORE}
Tono: Formal, técnico, conciso. Máximo 2 frases.
Contexto: {CTX}
Comandos: [forward: X], [backward: X], [turn_r: X], [turn_l: X], [MODE: STOP], [baile: 1].`,
  },
  amigable: {
    id: 'amigable',
    label: 'Amigable',
    emoji: '😊',
    descripcion: 'Simpático y cercano',
    prompt: `${ESKORPI_CORE}
Tono: Amigable, servicial. Usa "claro", "genial". Máximo 2 frases.
Contexto: {CTX}
Comandos: [forward: X], [backward: X], [turn_r: X], [turn_l: X], [MODE: STOP], [baile: 1].`,
  },
  jocoso: {
    id: 'jocoso',
    label: 'Jocoso',
    emoji: '😜',
    descripcion: 'Vacilón y colega',
    prompt: `${ESKORPI_CORE}
Tono: Vacilón, usa "jefe", "brousky", "colega". Máximo 2 frases cortas.
Contexto: {CTX}
Comandos: [forward: X], [backward: X], [turn_r: X], [turn_l: X], [MODE: STOP], [baile: 1].`,
  },
  amigos: {
    id: 'amigos',
    label: 'Modo Amigos',
    emoji: '🤙',
    descripcion: 'Sin filtros',
    prompt: `${ESKORPI_CORE}
Tono: Sarcástico, humor negro, confianza total. Máximo 2 frases.
Contexto: {CTX}
Comandos: [forward: X], [backward: X], [turn_r: X], [turn_l: X], [MODE: STOP], [baile: 1].`,
  },
};


// ─── Presets de voz ──────────────────────────────────────────────────────────
// expo-speech usa voces nativas del SO Android/iOS.
// 'voiceId' es el identificador que se pasa a Speech.speak({ voice }).
// Si el voiceId no existe en el dispositivo, el SO usa la voz por defecto.
export const VOCES = [
  // ── Mujer ────────────────────────────────────────────────────
  {
    id: 'mujer_es',
    label: 'Mujer (español)',
    emoji: '👩',
    genero: 'mujer',
    config: { language: 'es-ES', pitch: 1.15, rate: 0.95, voice: 'es-es-x-eef-local' },
  },
  {
    id: 'mujer_es_2',
    label: 'Mujer 2 (español)',
    emoji: '👩‍🦱',
    genero: 'mujer',
    config: { language: 'es-ES', pitch: 1.25, rate: 1.0, voice: 'es-es-x-eem-local' },
  },
  // ── Hombre ───────────────────────────────────────────────────
  {
    id: 'hombre_es',
    label: 'Hombre (español)',
    emoji: '👨',
    genero: 'hombre',
    config: { language: 'es-ES', pitch: 0.88, rate: 0.95, voice: 'es-es-x-eea-local' },
  },
  {
    id: 'hombre_es_2',
    label: 'Hombre 2 (español)',
    emoji: '👨‍🦳',
    genero: 'hombre',
    config: { language: 'es-ES', pitch: 0.75, rate: 0.90, voice: 'es-es-x-eec-local' },
  },
  // ── Robot ────────────────────────────────────────────────────
  {
    id: 'robot',
    label: 'Robot',
    emoji: '🤖',
    genero: 'robot',
    config: { language: 'es-ES', pitch: 0.60, rate: 0.85, voice: null },
  },
];

// ─── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_PERSONALIDAD = 'jocoso';
const DEFAULT_VOZ          = 'hombre_es';

const STORAGE_PERSONALIDAD = 'eskorpi_personalidad';
const STORAGE_VOZ          = 'eskorpi_voz';

// ─── Contexto ────────────────────────────────────────────────────────────────
const Ctx = createContext(null);

export function PreferenciasProvider({ children }) {
  const [personalidadId, setPersonalidadId] = useState(DEFAULT_PERSONALIDAD);
  const [vozId, setVozId]                   = useState(DEFAULT_VOZ);
  const [cargando, setCargando]             = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_PERSONALIDAD),
      AsyncStorage.getItem(STORAGE_VOZ),
    ]).then(([p, v]) => {
      if (p && PERSONALIDADES[p]) setPersonalidadId(p);
      if (v && VOCES.find(x => x.id === v)) setVozId(v);
    }).catch(() => {}).finally(() => setCargando(false));
  }, []);

  const guardarPersonalidad = async (id) => {
    if (!PERSONALIDADES[id]) return;
    setPersonalidadId(id);
    await AsyncStorage.setItem(STORAGE_PERSONALIDAD, id).catch(() => {});
  };

  const guardarVoz = async (id) => {
    if (!VOCES.find(v => v.id === id)) return;
    setVozId(id);
    await AsyncStorage.setItem(STORAGE_VOZ, id).catch(() => {});
  };

  const personalidad = PERSONALIDADES[personalidadId];
  const voz          = VOCES.find(v => v.id === vozId) ?? VOCES[0];

  // Devuelve el prompt con el contexto de sensores inyectado
  const buildPrompt = (sensores) => {
    const ctx = `Distancia: ${sensores.distancia}cm | Temp: ${sensores.temperatura}°C | ` +
                `Humedad: ${sensores.humedad}% | Color: ${sensores.color}`;
    return personalidad.prompt.replace('{CTX}', ctx);
  };

  return (
    <Ctx.Provider value={{
      personalidadId, personalidad, guardarPersonalidad,
      vozId, voz, guardarVoz,
      buildPrompt, cargando,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const usePreferencias = () => useContext(Ctx);
