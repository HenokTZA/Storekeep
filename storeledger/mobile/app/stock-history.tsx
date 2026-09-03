import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Badge, Card, Icon, Loading, Message, Screen, Title } from '@/components/ui';
import { cachedGet, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Paginated } from '@/types';

type Movement = { id: number; movement_type: string; quantity_delta: string; balance_after: string; note: string; created_by_name: string; created_at: string };

export default function StockHistoryScreen() {
  const { productId, name } = useLocalSearchParams<{ productId: string; name: string }>();
  const [items, setItems] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const result = await cachedGet<Paginated<Movement>>(`/products/${productId}/history/?page_size=100`);
      setItems(result.data.results);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [productId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (loading) return <Screen scroll={false}><Loading /></Screen>;
  const latestBalance = items[0]?.balance_after;
  return (
    <Screen>
      <Title eyebrow="Inventory audit" subtitle="Every receipt, sale and adjustment in chronological order">Stock History</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <Card style={styles.productCard}>
        <View style={styles.productIcon}><Icon name="cube-outline" size={25} color={colors.primary} /></View>
        <View style={styles.flex}><Text style={styles.productName}>{name}</Text><Text style={styles.small}>{items.length} recorded movement{items.length === 1 ? '' : 's'}</Text></View>
        {latestBalance !== undefined ? <View style={styles.balance}><Text style={styles.balanceValue}>{latestBalance}</Text><Text style={styles.balanceLabel}>CURRENT</Text></View> : null}
      </Card>

      {items.length ? (
        <Card style={styles.timelineCard}>
          {items.map((item, index) => {
            const positive = Number(item.quantity_delta) > 0;
            const tone = movementTone(item.movement_type, positive);
            const color = tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.success;
            const background = tone === 'danger' ? colors.dangerSoft : tone === 'warning' ? colors.warningSoft : colors.successSoft;
            return (
              <View key={item.id} style={[styles.row, index > 0 && styles.borderTop]}>
                <View style={styles.rail}><View style={[styles.movementIcon, { backgroundColor: background }]}><Icon name={movementIcon(item.movement_type, positive)} size={20} color={color} /></View>{index < items.length - 1 ? <View style={styles.line} /> : null}</View>
                <View style={styles.copy}>
                  <View style={styles.titleRow}><Text style={[styles.movementName, { color }]}>{item.movement_type.replaceAll('_', ' ').toUpperCase()}</Text><Badge label={`BALANCE ${item.balance_after}`} tone={tone} /></View>
                  <Text style={styles.note}>{item.note || 'No note'}</Text>
                  <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}{item.created_by_name ? ` · ${item.created_by_name}` : ''}</Text>
                </View>
                <Text style={[styles.delta, { color }]}>{positive ? '+' : ''}{item.quantity_delta}</Text>
              </View>
            );
          })}
        </Card>
      ) : <Message text="No stock movements have been recorded for this product." />}
    </Screen>
  );
}

function movementTone(type: string, positive: boolean): 'success' | 'danger' | 'warning' {
  if (type.toLowerCase().includes('adjust')) return 'warning';
  return positive ? 'success' : 'danger';
}

function movementIcon(type: string, positive: boolean): React.ComponentProps<typeof Icon>['name'] {
  if (type.toLowerCase().includes('sale')) return 'cart-outline';
  if (type.toLowerCase().includes('purchase') || type.toLowerCase().includes('received')) return 'cube-outline';
  if (type.toLowerCase().includes('adjust')) return 'construct-outline';
  return positive ? 'arrow-up-outline' : 'arrow-down-outline';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  productCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  productIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  productName: { color: colors.text, fontSize: 17, fontWeight: '900' },
  small: { color: colors.muted, fontSize: 12, marginTop: 3 },
  balance: { alignItems: 'flex-end' },
  balanceValue: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  balanceLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  timelineCard: { paddingVertical: 0 },
  row: { minHeight: 112, flexDirection: 'row', gap: spacing.mdSm, paddingVertical: spacing.md },
  borderTop: { borderTopWidth: 1, borderTopColor: colors.border },
  rail: { width: 42, alignItems: 'center' },
  movementIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, minHeight: 48, backgroundColor: colors.border, marginTop: 4 },
  copy: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  movementName: { fontSize: 12, fontWeight: '900' },
  note: { color: colors.textSoft, fontSize: 13, lineHeight: 18, marginTop: 7 },
  meta: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  delta: { fontSize: 17, fontWeight: '900', paddingTop: 2 },
});
