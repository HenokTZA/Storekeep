import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { localizedAlert, Text } from '@/i18n';
import { router, useFocusEffect } from 'expo-router';
import { Badge, Card, Icon, Loading, Message, Money, Screen, SearchField, Title } from '@/components/ui';
import { cachedGet, errorMessage } from '@/lib/api';
import { downloadTransactionReceipt, shareTransactionReceipt } from '@/lib/invoices';
import type { ReceiptKind } from '@/lib/invoices';
import { colors, radius, spacing } from '@/theme';
import type { Paginated, Transaction } from '@/types';

const TYPES = ['', 'sale', 'payment', 'purchase', 'credit', 'adjustment'] as const;

export default function TransactionsScreen() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]>('');
  const [loading, setLoading] = useState(true);
  const [invoiceBusy, setInvoiceBusy] = useState('');
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

  const runReceiptAction = async (kind: ReceiptKind, documentId: string, action: 'download' | 'share') => {
    const busyKey = `${action}:${kind}:${documentId}`;
    setInvoiceBusy(busyKey);
    setError('');
    try {
      if (action === 'share') {
        await shareTransactionReceipt(kind, documentId);
      } else {
        const saved = await downloadTransactionReceipt(kind, documentId);
        if (saved) localizedAlert('Receipt saved', 'The PNG receipt image was saved in the folder you selected.');
      }
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setInvoiceBusy('');
    }
  };
  return (
    <Screen>
      <Title eyebrow="Financial ledger" subtitle="Immutable sales, payments, credits and running balances">Transactions</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <SearchField value={query} onChangeText={setQuery} placeholder="Search customer, description or note" onSubmitEditing={load} />
      <View style={styles.chips}>{TYPES.map(value => <Pressable key={value || 'all'} onPress={() => { setType(value); setLoading(true); }} style={[styles.chip, type === value && styles.active]}><Text style={[styles.chipText, type === value && styles.activeText]}>{value ? value[0].toUpperCase() + value.slice(1) : 'All'}</Text></Pressable>)}</View>
      {loading ? <Loading /> : items.length ? (
        <Card style={styles.listCard}>
          {items.map((item, index) => {
            const walkInSale = item.transaction_type === 'sale' && item.party_type === 'walk_in';
            const debit = !walkInSale && item.credit_debit === 'debit';
            const color = debit ? colors.danger : colors.success;
            const background = debit ? colors.dangerSoft : colors.successSoft;
            const receiptKind: ReceiptKind | null = item.transaction_type === 'sale' && item.sale
              ? 'sale'
              : item.transaction_type === 'purchase' && item.purchase
                ? 'purchase'
                : null;
            const receiptId = receiptKind === 'sale' ? item.sale : receiptKind === 'purchase' ? item.purchase : null;
            return (
              <View key={item.id} style={[styles.transaction, index > 0 && styles.borderTop]}>
                <View style={styles.transactionMain}>
                  <View style={[styles.transactionIcon, { backgroundColor: background }]}><Icon name={transactionIcon(item.transaction_type, debit)} size={20} color={color} /></View>
                  <View style={styles.flex}>
                    <View style={styles.nameRow}><Text style={styles.name}>{item.party_name}</Text><Badge label={item.party_type.toUpperCase()} tone="neutral" /></View>
                    <Text style={styles.description}>{item.description}</Text>
                    <Text style={styles.small}>{new Date(item.created_at).toLocaleString()} · {item.transaction_type}</Text>
                    {item.note ? <Text style={styles.note}>Note: {item.note}</Text> : null}
                    <View style={styles.meta}><Text style={styles.metaText}>Sale {Number(item.sale_amount).toFixed(2)}</Text><Text style={styles.metaText}>Payment {Number(item.payment_amount).toFixed(2)}</Text><Text style={styles.balance}>{walkInSale ? 'Paid in full' : `Balance ${Number(item.running_balance).toFixed(2)} ETB`}</Text></View>
                  </View>
                  <View style={styles.right}><Money value={walkInSale ? item.sale_amount : Math.abs(Number(item.delta))} color={color} size="small" /><Text style={[styles.direction, { color }]}>{walkInSale ? 'PAID · WALK-IN' : debit ? 'DEBIT · OWES ME' : 'CREDIT · PAYMENT'}</Text></View>
                </View>
                {receiptKind && receiptId ? (
                  <View style={styles.invoiceActions}>
                    <Text style={styles.invoiceLabel}>{receiptKind === 'sale' ? 'SALE RECEIPT' : 'PURCHASE RECEIPT'} · IMAGE</Text>
                    <View style={styles.receiptButtons}>
                      <Pressable onPress={() => router.push({ pathname: '/receipt-view', params: { kind: receiptKind, documentId: receiptId } })} style={({ pressed }) => [styles.invoiceButton, pressed && styles.pressed]}>
                        <Icon name="eye-outline" size={17} color={colors.primary} />
                        <Text style={styles.invoiceButtonText}>View</Text>
                      </Pressable>
                      <Pressable disabled={Boolean(invoiceBusy)} onPress={() => runReceiptAction(receiptKind, receiptId, 'download')} style={({ pressed }) => [styles.invoiceButton, pressed && styles.pressed]}>
                        <Icon name="download-outline" size={17} color={colors.primary} />
                        <Text style={styles.invoiceButtonText}>{invoiceBusy === `download:${receiptKind}:${receiptId}` ? 'Saving…' : 'Download'}</Text>
                      </Pressable>
                      <Pressable disabled={Boolean(invoiceBusy)} onPress={() => runReceiptAction(receiptKind, receiptId, 'share')} style={({ pressed }) => [styles.invoiceButton, pressed && styles.pressed]}>
                        <Icon name="share-social-outline" size={17} color={colors.primary} />
                        <Text style={styles.invoiceButtonText}>{invoiceBusy === `share:${receiptKind}:${receiptId}` ? 'Opening…' : 'Share'}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
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
  transaction: { minHeight: 126, gap: spacing.mdSm, paddingVertical: spacing.md },
  transactionMain: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.mdSm },
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
  invoiceActions: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  invoiceLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.45 },
  receiptButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  invoiceButton: { minHeight: 40, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 7, borderRadius: radius.sm, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder },
  invoiceButtonText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.65 },
});
