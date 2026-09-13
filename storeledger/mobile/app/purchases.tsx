import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { localizedAlert, Text } from '@/i18n';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Button, Card, Icon, Loading, Message, Money, Screen, Title } from '@/components/ui';
import { cachedGet, errorMessage } from '@/lib/api';
import { downloadTransactionReceipt, shareTransactionReceipt } from '@/lib/invoices';
import { colors, radius, spacing } from '@/theme';
import type { Paginated, Purchase } from '@/types';

export default function PurchasesScreen() {
  const { store, role } = useAuth();
  const [items, setItems] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptBusy, setReceiptBusy] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const result = await cachedGet<Paginated<Purchase>>('/purchases/?page_size=100');
      setItems(result.data.results);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const runReceiptAction = async (purchaseId: string, action: 'download' | 'share') => {
    setReceiptBusy(`${action}:${purchaseId}`);
    setError('');
    try {
      if (action === 'share') {
        await shareTransactionReceipt('purchase', purchaseId);
      } else {
        const saved = await downloadTransactionReceipt('purchase', purchaseId);
        if (saved) localizedAlert('Receipt saved', 'The PNG purchase receipt was saved in the folder you selected.');
      }
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setReceiptBusy('');
    }
  };
  if (loading) return <Screen scroll={false}><Loading /></Screen>;
  const canCreate = role === 'owner' || role === 'manager';
  return (
    <Screen>
      <Title eyebrow="Procurement" subtitle="Every purchase receives factory stock and records its payable">Purchases</Title>
      {error ? <Message text={error} tone="error" /> : null}
      {canCreate ? <Button title="Receive Purchase" icon="bag-add-outline" onPress={() => router.push('/purchase-new')} /> : null}
      {items.length ? items.map(item => {
        const outstanding = Number(item.outstanding);
        return (
          <Card key={item.id}>
            <View style={styles.header}>
              <View style={styles.supplierIcon}><Icon name="business-outline" size={22} color={colors.primary} /></View>
              <View style={styles.flex}><Text style={styles.name}>{item.supplier_name}</Text><Text style={styles.small}>{item.purchase_date} · {item.items.length} product line{item.items.length === 1 ? '' : 's'}</Text>{item.reference ? <Text style={styles.reference}>{item.reference}</Text> : null}</View>
              <Money value={item.total} currency={store?.currency} size="small" />
            </View>
            <View style={styles.items}>
              {item.items.slice(0, 3).map(line => <View key={line.id} style={styles.itemRow}><Text style={styles.itemName}>{line.product_name}</Text><Text style={styles.itemQty}>× {Number(line.quantity).toLocaleString()}</Text></View>)}
              {item.items.length > 3 ? <Text style={styles.moreItems}>+ {item.items.length - 3} more product lines</Text> : null}
            </View>
            <View style={styles.totals}>
              <View><Text style={styles.totalLabel}>PAID</Text><Text style={styles.paid}>{Number(item.amount_paid).toLocaleString()} {store?.currency}</Text></View>
              <View style={styles.outstanding}><Text style={[styles.totalLabel, { color: outstanding > 0 ? colors.success : colors.muted }]}>I OWE</Text><Text style={[styles.owe, { color: outstanding > 0 ? colors.success : colors.muted }]}>{outstanding.toLocaleString()} {store?.currency}</Text></View>
              <Badge label={outstanding > 0 ? 'PARTIAL' : 'PAID'} tone={outstanding > 0 ? 'warning' : 'success'} />
            </View>
            <View style={styles.receiptActions}>
              <View style={styles.receiptAction}><Button title="View" icon="eye-outline" compact variant="secondary" onPress={() => router.push({ pathname: '/receipt-view', params: { kind: 'purchase', documentId: item.id } })} /></View>
              <View style={styles.receiptAction}><Button title={receiptBusy === `download:${item.id}` ? 'Saving…' : 'Download'} icon="download-outline" compact variant="secondary" disabled={Boolean(receiptBusy)} onPress={() => runReceiptAction(item.id, 'download')} /></View>
              <View style={styles.receiptAction}><Button title={receiptBusy === `share:${item.id}` ? 'Opening…' : 'Share'} icon="share-social-outline" compact variant="secondary" disabled={Boolean(receiptBusy)} onPress={() => runReceiptAction(item.id, 'share')} /></View>
            </View>
          </Card>
        );
      }) : <Message text="No factory purchases recorded yet." />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  supplierIcon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontWeight: '900', fontSize: 16 },
  small: { color: colors.muted, marginTop: 3, fontSize: 11 },
  reference: { color: colors.primary, fontSize: 10, fontWeight: '800', marginTop: 3 },
  items: { marginTop: spacing.md, paddingVertical: spacing.mdSm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, gap: 7 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  itemName: { color: colors.textSoft, fontSize: 12, fontWeight: '700' },
  itemQty: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  moreItems: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  totals: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  totalLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  paid: { color: colors.text, fontSize: 12, fontWeight: '900', marginTop: 2 },
  outstanding: { alignItems: 'flex-end' },
  owe: { fontSize: 12, fontWeight: '900', marginTop: 2 },
  receiptActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.mdSm, borderTopWidth: 1, borderTopColor: colors.border },
  receiptAction: { flex: 1 },
});
