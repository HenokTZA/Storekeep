import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Badge, Card, Icon, Loading, Message, Money, Screen, SearchField, Title } from '@/components/ui';
import { cachedGet, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Paginated, Transaction } from '@/types';

const TYPES = ['', 'sale', 'payment', 'credit', 'adjustment'] as const;

export default function TransactionsScreen() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setError('');
      const params = new URLSearchParams({ page_size: '200' });
      if (query) params.set('search', query);
      if (type) params.set('transaction_type', type);
      const result = await cachedGet<Paginated<Transaction>>(`/transactions/?${params}`);
      setItems(result.data.results);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [query, type]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <Screen>
      <Title eyebrow="Financial ledger" subtitle="Immutable sales, payments, credits and running balances">Transactions</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <SearchField value={query} onChangeText={setQuery} placeholder="Search customer, description or note" onSubmitEditing={load} />
      <View style={styles.chips}>{TYPES.map(value => <Pressable key={value || 'all'} onPress={() => { setType(value); setLoading(true); }} style={[styles.chip, type === value && styles.active]}><Text style={[styles.chipText, type === value && styles.activeText]}>{value ? value[0].toUpperCase() + value.slice(1) : 'All'}</Text></Pressable>)}</View>
      {loading ? <Loading /> : items.length ? (
        <Card style={styles.listCard}>
          {items.map((item, index) => {
            const debit = item.credit_debit === 'debit';
            const color = debit ? colors.danger : colors.success;
            const background = debit ? colors.dangerSoft : colors.successSoft;
            return (
              <View key={item.id} style={[styles.transaction, index > 0 && styles.borderTop]}>
                <View style={[styles.transactionIcon, { backgroundColor: background }]}><Icon name={transactionIcon(item.transaction_type, debit)} size={20} color={color} /></View>
                <View style={styles.flex}>
                  <View style={styles.nameRow}><Text style={styles.name}>{item.party_name}</Text><Badge label={item.party_type.toUpperCase()} tone="neutral" /></View>
                  <Text style={styles.description}>{item.description}</Text>
                  <Text style={styles.small}>{new Date(item.created_at).toLocaleString()} · {item.transaction_type}</Text>
                  {item.note ? <Text style={styles.note}>Note: {item.note}</Text> : null}
                  <View style={styles.meta}><Text style={styles.metaText}>Sale {Number(item.sale_amount).toFixed(2)}</Text><Text style={styles.metaText}>Payment {Number(item.payment_amount).toFixed(2)}</Text><Text style={styles.balance}>Balance {Number(item.running_balance).toFixed(2)} ETB</Text></View>
                </View>
                <View style={styles.right}><Money value={Math.abs(Number(item.delta))} color={color} size="small" /><Text style={[styles.direction, { color }]}>{debit ? 'DEBIT · OWES ME' : 'CREDIT · PAYMENT'}</Text></View>
              </View>
            );
          })}
        </Card>
      ) : <Message text="No matching financial transactions." />}
    </Screen>
  );
}

function transactionIcon(type: string, debit: boolean): React.ComponentProps<typeof Icon>['name'] {
  if (type.includes('sale')) return 'cart-outline';
  if (type.includes('payment')) return debit ? 'paper-plane-outline' : 'wallet-outline';
  if (type.includes('credit')) return 'repeat-outline';
  if (type.includes('adjust')) return 'options-outline';
  return debit ? 'arrow-down-outline' : 'arrow-up-outline';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 38, justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 13, backgroundColor: colors.surface },
  active: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  chipText: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  activeText: { color: colors.onPrimary },
  listCard: { paddingVertical: 0 },
  transaction: { minHeight: 126, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.mdSm, paddingVertical: spacing.md },
  borderTop: { borderTopWidth: 1, borderTopColor: colors.border },
  transactionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  name: { fontWeight: '900', fontSize: 14, color: colors.text },
  description: { color: colors.textSoft, fontSize: 12, lineHeight: 17, marginTop: 4 },
  small: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  note: { color: colors.textSoft, fontSize: 11, marginTop: 5 },
  right: { alignItems: 'flex-end', gap: 3 },
  direction: { fontSize: 8, fontWeight: '900', letterSpacing: 0.25 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  metaText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  balance: { color: colors.text, fontSize: 9, fontWeight: '900' },
});
