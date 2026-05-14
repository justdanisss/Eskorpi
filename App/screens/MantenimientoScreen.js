import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSensores } from '../context/SensoresContext';

// Colores por tipo de entrada del log
const LOG_COLOR = {
  sistema:  '#555',
  rx:       '#3A9FD8',
  tx:       '#4CAF82',
  usuario:  '#F5C842',
  ia:       '#CC88FF',
  error:    '#FF4444',
};

const LOG_PREFIX = {
  sistema: '···',
  rx:      ' ← ',
  tx:      ' → ',
  usuario: 'USR',
  ia:      ' AI',
  error:   'ERR',
};

export default function MantenimientoScreen({ navigation }) {
  const { sensores, logs } = useSensores();
  const scrollRef = useRef(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    if (follow) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [logs, follow]);

  const ts = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(n => String(n).padStart(2, '0')).join(':');
  };

  // Tarjeta de sensor
  const Tile = ({ label, valor, unidad = '', warn = false }) => (
    <View style={[s.tile, warn && s.tileWarn]}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={[s.tileValor, warn && { color: '#FF4444' }]}>{valor}</Text>
      {unidad ? <Text style={s.tileUnidad}>{unidad}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>

      {/* ── TERMINAL ── */}
      <View style={s.terminalCard}>
        <View style={s.termHeader}>
          <View style={s.trafficLights}>
            <View style={[s.dot, { backgroundColor: '#FF5F57' }]} />
            <View style={[s.dot, { backgroundColor: '#FFBD2E' }]} />
            <View style={[s.dot, { backgroundColor: '#28C840' }]} />
          </View>
          <Text style={s.termTitle}>eskorpi — terminal</Text>
          <Pressable onPress={() => setFollow(f => !f)} style={s.followBtn}>
            <Ionicons
              name={follow ? 'lock-closed-outline' : 'lock-open-outline'}
              size={14} color={follow ? '#F5C842' : '#444'}
            />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={s.logScroll}
          contentContainerStyle={s.logContent}
          onScrollBeginDrag={() => setFollow(false)}
        >
          {logs.map((entry, i) => (
            <View key={entry.id ?? i} style={s.logRow}>
              <Text style={s.logTs}>{ts(entry.ts)}</Text>
              <Text style={[s.logPrefix, { color: LOG_COLOR[entry.tipo] ?? '#888' }]}>
                {LOG_PREFIX[entry.tipo] ?? '···'}
              </Text>
              <Text style={[s.logText, { color: LOG_COLOR[entry.tipo] ?? '#AAA' }]}>
                {entry.texto}
              </Text>
            </View>
          ))}
          <Text style={s.cursor}>█</Text>
        </ScrollView>
      </View>

      {/* ── SENSORES ── */}
      <View style={s.sensoresCard}>
        <Text style={s.sectionTitle}>SENSORES  <Text style={s.sectionTs}>{ts(sensores.ultima)}</Text></Text>
        <View style={s.tilesRow}>
          <Tile label="DIST"  valor={sensores.distancia.toFixed(0)} unidad="cm"  warn={sensores.distancia < 15} />
          <Tile label="TEMP"  valor={sensores.temperatura.toFixed(1)} unidad="°C" warn={sensores.temperatura > 35} />
          <Tile label="HUM"   valor={sensores.humedad.toFixed(0)}   unidad="%" />
          <Tile label="COLOR" valor={sensores.color} />
        </View>
        <View style={s.tilesRow}>
          <Tile label="IR·DER" valor={sensores.ir_der ? 'ALERT' : 'OK'} warn={sensores.ir_der} />
          <Tile label="IR·IZQ" valor={sensores.ir_izq ? 'ALERT' : 'OK'} warn={sensores.ir_izq} />
          <Tile label="HW"    valor={sensores.hw_estado} />
        </View>
      </View>

      {/* ── BOTÓN CONTROL MANUAL ── */}
      <View style={s.footer}>
        <TouchableOpacity
          style={s.btnControl}
          onPress={() => navigation.navigate('Control')}
          activeOpacity={0.8}
        >
          <Ionicons name="game-controller-outline" size={18} color="#0A0A0A" />
          <Text style={s.btnControlText}>CONTROL MANUAL</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080808' },

  // Terminal
  terminalCard: { flex: 1, margin: 12, borderRadius: 12, backgroundColor: '#0D0D0D', borderWidth: 1, borderColor: '#1C1C1C', overflow: 'hidden' },
  termHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#141414', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#1C1C1C' },
  trafficLights: { flexDirection: 'row', gap: 5 },
  dot: { width: 11, height: 11, borderRadius: 6 },
  termTitle: { color: '#444', fontSize: 11, letterSpacing: 1 },
  followBtn: { padding: 2 },
  logScroll: { flex: 1 },
  logContent: { padding: 10, gap: 1 },
  logRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  logTs: { color: '#2A2A2A', fontSize: 10, width: 60, paddingTop: 3, fontFamily: 'monospace' },
  logPrefix: { fontSize: 10, width: 30, paddingTop: 3, fontWeight: '700', fontFamily: 'monospace' },
  logText: { fontSize: 12, flex: 1, lineHeight: 19, fontFamily: 'monospace' },
  cursor: { color: '#F5C842', fontSize: 13, marginTop: 2 },

  // Sensores
  sensoresCard: { marginHorizontal: 12, marginBottom: 4, backgroundColor: '#0D0D0D', borderRadius: 12, borderWidth: 1, borderColor: '#1C1C1C', padding: 12 },
  sectionTitle: { color: '#444', fontSize: 10, fontWeight: '800', letterSpacing: 3, marginBottom: 8 },
  sectionTs: { color: '#2A2A2A', fontWeight: '400' },
  tilesRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  tile: { flex: 1, backgroundColor: '#111', borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#1C1C1C' },
  tileWarn: { borderColor: '#FF444440', backgroundColor: '#FF444408' },
  tileLabel: { color: '#444', fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 3 },
  tileValor: { color: '#DDD', fontSize: 14, fontWeight: '700' },
  tileUnidad: { color: '#444', fontSize: 9, marginTop: 1 },

  // Footer
  footer: { padding: 12 },
  btnControl: { backgroundColor: '#F5C842', borderRadius: 10, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnControlText: { color: '#0A0A0A', fontWeight: '900', fontSize: 13, letterSpacing: 2.5 },
});