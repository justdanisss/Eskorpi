import React, { useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBluetooth } from '../context/BluetoothContext';
import Joystick from '../components/Joystick';

// Calibración
const PPM = 700 / (Math.PI * 0.043);
const PPG = 8.5;

// Velocidad máxima continua (para joystick analógico)
// Convertimos la posición del joystick a pulsos proporcionales
const PULSOS_PASO   = Math.round(0.05 * PPM);   // ~12 pulsos por tick
const GRADO_PASO    = Math.round(5 * PPG);       // ~42 pulsos por tick de giro

export default function ControlScreen() {
  const { enviar, conectado } = useBluetooth();
  const timerMov  = useRef(null);
  const timerGiro = useRef(null);

  // ── Joystick izquierdo: avance/retroceso ────────────────────
  const onMoveIzq = useCallback(({ x, y }) => {
    clearInterval(timerMov.current);
    if (y === 0) { enviar('STOP:0'); return; }
    const cmd = y < 0
      ? `MOVE_F:${Math.round(Math.abs(y) * PULSOS_PASO)}`
      : `MOVE_B:${Math.round(Math.abs(y) * PULSOS_PASO)}`;
    timerMov.current = setInterval(() => enviar(cmd), 200);
  }, [enviar]);

  const onReleaseIzq = useCallback(() => {
    clearInterval(timerMov.current);
    enviar('STOP:0');
  }, [enviar]);

  // ── Joystick derecho: giro ──────────────────────────────────
  const onMoveDer = useCallback(({ x }) => {
    clearInterval(timerGiro.current);
    if (x === 0) { enviar('STOP:0'); return; }
    const cmd = x > 0
      ? `TURN_R:${Math.round(Math.abs(x) * GRADO_PASO)}`
      : `TURN_L:${Math.round(Math.abs(x) * GRADO_PASO)}`;
    timerGiro.current = setInterval(() => enviar(cmd), 200);
  }, [enviar]);

  const onReleaseDer = useCallback(() => {
    clearInterval(timerGiro.current);
    enviar('STOP:0');
  }, [enviar]);

  // ── Secuencia de baile ──────────────────────────────────────
  const baile = async () => {
    const seq = ['TURN_L:200','TURN_R:400','TURN_L:200','MOVE_B:100','MOVE_F:100'];
    for (const c of seq) {
      await enviar(c);
      await new Promise(r => setTimeout(r, 900));
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} scrollEnabled={false}>

        {/* Aviso sin BT */}
        {!conectado && (
          <View style={s.warnBox}>
            <Ionicons name="warning-outline" size={14} color="#FF4444" />
            <Text style={s.warnText}>Sin conexión BT — ve a Configuración</Text>
          </View>
        )}

        {/* ── ETIQUETAS ── */}
        <View style={s.labelsRow}>
          <Text style={s.label}>AVANCE / RETROCESO</Text>
          <Text style={s.label}>GIRO</Text>
        </View>

        {/* ── JOYSTICKS ── */}
        <View style={s.joysticksRow}>
          <View style={s.joyWrap}>
            <Joystick
              onMove={onMoveIzq}
              onRelease={onReleaseIzq}
              color={conectado ? '#F5C842' : '#444'}
            />
            <Text style={s.joyHint}>↑ adelante  ↓ atrás</Text>
          </View>

          <View style={s.joyDivider} />

          <View style={s.joyWrap}>
            <Joystick
              onMove={onMoveDer}
              onRelease={onReleaseDer}
              color={conectado ? '#F5C842' : '#444'}
            />
            <Text style={s.joyHint}>← izq   der →</Text>
          </View>
        </View>

        {/* ── STOP CENTRAL ── */}
        <TouchableOpacity
          style={s.btnStop}
          onPress={() => enviar('STOP:0')}
          activeOpacity={0.7}
        >
          <Ionicons name="stop" size={22} color="#FFF" />
          <Text style={s.btnStopText}>STOP</Text>
        </TouchableOpacity>

        {/* ── ACCIONES ESPECIALES ── */}
        <Text style={s.seccion}>ACCIONES ESPECIALES</Text>
        <View style={s.accionesRow}>
          <TouchableOpacity style={s.accionBtn} onPress={baile} activeOpacity={0.7}>
            <Text style={s.accionEmoji}>🕺</Text>
            <Text style={s.accionLabel}>BAILE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.accionBtn}
            onPress={() => enviar(`TURN_R:${Math.round(360 * PPG)}`)}
            activeOpacity={0.7}
          >
            <Text style={s.accionEmoji}>🔄</Text>
            <Text style={s.accionLabel}>SPIN 360</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.accionBtn}
            onPress={() => enviar(`MOVE_F:${Math.round(PPM)}`)}
            activeOpacity={0.7}
          >
            <Text style={s.accionEmoji}>📏</Text>
            <Text style={s.accionLabel}>1 METRO</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#080808' },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },

  warnBox: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FF444412', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#FF444430', marginBottom: 16 },
  warnText: { color: '#FF4444', fontSize: 12 },

  labelsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  label: { color: '#444', fontSize: 9, fontWeight: '800', letterSpacing: 3 },

  joysticksRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 20 },
  joyWrap: { alignItems: 'center', gap: 10 },
  joyHint: { color: '#333', fontSize: 10, letterSpacing: 1 },
  joyDivider: { width: 1, height: 140, backgroundColor: '#161616' },

  btnStop: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FF3B3B', borderRadius: 50, paddingHorizontal: 32, paddingVertical: 12, marginBottom: 24 },
  btnStopText: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 3 },

  seccion: { color: '#333', fontSize: 9, fontWeight: '800', letterSpacing: 3, marginBottom: 12 },
  accionesRow: { flexDirection: 'row', gap: 10 },
  accionBtn: { flex: 1, backgroundColor: '#0F0F0F', borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1C1C1C' },
  accionEmoji: { fontSize: 26, marginBottom: 6 },
  accionLabel: { color: '#555', fontSize: 9, fontWeight: '800', letterSpacing: 2 },
});