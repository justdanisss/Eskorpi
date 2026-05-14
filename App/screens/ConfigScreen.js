import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Pressable,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBluetooth }    from '../context/BluetoothContext';
import { useGroq }         from '../context/GroqContext';
import { usePreferencias, PERSONALIDADES, VOCES } from '../context/PreferenciasContext';

export default function ConfigScreen() {
  const {
    dispositivos, conectado, dispositivoActual,
    buscando, conectando,
    buscarDispositivos, conectar, desconectar,
  } = useBluetooth();

  const { groqKey, guardarKey } = useGroq();
  const { personalidadId, guardarPersonalidad, vozId, guardarVoz } = usePreferencias();

  const [inputKey, setInputKey]   = useState(groqKey);
  const [keyVisible, setKeyVisible] = useState(false);
  const [guardado, setGuardado]   = useState(false);

  const onGuardarKey = async () => {
    await guardarKey(inputKey);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  };

  const keyGuardada = groqKey.length > 0;

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

          {/* ══════════════════════════════════════════
              BLUETOOTH
          ══════════════════════════════════════════ */}
          <Text style={s.seccion}>BLUETOOTH</Text>

          <View style={[s.estadoBox, conectado && s.estadoBoxOn]}>
            <View style={[s.estadoDot, { backgroundColor: conectado ? '#00FF7F' : '#333' }]} />
            <View style={s.estadoInfo}>
              <Text style={s.estadoTitulo}>{conectado ? 'CONECTADO' : 'DESCONECTADO'}</Text>
              <Text style={s.estadoSub}>
                {conectado ? dispositivoActual?.name ?? '—' : 'Ningún robot vinculado'}
              </Text>
            </View>
            {conectado && (
              <TouchableOpacity style={s.btnDesconectar} onPress={desconectar}>
                <Text style={s.btnDesconectarText}>DESCONECTAR</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={s.instrBox}>
            <Ionicons name="information-circle-outline" size={15} color="#444" />
            <Text style={s.instrText}>
              Empareja el <Text style={s.instrHighlight}>HC-05</Text> en Ajustes › Bluetooth de Android antes de buscar aquí.{' '}
              PIN por defecto: <Text style={s.instrHighlight}>1234</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={s.btnBuscar}
            onPress={buscarDispositivos}
            disabled={buscando || conectando}
            activeOpacity={0.8}
          >
            {buscando
              ? <ActivityIndicator color="#0A0A0A" />
              : <>
                  <Ionicons name="search" size={16} color="#0A0A0A" />
                  <Text style={s.btnBuscarText}>BUSCAR DISPOSITIVOS EMPAREJADOS</Text>
                </>
            }
          </TouchableOpacity>

          <FlatList
            data={dispositivos}
            keyExtractor={(d) => d.address}
            contentContainerStyle={s.lista}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={s.vacio}>
                <Ionicons name="bluetooth-outline" size={44} color="#1E1E1E" />
                <Text style={s.vacioText}>Sin dispositivos emparejados</Text>
                <Text style={s.vacioSub}>Empareja el HC-05 en los ajustes de Android y pulsa Buscar</Text>
              </View>
            }
            renderItem={({ item }) => {
              const activo = dispositivoActual?.address === item.address;
              return (
                <Pressable
                  style={({ pressed }) => [s.dispositivo, activo && s.dispositivoActivo, pressed && s.dispositivoPressed]}
                  onPress={() => conectar(item)}
                  disabled={conectando}
                >
                  <View style={[s.devIcon, activo && { borderColor: '#F5C84240' }]}>
                    <Ionicons name="bluetooth" size={18} color={activo ? '#F5C842' : '#333'} />
                  </View>
                  <View style={s.devInfo}>
                    <Text style={s.devNombre}>{item.name ?? 'Desconocido'}</Text>
                    <Text style={s.devMac}>{item.address}</Text>
                  </View>
                  {conectando
                    ? <ActivityIndicator color="#F5C842" size="small" />
                    : <Ionicons name={activo ? 'checkmark-circle' : 'chevron-forward'} size={18} color={activo ? '#F5C842' : '#2A2A2A'} />
                  }
                </Pressable>
              );
            }}
          />

          {/* ══════════════════════════════════════════
              PERSONALIDAD
          ══════════════════════════════════════════ */}
          <Text style={[s.seccion, s.seccionSep]}>PERSONALIDAD</Text>
          <Text style={s.seccionDesc}>Define cómo se expresa Eskorpi al hablar contigo.</Text>

          <View style={s.opcionesGrid}>
            {Object.values(PERSONALIDADES).map((p) => {
              const activa = personalidadId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.opcionCard, activa && s.opcionCardActiva]}
                  onPress={() => guardarPersonalidad(p.id)}
                  activeOpacity={0.75}
                >
                  <Text style={s.opcionEmoji}>{p.emoji}</Text>
                  <Text style={[s.opcionLabel, activa && s.opcionLabelActiva]}>{p.label}</Text>
                  <Text style={s.opcionDesc}>{p.descripcion}</Text>
                  {activa && (
                    <View style={s.opcionCheck}>
                      <Ionicons name="checkmark" size={11} color="#0A0A0A" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ══════════════════════════════════════════
              VOZ
          ══════════════════════════════════════════ */}
          <Text style={[s.seccion, s.seccionSep]}>VOZ</Text>
          <Text style={s.seccionDesc}>Voz con la que Eskorpi te responde en voz alta.</Text>

          <View style={s.vocesGrid}>
            {VOCES.map((v) => {
              const activa = vozId === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[s.vozCard, activa && s.vozCardActiva]}
                  onPress={() => guardarVoz(v.id)}
                  activeOpacity={0.75}
                >
                  <Text style={s.vozEmoji}>{v.emoji}</Text>
                  <Text style={[s.vozLabel, activa && s.vozLabelActiva]}>{v.label}</Text>
                  {activa && <View style={s.vozCheck}><Ionicons name="checkmark" size={10} color="#0A0A0A" /></View>}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={s.vozInfoBox}>
            <Ionicons name="information-circle-outline" size={14} color="#444" />
            <Text style={s.vozInfoText}>
              Las voces dependen de las instaladas en tu Android. Si una voz no suena bien, prueba otra o instala más en Ajustes › Idioma › Texto a voz.
            </Text>
          </View>

          {/* ══════════════════════════════════════════
              GROQ API KEY
          ══════════════════════════════════════════ */}
          <Text style={[s.seccion, s.seccionSep]}>GROQ API KEY</Text>

          <View style={s.instrBox}>
            <Ionicons name="information-circle-outline" size={15} color="#444" />
            <Text style={s.instrText}>
              Obtén tu clave gratuita en <Text style={s.instrHighlight}>console.groq.com</Text>.
              Se guarda solo en tu dispositivo.
            </Text>
          </View>

          <View style={[s.keyEstadoBox, keyGuardada ? s.keyEstadoOk : s.keyEstadoVacia]}>
            <Ionicons name={keyGuardada ? 'checkmark-circle' : 'alert-circle-outline'} size={14} color={keyGuardada ? '#00FF7F' : '#FF4444'} />
            <Text style={[s.keyEstadoText, { color: keyGuardada ? '#00FF7F' : '#FF4444' }]}>
              {keyGuardada ? `Key guardada: ${groqKey.substring(0, 8)}${'•'.repeat(12)}` : 'Sin key — la IA y el micrófono no funcionarán'}
            </Text>
          </View>

          <View style={s.keyInputRow}>
            <TextInput
              style={s.keyInput}
              value={inputKey}
              onChangeText={setInputKey}
              placeholder="gsk_..."
              placeholderTextColor="#2A2A2A"
              secureTextEntry={!keyVisible}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
            <TouchableOpacity style={s.keyVisBtn} onPress={() => setKeyVisible(v => !v)}>
              <Ionicons name={keyVisible ? 'eye-off-outline' : 'eye-outline'} size={18} color="#444" />
            </TouchableOpacity>
          </View>

          <View style={s.keyBtnsRow}>
            <TouchableOpacity
              style={[s.btnGuardar, guardado && s.btnGuardadoOk]}
              onPress={onGuardarKey}
              activeOpacity={0.8}
            >
              <Ionicons name={guardado ? 'checkmark' : 'save-outline'} size={15} color="#0A0A0A" />
              <Text style={s.btnGuardarText}>{guardado ? '¡GUARDADO!' : 'GUARDAR KEY'}</Text>
            </TouchableOpacity>
            {keyGuardada && (
              <TouchableOpacity style={s.btnBorrar} onPress={() => { setInputKey(''); guardarKey(''); }} activeOpacity={0.8}>
                <Ionicons name="trash-outline" size={15} color="#FF3B3B" />
                <Text style={s.btnBorrarText}>BORRAR</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={s.version}>Eskorpi App v1.0  ·  Groq + Whisper-v3  ·  BQ ZUM BT-328</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#080808' },
  container: { padding: 14, paddingBottom: 40 },

  seccion:     { color: '#333', fontSize: 9, fontWeight: '800', letterSpacing: 3, marginBottom: 6 },
  seccionSep:  { marginTop: 28 },
  seccionDesc: { color: '#2E2E2E', fontSize: 11, marginBottom: 12, lineHeight: 16 },

  // BT
  estadoBox:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0F0F0F', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1C1C1C', marginBottom: 12 },
  estadoBoxOn:        { borderColor: '#00FF7F25', backgroundColor: '#00FF7F05' },
  estadoDot:          { width: 10, height: 10, borderRadius: 5 },
  estadoInfo:         { flex: 1 },
  estadoTitulo:       { color: '#DDD', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  estadoSub:          { color: '#444', fontSize: 11, marginTop: 2 },
  btnDesconectar:     { backgroundColor: '#FF3B3B18', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#FF3B3B35' },
  btnDesconectarText: { color: '#FF3B3B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  instrBox:      { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 14 },
  instrText:     { color: '#444', fontSize: 12, flex: 1, lineHeight: 18 },
  instrHighlight: { color: '#F5C842' },
  btnBuscar:     { backgroundColor: '#F5C842', borderRadius: 10, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 },
  btnBuscarText: { color: '#0A0A0A', fontWeight: '900', fontSize: 12, letterSpacing: 2 },
  lista:             { gap: 6, paddingBottom: 4 },
  vacio:             { alignItems: 'center', paddingTop: 28, gap: 10 },
  vacioText:         { color: '#333', fontSize: 14, fontWeight: '600' },
  vacioSub:          { color: '#222', fontSize: 12, textAlign: 'center', lineHeight: 18, maxWidth: 250 },
  dispositivo:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0F0F0F', borderRadius: 11, padding: 13, borderWidth: 1, borderColor: '#1A1A1A' },
  dispositivoActivo: { borderColor: '#F5C84230', backgroundColor: '#F5C84205' },
  dispositivoPressed:{ backgroundColor: '#161616' },
  devIcon:  { width: 36, height: 36, borderRadius: 9, backgroundColor: '#141414', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#222' },
  devInfo:  { flex: 1 },
  devNombre:{ color: '#CCC', fontSize: 14, fontWeight: '600' },
  devMac:   { color: '#333', fontSize: 11, marginTop: 2 },

  // Personalidad
  opcionesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  opcionCard:   { width: '47.5%', backgroundColor: '#0F0F0F', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1C1C1C', position: 'relative' },
  opcionCardActiva: { borderColor: '#F5C84250', backgroundColor: '#F5C84208' },
  opcionEmoji:  { fontSize: 24, marginBottom: 6 },
  opcionLabel:  { color: '#555', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  opcionLabelActiva: { color: '#F5C842' },
  opcionDesc:   { color: '#2A2A2A', fontSize: 10, lineHeight: 14 },
  opcionCheck:  { position: 'absolute', top: 10, right: 10, backgroundColor: '#F5C842', borderRadius: 20, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },

  // Voz
  vocesGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  vozCard:    { width: '30%', backgroundColor: '#0F0F0F', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1C1C1C', alignItems: 'center', position: 'relative' },
  vozCardActiva: { borderColor: '#F5C84250', backgroundColor: '#F5C84208' },
  vozEmoji:   { fontSize: 22, marginBottom: 5 },
  vozLabel:   { color: '#444', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  vozLabelActiva: { color: '#F5C842' },
  vozCheck:   { position: 'absolute', top: 6, right: 6, backgroundColor: '#F5C842', borderRadius: 20, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  vozInfoBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 4 },
  vozInfoText:{ color: '#2A2A2A', fontSize: 11, flex: 1, lineHeight: 16 },

  // Groq key
  keyEstadoBox:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, padding: 10, borderWidth: 1, marginBottom: 12 },
  keyEstadoOk:    { backgroundColor: '#00FF7F08', borderColor: '#00FF7F20' },
  keyEstadoVacia: { backgroundColor: '#FF444408', borderColor: '#FF444420' },
  keyEstadoText:  { fontSize: 11, fontWeight: '600', flex: 1 },
  keyInputRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F0F0F', borderRadius: 10, borderWidth: 1, borderColor: '#1C1C1C', marginBottom: 12 },
  keyInput:       { flex: 1, color: '#CCC', fontSize: 13, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  keyVisBtn:      { paddingHorizontal: 14, paddingVertical: 12 },
  keyBtnsRow:     { flexDirection: 'row', gap: 10, marginBottom: 28 },
  btnGuardar:     { flex: 1, backgroundColor: '#F5C842', borderRadius: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  btnGuardadoOk:  { backgroundColor: '#00FF7F' },
  btnGuardarText: { color: '#0A0A0A', fontWeight: '900', fontSize: 12, letterSpacing: 2 },
  btnBorrar:      { backgroundColor: '#FF3B3B15', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#FF3B3B30' },
  btnBorrarText:  { color: '#FF3B3B', fontWeight: '800', fontSize: 12, letterSpacing: 1 },

  version: { color: '#1E1E1E', textAlign: 'center', fontSize: 10, letterSpacing: 1 },
});
