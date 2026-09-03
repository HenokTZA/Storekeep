import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export type BarDatum = { label: string; value: number; color?: string };

export function BarChart({ data, valueLabel = value => value.toLocaleString() }: { data: BarDatum[]; valueLabel?: (value: number) => string }) {
  const maximum = Math.max(...data.map(item => item.value), 1);
  if (!data.length) return <Text style={styles.empty}>No data for this period.</Text>;
  return (
    <View style={styles.chart} accessibilityLabel="Bar chart">
      {data.map((item, index) => (
        <View key={`${item.label}-${index}`} style={styles.row}>
          <Text numberOfLines={1} style={styles.label}>{item.label}</Text>
          <View style={styles.track}><View style={[styles.bar, { width: `${Math.max((item.value / maximum) * 100, 2)}%`, backgroundColor: item.color || colors.primaryButton }]} /></View>
          <Text style={styles.value}>{valueLabel(item.value)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { gap: spacing.mdSm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { width: 88, color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  track: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.pill },
  value: { width: 72, textAlign: 'right', color: colors.text, fontSize: 11, fontWeight: '900' },
  empty: { color: colors.muted },
});
