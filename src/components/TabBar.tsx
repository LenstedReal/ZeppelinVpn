import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export type Tab = 'home' | 'profiles' | 'server' | 'settings';

export function TabBar({
  tab,
  onChange,
  labels,
  bottomInset,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  labels: Record<Tab, string>;
  bottomInset: number;
}) {
  const tabs: Tab[] = ['home', 'profiles', 'server', 'settings'];
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      {tabs.map((t) => {
        const active = t === tab;
        return (
          <Pressable
            key={t}
            style={styles.item}
            onPress={() => onChange(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <View style={[styles.indicator, active && styles.indicatorActive]} />
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {labels[t]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#08090C',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.border,
  },
  item: { flex: 1, alignItems: 'center', paddingTop: 0, paddingBottom: 6 },
  indicator: { height: 3, width: 28, borderRadius: 2, backgroundColor: 'transparent', marginBottom: 10 },
  indicatorActive: { backgroundColor: colors.crimson },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  labelActive: { color: colors.text },
});
