import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  Animated, Vibration, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useBluetooth }     from '../context/BluetoothContext';
import { useSensores }      from '../context/SensoresContext';
import { useGroq }          from '../context/GroqContext';
import { usePreferencias }  from '../context/PreferenciasContext';
import {
  transcribirAudio, consultarIA,
  parsearComandos, soloTexto, ejecutarComandos,
} from '../utils/groqApi';

const ESTADO = { IDLE: 'idle', GRABANDO: 'grabando', PROCESANDO: 'procesando' };

export default function HomeScreen({ navigation }) {
  const { conectado, enviar }        = useBluetooth();
  const { sensores, addLog }         = useSensores();
  const { groqKey }                  = useGroq();
  const { personalidad, voz, buildPrompt } = usePreferencias();

  const [estado, setEstado]  = useState(ESTADO.IDLE);
  const [bubbleText, setBubble] = useState('');
  const [micOK, setMicOK]    = useState(false);

  const grabRef   = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const loopRef   = useRef(null);

  // ── Pedir permiso micrófono al montar ────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status === 'granted') {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
          setMicOK(true);
          addLog('sistema', '✓ Micrófono listo');
        } else {
          addLog('error', '✗ Permiso de micrófono denegado');
          Alert.alert(
            'Permiso requerido',
            'Ve a Ajustes del móvil → Apps → Eskorpi → Permisos → Micrófono → Permitir.',
          );
        }
      } catch (e) {
        addLog('error', `Audio init: ${e.message}`);
      }
    })();
  }, []);

  // ── Pulso visual ──────────────────────────────────────────────
  const startPulse = () => {
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.12, duration: 500, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0,  duration: 500, useNativeDriver: true }),
      ])
    );
    loopRef.current.start();
  };
  const stopPulse = () => {
    loopRef.current?.stop();
    Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
  };

  // ── PRESS IN: empezar a grabar ────────────────────────────────
  const onPressIn = async () => {
    if (estado !== ESTADO.IDLE) return;
    if (!micOK) {
      Alert.alert('Sin permiso', 'Eskorpi no tiene acceso al micrófono. Revisa los ajustes.');
      return;
    }
    try {
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      grabRef.current = recording;
      setEstado(ESTADO.GRABANDO);
      setBubble('');
      Vibration.vibrate(30);
      startPulse();
      addLog('sistema', '🎙 Grabando...');
    } catch (e) {
      addLog('error', `No se pudo grabar: ${e.message}`);
      Alert.alert('Error de micrófono', e.message);
      setEstado(ESTADO.IDLE);
    }
  };

  // ── PRESS OUT: parar y procesar ───────────────────────────────
  const onPressOut = async () => {
    if (estado !== ESTADO.GRABANDO) return;
    stopPulse();
    if (!grabRef.current) { setEstado(ESTADO.IDLE); return; }

    setEstado(ESTADO.PROCESANDO);
    Vibration.vibrate(30);

    try {
      await grabRef.current.stopAndUnloadAsync();
      const uri = grabRef.current.getURI();
      grabRef.current = null;
      if (!uri) throw new Error('No se generó archivo de audio');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
      });

      // 1 ── Transcribir
      addLog('sistema', '🔍 Transcribiendo...');
      const textoUsuario = await transcribirAudio(uri, groqKey);

      if (!textoUsuario?.trim()) {
        setBubble('No te he entendido 🤷');
        addLog('sistema', '⚠ Sin transcripción');
        return;
      }
      addLog('usuario', textoUsuario);

      // 2 ── IA con prompt según personalidad activa
      addLog('sistema', `🧠 Consultando Groq [${personalidad.label}]...`);
      const systemPrompt = buildPrompt(sensores);
      const respuestaIA  = await consultarIA(textoUsuario, systemPrompt, groqKey);
      addLog('ia', respuestaIA);

      const textoVoz = soloTexto(respuestaIA);
      setBubble(textoVoz);

      // 3 ── Hablar con la voz configurada
      if (textoVoz) {
        const vozConfig = { ...voz.config };
        // Si voiceId es null (robot), no pasamos 'voice' para que use el SO
        if (!vozConfig.voice) delete vozConfig.voice;
        Speech.speak(textoVoz, vozConfig);
      }

      // 4 ── Comandos BT
      const cmds = parsearComandos(respuestaIA);
      if (cmds.length > 0) {
        if (conectado) {
          for (const c of cmds) addLog('tx', `📡 ${c}`);
          await ejecutarComandos(cmds, enviar);
        } else {
          addLog('sistema', '⚠ Sin BT — conecta en Configuración');
        }
      }

    } catch (e) {
      addLog('error', e.message);
      setBubble('Algo falló 😅');
      Alert.alert('Error', e.message);
    } finally {
      setEstado(ESTADO.IDLE);
      Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
        .catch(() => {});
    }
  };

  const colorBoton = estado === ESTADO.GRABANDO   ? '#FF3B3B'
                   : estado === ESTADO.PROCESANDO ? '#555'
                   : micOK ? '#F5C842' : '#444';

  // Texto idle según personalidad
  const idleTexts = {
    profesional: 'Listo para recibir instrucciones.',
    amigable:    '¡Hola! ¿En qué te puedo ayudar?',
    jocoso:      '¿Qué necesitas, jefe?',
    amigos:      '¿Qué pasa, tío? Di algo.',
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* LOGO */}
      <View style={s.logoZone}>
        <Text style={s.logoText}>ESKORPI</Text>
        <View style={s.logoDivider} />
        <Text style={s.logoSub}>ROBOT · AI CONTROL</Text>
      </View>

      {/* BADGES: BT + personalidad activa */}
      <View style={s.badgesRow}>
        <View style={[s.btBadge, { borderColor: conectado ? '#00FF7F40' : '#FF3B3B30' }]}>
          <View style={[s.btDot, { backgroundColor: conectado ? '#00FF7F' : '#FF3B3B' }]} />
          <Text style={[s.btLabel, { color: conectado ? '#00FF7F' : '#FF3B3B' }]}>
            {conectado ? 'ROBOT CONECTADO' : 'SIN CONEXIÓN BT'}
          </Text>
        </View>

        <View style={s.modoBadge}>
          <Text style={s.modoEmoji}>{personalidad.emoji}</Text>
          <Text style={s.modoLabel}>{personalidad.label.toUpperCase()}</Text>
        </View>
      </View>

      {/* ZONA CENTRAL */}
      <View style={s.centro}>
        <View style={s.burbuja}>
          {estado === ESTADO.PROCESANDO ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color="#F5C842" size="small" />
              <Text style={{ color: '#F5C842', fontSize: 15, letterSpacing: 1 }}>Procesando...</Text>
            </View>
          ) : (
            <Text style={s.burbujaText} numberOfLines={3}>
              {bubbleText
                || (estado === ESTADO.GRABANDO  ? 'Escuchando...'
                  : !micOK                      ? 'Sin permiso de micrófono'
                  : idleTexts[personalidad.id] ?? '¿Qué necesitas?')}
            </Text>
          )}
        </View>

        {/* Anillos sonar */}
        <View style={s.sonarWrap}>
          <View style={[s.ring, s.ring3, estado === ESTADO.GRABANDO && s.ringActive3]} />
          <View style={[s.ring, s.ring2, estado === ESTADO.GRABANDO && s.ringActive2]} />
          <View style={[s.ring, s.ring1, estado === ESTADO.GRABANDO && s.ringActive1]} />

          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Pressable
              style={[s.btnMic, { backgroundColor: colorBoton }]}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              disabled={estado === ESTADO.PROCESANDO || !micOK}
            >
              {estado === ESTADO.PROCESANDO
                ? <ActivityIndicator color="#0A0A0A" size="large" />
                : <Ionicons
                    name={estado === ESTADO.GRABANDO ? 'stop' : 'mic'}
                    size={46}
                    color="#0A0A0A"
                  />
              }
            </Pressable>
          </Animated.View>
        </View>

        <Text style={s.hint}>
          {!micOK                        ? '⚠ Permiso de micrófono requerido'
            : estado === ESTADO.IDLE      ? 'Mantén pulsado para hablar'
            : estado === ESTADO.GRABANDO  ? 'Suelta para enviar  ↑'
            : ''}
        </Text>
      </View>

      {/* NAV */}
      <View style={s.navBar}>
        <Pressable style={({ pressed }) => [s.navBtn, pressed && s.navBtnPressed]}
          onPress={() => navigation.navigate('Mantenimiento')}>
          <Ionicons name="terminal-outline" size={20} color="#F5C842" />
          <Text style={s.navBtnText}>MANTENIMIENTO</Text>
        </Pressable>
        <View style={s.navSep} />
        <Pressable style={({ pressed }) => [s.navBtn, pressed && s.navBtnPressed]}
          onPress={() => navigation.navigate('Config')}>
          <Ionicons name="settings-outline" size={20} color="#F5C842" />
          <Text style={s.navBtnText}>CONFIGURACIÓN</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#080808' },
  logoZone:    { alignItems: 'center', paddingTop: 28, paddingBottom: 12 },
  logoText:    { color: '#F5C842', fontSize: 30, fontWeight: '900', letterSpacing: 8 },
  logoDivider: { height: 2, width: 160, backgroundColor: '#F5C842', marginVertical: 5 },
  logoSub:     { color: '#444', fontSize: 10, letterSpacing: 5 },

  badgesRow:  { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 4 },
  btBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, backgroundColor: '#0F0F0F' },
  btDot:      { width: 7, height: 7, borderRadius: 4 },
  btLabel:    { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  modoBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#F5C84230', backgroundColor: '#F5C84208' },
  modoEmoji:  { fontSize: 13 },
  modoLabel:  { color: '#F5C842', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  centro:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  burbuja:     { minHeight: 64, maxWidth: 300, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginBottom: 36 },
  burbujaText: { color: '#CCC', fontSize: 17, textAlign: 'center', lineHeight: 26, fontStyle: 'italic' },

  sonarWrap:   { width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  ring:        { position: 'absolute', borderRadius: 999, borderWidth: 1 },
  ring1:       { width: 155, height: 155, borderColor: '#F5C84225' },
  ring2:       { width: 208, height: 208, borderColor: '#F5C84215' },
  ring3:       { width: 256, height: 256, borderColor: '#F5C84208' },
  ringActive1: { borderColor: '#F5C84265' },
  ringActive2: { borderColor: '#F5C84235' },
  ringActive3: { borderColor: '#F5C84220' },
  btnMic:      { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', elevation: 12 },
  hint:        { color: '#444', fontSize: 12, letterSpacing: 1.5, marginTop: 24 },

  navBar:         { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#161616', paddingVertical: 4 },
  navBtn:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 4 },
  navBtnPressed:  { backgroundColor: '#F5C84210' },
  navBtnText:     { color: '#F5C842', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  navSep:         { width: 1, backgroundColor: '#161616', marginVertical: 6 },
});
