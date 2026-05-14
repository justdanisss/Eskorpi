import React, { useRef, useCallback } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';

const RADIO_BASE   = 70;   // radio del círculo exterior
const RADIO_THUMB  = 28;   // radio del nub
const DEAD_ZONE    = 0.15; // zona muerta central (0–1)

/**
 * Joystick táctil analógico.
 * Props:
 *   onMove({ x, y })  – valores normalizados [-1, 1], se llama continuamente
 *   onRelease()        – al soltar
 *   color              – color del nub (default amarillo)
 */
export default function Joystick({ onMove, onRelease, color = '#F5C842', style }) {
  const posRef  = useRef({ x: 0, y: 0 });
  const thumbRef = useRef(null);

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  const mover = useCallback((dx, dy) => {
    const dist  = Math.sqrt(dx * dx + dy * dy);
    const maxD  = RADIO_BASE - RADIO_THUMB;
    const ratio = dist > maxD ? maxD / dist : 1;
    const cx    = dx * ratio;
    const cy    = dy * ratio;

    posRef.current = { x: cx, y: cy };

    // Actualizar posición visual del nub via ref (sin re-render)
    thumbRef.current?.setNativeProps({
      style: { transform: [{ translateX: cx }, { translateY: cy }] },
    });

    // Valores normalizados con dead zone
    const nx = Math.abs(cx / maxD) < DEAD_ZONE ? 0 : clamp(cx / maxD, -1, 1);
    const ny = Math.abs(cy / maxD) < DEAD_ZONE ? 0 : clamp(cy / maxD, -1, 1);
    if (onMove) onMove({ x: nx, y: ny });
  }, [onMove]);

  const centrar = useCallback(() => {
    thumbRef.current?.setNativeProps({
      style: { transform: [{ translateX: 0 }, { translateY: 0 }] },
    });
    posRef.current = { x: 0, y: 0 };
    if (onMove)   onMove({ x: 0, y: 0 });
    if (onRelease) onRelease();
  }, [onMove, onRelease]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderMove:  (_, g) => mover(g.dx, g.dy),
      onPanResponderRelease: centrar,
      onPanResponderTerminate: centrar,
    })
  ).current;

  return (
    <View style={[s.base, style]} {...panResponder.panHandlers}>
      {/* Líneas de cruceta */}
      <View style={[s.linea, s.lineaH]} />
      <View style={[s.linea, s.lineaV]} />
      {/* Círculo interior de referencia */}
      <View style={s.circuloInner} />
      {/* Nub */}
      <View ref={thumbRef} style={[s.thumb, { backgroundColor: color }]} />
    </View>
  );
}

const s = StyleSheet.create({
  base: {
    width:  RADIO_BASE * 2,
    height: RADIO_BASE * 2,
    borderRadius: RADIO_BASE,
    backgroundColor: '#111',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linea: { position: 'absolute', backgroundColor: '#1E1E1E' },
  lineaH: { width: RADIO_BASE * 2 - 4, height: 1 },
  lineaV: { width: 1, height: RADIO_BASE * 2 - 4 },
  circuloInner: {
    position: 'absolute',
    width: RADIO_BASE,
    height: RADIO_BASE,
    borderRadius: RADIO_BASE / 2,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  thumb: {
    width:  RADIO_THUMB * 2,
    height: RADIO_THUMB * 2,
    borderRadius: RADIO_THUMB,
    elevation: 6,
    shadowColor: '#F5C842',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
});