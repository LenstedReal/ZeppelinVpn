import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export type ButtonMode = 'idle' | 'working' | 'on' | 'problem';

const SIZE = 200;
const logo = require('../../assets/logo.png');

/** Round connect button with the shield logo in the middle. */
export function ConnectButton({
  mode,
  label,
  onPress,
  disabled,
}: {
  mode: ButtonMode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mode !== 'working' && mode !== 'problem') {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [mode, pulse]);

  const ring =
    mode === 'on' ? colors.crimson : mode === 'working' ? colors.amber : mode === 'problem' ? colors.amber : colors.borderStrong;
  const glow = mode === 'on' ? 'rgba(229,38,43,0.16)' : mode === 'idle' ? 'transparent' : 'rgba(255,176,32,0.10)';

  return (
    <View style={styles.wrap}>
      <View style={[styles.glow, { backgroundColor: glow }]} />
      {mode === 'working' || mode === 'problem' ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulse,
            {
              borderColor: ring,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }],
            },
          ]}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.ring, { borderColor: ring }, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <View style={[styles.inner, mode === 'on' && styles.innerOn]}>
          <Image source={logo} style={[styles.logo, mode === 'idle' && styles.logoIdle]} resizeMode="contain" />
          <Text style={[styles.label, mode === 'on' && styles.labelOn]}>{label}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE + 60, height: SIZE + 60, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  glow: { position: 'absolute', width: SIZE + 56, height: SIZE + 56, borderRadius: (SIZE + 56) / 2 },
  pulse: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3 },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    backgroundColor: '#0A0B0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: SIZE - 26,
    height: SIZE - 26,
    borderRadius: (SIZE - 26) / 2,
    backgroundColor: '#0D0F13',
    borderWidth: 1,
    borderColor: '#23272F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerOn: { borderColor: '#4A1416' },
  logo: { width: 104, height: 104 },
  logoIdle: { opacity: 0.55 },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '800', letterSpacing: 2, marginTop: 2 },
  labelOn: { color: colors.text },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.6 },
});
