import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Icon, Input, Loading, Message, Money, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, cachedGet, errorMessage } from '@/lib/api';
import { createUuid } from '@/lib/uuid';
import { getLocalValue, removeLocalValue, setLocalValue } from '@/lib/database';
import { colors, radius, spacing } from '@/theme';
import type { Paginated, Party, Product } from '@/types';

type Draft = { customerId: number | null; quantities: Record<string, number>; amountPaid: string; note: string };

export default function SaleScreen() {
  const { customerId: requestedCustomerId } = useLocalSearchParams<{ customerId?: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [amountPaid, setAmountPaid] = useState('0');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const selectedCustomer = parties.find(party => party.id === customerId) || null;
  const isAgentSale = selectedCustomer?.party_type === 'agent';

  const unitPrice = useCallback((product: Product) => Number(isAgentSale ? product.agent_selling_price : product.selling_price), [isAgentSale]);
  const total = useMemo(() => products.reduce((sum, product) => sum + (quantities[String(product.id)] || 0) * unitPrice(product), 0), [products, quantities, unitPrice]);
  const selectedItemCount = useMemo(() => products.reduce((sum, product) => sum + (quantities[String(product.id)] || 0), 0), [products, quantities]);

  const load = useCallback(async () => {
    try {
      const [productResult, partyResult, draft] = await Promise.all([
        cachedGet<Paginated<Product>>('/products/?page_size=100'),
        cachedGet<Paginated<Party>>('/parties/?page_size=100'),
        getLocalValue<Draft>('sale-draft'),
      ]);
      setProducts(productResult.data.results);
      setParties(partyResult.data.results);
      setOffline(productResult.offline || partyResult.offline);
      if (draft) {
        setCustomerId(draft.customerId);
        setQuantities(draft.quantities);
        setAmountPaid(draft.amountPaid);
        setNote(draft.note);
      }
      if (requestedCustomerId) setCustomerId(Number(requestedCustomerId));
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [requestedCustomerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!loading) setLocalValue('sale-draft', { customerId, quantities, amountPaid, note });
  }, [customerId, quantities, amountPaid, note, loading]);

  useEffect(() => {
    if (customerId === null) setAmountPaid(total.toFixed(2));
  }, [customerId, total]);

  const changeQuantity = (product: Product, delta: number) => {
    const key = String(product.id);
    const next = Math.max(0, Math.min(Number(product.current_quantity), (quantities[key] || 0) + delta));
    setQuantities(current => ({ ...current, [key]: next }));
  };

  const submit = async () => {
    const selected = products.filter(product => (quantities[String(product.id)] || 0) > 0);
    if (!selected.length) return setError('Select at least one product.');
    if (offline) return setError('Reconnect to the internet before posting this financial transaction. Your draft is saved.');
    setBusy(true);
    setError('');
    try {
      await apiFetch('/sales/', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId,
          idempotency_key: createUuid(),
          amount_paid: Number(amountPaid || 0).toFixed(2),
          note,
          sale_items: selected.map(product => ({ product_id: product.id, quantity: quantities[String(product.id)] })),
        }),
      });
      await removeLocalValue('sale-draft');
      setCustomerId(null);
      setQuantities({});
      setNote('');
      setAmountPaid('0');
      Alert.alert('Sale saved', 'Stock and customer balance were updated successfully.');
      await load();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Screen scroll={false} safeTop><Loading /></Screen>;
  const balance = total - Number(amountPaid || 0);
  return (
    <Screen safeTop>
      <Title eyebrow="Point of sale" subtitle="Choose a customer, add products and confirm payment">New Sale</Title>
      <View style={styles.steps}>
        <Step number="1" label="Customer" active />
        <View style={styles.stepLine} />
        <Step number="2" label="Products" active={selectedItemCount > 0} />
        <View style={styles.stepLine} />
        <Step number="3" label="Payment" active={selectedItemCount > 0} />
      </View>
      {offline ? <Message text="Offline mode: prepare the sale now; reconnect before saving. Your draft stays on this device." tone="warning" /> : null}
      {error ? <Message text={error} tone="error" /> : null}

      <SectionHeader title="1. Customer" subtitle="Walk-in sales must be paid in full" />
      <View style={styles.chips}>
        <Choice selected={customerId === null} label="Walk-in" icon="walk-outline" onPress={() => setCustomerId(null)} />
        {parties.map(party => <Choice key={party.id} selected={customerId === party.id} label={party.name} badge={party.party_type === 'agent' ? 'Agent' : 'Trader'} icon={party.party_type === 'agent' ? 'people-outline' : 'person-outline'} onPress={() => setCustomerId(party.id)} />)}
      </View>
      {selectedCustomer ? (
        <Card style={styles.selectedCustomer}>
          <View style={styles.customerAvatar}><Text style={styles.customerInitials}>{initials(selectedCustomer.name)}</Text></View>
          <View style={styles.customerCopy}><Text style={styles.customerName}>{selectedCustomer.name}</Text><Text style={styles.small}>{selectedCustomer.party_type === 'agent' ? 'Agent pricing applies' : 'Trader'} · {selectedCustomer.phone}</Text></View>
          <Badge label={selectedCustomer.balance_label.toUpperCase()} tone={selectedCustomer.balance_color === 'red' ? 'danger' : selectedCustomer.balance_color === 'green' ? 'success' : 'neutral'} />
        </Card>
      ) : null}
      {isAgentSale ? <Message text="Agent price applied automatically: 1.5% below every product's standard selling price." tone="success" /> : null}

      <SectionHeader title="2. Products" subtitle={`${selectedItemCount} item${selectedItemCount === 1 ? '' : 's'} selected`} />
      {products.map(product => {
        const selectedQuantity = quantities[String(product.id)] || 0;
        const selected = selectedQuantity > 0;
        return (
          <Card key={product.id} style={selected ? styles.selectedProduct : undefined}>
            <View style={styles.productRow}>
              <View style={[styles.productIcon, product.is_low_stock && styles.productIconLow]}><Icon name="cube-outline" size={23} color={product.is_low_stock ? colors.warning : colors.primary} /></View>
              <View style={styles.productInfo}>
                <View style={styles.productNameRow}><Text style={styles.productName}>{product.name}</Text>{product.is_low_stock ? <Badge label="LOW" tone="warning" /> : null}</View>
                <Text style={styles.small}>{product.current_quantity} available · {product.sku}</Text>
                <View style={styles.priceRow}>
                  <Money value={unitPrice(product)} size="small" />
                  {isAgentSale ? <Text style={styles.standardPrice}>{Number(product.selling_price).toFixed(2)} ETB standard</Text> : null}
                </View>
              </View>
              <View style={styles.stepper}>
                <Pressable accessibilityLabel={`Remove one ${product.name}`} style={styles.stepButton} onPress={() => changeQuantity(product, -1)}><Icon name="remove" size={20} color={colors.primary} /></Pressable>
                <Text style={styles.qty}>{selectedQuantity}</Text>
                <Pressable accessibilityLabel={`Add one ${product.name}`} style={[styles.stepButton, selected && styles.stepButtonSelected]} onPress={() => changeQuantity(product, 1)}><Icon name="add" size={20} color={selected ? colors.onPrimary : colors.primary} /></Pressable>
              </View>
            </View>
          </Card>
        );
      })}

      <SectionHeader title="3. Payment" subtitle="Confirm the amount received now" />
      <Card style={styles.paymentCard}>
        <View style={styles.totalRow}>
          <View><Text style={styles.totalLabel}>Sale Total</Text><Text style={styles.small}>{selectedItemCount} item{selectedItemCount === 1 ? '' : 's'}</Text></View>
          <Money value={total} size="large" />
        </View>
        <Input label="Amount Paid" icon="wallet-outline" value={amountPaid} onChangeText={setAmountPaid} keyboardType="decimal-pad" editable={customerId !== null} hint={customerId === null ? 'Walk-in sales are automatically paid in full.' : undefined} />
        {customerId !== null ? (
          <View style={[styles.balancePreview, { backgroundColor: balance > 0 ? colors.dangerSoft : balance < 0 ? colors.successSoft : colors.primarySoft }]}>
            <Icon name={balance > 0 ? 'arrow-down-circle-outline' : balance < 0 ? 'arrow-up-circle-outline' : 'checkmark-circle-outline'} size={24} color={balance > 0 ? colors.danger : balance < 0 ? colors.success : colors.primary} />
            <View style={styles.customerCopy}><Text style={[styles.balanceState, { color: balance > 0 ? colors.danger : balance < 0 ? colors.success : colors.primary }]}>{balance > 0 ? 'Owes Me' : balance < 0 ? 'I Owe' : 'Settled'}</Text><Money value={Math.abs(balance)} color={balance > 0 ? colors.danger : balance < 0 ? colors.success : colors.primary} size="small" /></View>
          </View>
        ) : null}
        <Input label="Note (optional)" icon="document-text-outline" value={note} onChangeText={setNote} placeholder="Add a reference or note" />
      </Card>
      <Button title={busy ? 'Saving Sale…' : `Confirm Sale · ${total.toFixed(2)} ETB`} icon="checkmark-circle-outline" onPress={submit} disabled={busy || total <= 0} />
      <Text style={styles.footerNote}>Saving updates stock and the selected customer's balance in one transaction.</Text>
    </Screen>
  );
}

function Step({ number, label, active = false }: { number: string; label: string; active?: boolean }) {
  return <View style={styles.step}><View style={[styles.stepCircle, active && styles.stepCircleActive]}><Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{number}</Text></View><Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text></View>;
}

function Choice({ selected, label, badge, icon, onPress }: { selected: boolean; label: string; badge?: string; icon: React.ComponentProps<typeof Icon>['name']; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Icon name={icon} size={17} color={selected ? colors.onPrimary : colors.primary} />
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>{label}</Text>
      {badge ? <Text style={[styles.chipBadge, selected && styles.chipBadgeSelected]}>{badge}</Text> : null}
    </Pressable>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: spacing.sm },
  step: { alignItems: 'center', gap: 5 },
  stepLine: { flex: 1, maxWidth: 70, height: 2, backgroundColor: colors.borderStrong, marginTop: 16 },
  stepCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  stepNumber: { color: colors.muted, fontWeight: '900', fontSize: 12 },
  stepNumberActive: { color: colors.onPrimary },
  stepLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  stepLabelActive: { color: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { maxWidth: '100%', minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  chipSelected: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  chipText: { maxWidth: 160, color: colors.text, fontWeight: '800', fontSize: 13 },
  chipTextSelected: { color: colors.onPrimary },
  chipBadge: { color: colors.muted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  chipBadgeSelected: { color: colors.onPrimary },
  selectedCustomer: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, borderColor: colors.primaryBorder },
  customerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  customerInitials: { color: colors.primary, fontWeight: '900', fontSize: 14 },
  customerCopy: { flex: 1 },
  customerName: { color: colors.text, fontWeight: '900', fontSize: 15 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  productIcon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  productIconLow: { backgroundColor: colors.warningSoft },
  productInfo: { flex: 1, gap: 2 },
  productNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  productName: { color: colors.text, fontWeight: '900', fontSize: 15, lineHeight: 20 },
  selectedProduct: { borderColor: colors.primaryBorder, backgroundColor: colors.successSoft },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  standardPrice: { color: colors.muted, fontSize: 10, textDecorationLine: 'line-through' },
  small: { color: colors.muted, fontSize: 12, lineHeight: 17, marginVertical: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stepButton: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  stepButtonSelected: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  qty: { minWidth: 22, textAlign: 'center', color: colors.text, fontWeight: '900', fontSize: 16 },
  paymentCard: { gap: spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  totalLabel: { color: colors.text, fontSize: 17, fontWeight: '900' },
  balancePreview: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, borderRadius: radius.md, padding: spacing.mdSm },
  balanceState: { fontWeight: '900', fontSize: 12, textTransform: 'uppercase', marginBottom: 2 },
  footerNote: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: spacing.md },
});
