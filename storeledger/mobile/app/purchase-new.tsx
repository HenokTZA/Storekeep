import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button, Card, Icon, Input, Loading, Message, Money, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { createUuid } from '@/lib/uuid';
import { colors, radius, spacing } from '@/theme';
import type { Paginated, Party, Product } from '@/types';

type Line = { product: Product; quantity: string; unitCost: string };
const localDate = () => { const value = new Date(); value.setMinutes(value.getMinutes() - value.getTimezoneOffset()); return value.toISOString().slice(0, 10); };

export default function PurchaseNewScreen() {
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [purchaseDate, setPurchaseDate] = useState(localDate());
  const [amountPaid, setAmountPaid] = useState('0');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const [partyResult, productResult] = await Promise.all([apiFetch<Paginated<Party>>('/parties/?page_size=200'), apiFetch<Paginated<Product>>('/products/?page_size=200')]);
      setParties(partyResult.results);
      setProducts(productResult.results);
      if (!supplierId && partyResult.results.length) setSupplierId(partyResult.results[0].id);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [supplierId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0), [lines]);
  const addLine = (product: Product) => setLines(current => current.some(line => line.product.id === product.id) ? current : [...current, { product, quantity: '1', unitCost: product.purchase_price }]);
  const updateLine = (productId: number, field: 'quantity' | 'unitCost', value: string) => setLines(current => current.map(line => line.product.id === productId ? { ...line, [field]: value } : line));
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/purchases/', { method: 'POST', body: JSON.stringify({ supplier_id: supplierId, idempotency_key: createUuid(), purchase_date: purchaseDate, amount_paid: amountPaid || '0', reference, note, purchase_items: lines.map(line => ({ product_id: line.product.id, quantity: line.quantity, unit_cost: line.unitCost })) }) });
      Alert.alert('Purchase received', 'Stock and supplier balance were updated. Only the amount paid now was added to expenses and today’s transactions.');
      router.back();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <Screen scroll={false}><Loading /></Screen>;
  const available = products.filter(product => !lines.some(line => line.product.id === product.id));
  const outstanding = Math.max(0, total - Number(amountPaid || 0));
  return (
    <Screen>
      <Title eyebrow="Procurement" subtitle="Receive stock and post the supplier payable together">Receive Purchase</Title>
      <View style={styles.steps}><Step number="1" label="Supplier" active /><View style={styles.line} /><Step number="2" label="Products" active={lines.length > 0} /><View style={styles.line} /><Step number="3" label="Payment" active={lines.length > 0} /></View>
      {error ? <Message text={error} tone="error" /> : null}

      <SectionHeader title="1. Supplier" subtitle="Choose who supplied this purchase" />
      <View style={styles.chips}>{parties.map(party => <Choice key={party.id} icon="business-outline" label={party.company || party.name} active={supplierId === party.id} onPress={() => setSupplierId(party.id)} />)}</View>

      <SectionHeader title="2. Products received" subtitle={`${lines.length} selected product line${lines.length === 1 ? '' : 's'}`} />
      {available.length ? <View style={styles.productPicker}>{available.map(product => <Choice key={product.id} icon="add-circle-outline" label={product.name} active={false} onPress={() => addLine(product)} />)}</View> : <Message text="Every active product is already included in this purchase." tone="success" />}
      {lines.map(lineItem => {
        const lineTotal = Number(lineItem.quantity || 0) * Number(lineItem.unitCost || 0);
        return (
          <Card key={lineItem.product.id}>
            <View style={styles.productRow}>
              <View style={styles.productIcon}><Icon name="cube-outline" size={22} color={colors.primary} /></View>
              <View style={styles.flex}><Text style={styles.name}>{lineItem.product.name}</Text><Text style={styles.small}>{lineItem.product.sku} · current stock {lineItem.product.current_quantity}</Text></View>
              <Pressable accessibilityLabel={`Remove ${lineItem.product.name}`} onPress={() => setLines(current => current.filter(item => item.product.id !== lineItem.product.id))} style={styles.removeButton}><Icon name="trash-outline" size={18} color={colors.danger} /></Pressable>
            </View>
            <View style={styles.inputs}><View style={styles.flex}><Input label="Quantity" value={lineItem.quantity} onChangeText={value => updateLine(lineItem.product.id, 'quantity', value)} keyboardType="decimal-pad" /></View><View style={styles.flex}><Input label="Unit Cost" value={lineItem.unitCost} onChangeText={value => updateLine(lineItem.product.id, 'unitCost', value)} keyboardType="decimal-pad" /></View></View>
            <View style={styles.lineTotalRow}><Text style={styles.lineTotalLabel}>Line total</Text><Money value={lineTotal} size="small" /></View>
          </Card>
        );
      })}

      <SectionHeader title="3. Payment" subtitle="Any unpaid amount becomes an I Owe balance" />
      <Card style={styles.paymentCard}>
        <View style={styles.totalRow}><View><Text style={styles.totalLabel}>Purchase Total</Text><Text style={styles.small}>{lines.length} product line{lines.length === 1 ? '' : 's'}</Text></View><Money value={total} size="large" /></View>
        <Input label="Amount Paid Now" icon="wallet-outline" value={amountPaid} onChangeText={setAmountPaid} keyboardType="decimal-pad" />
        <View style={styles.owePreview}><Icon name="arrow-up-circle-outline" size={24} color={colors.success} /><View style={styles.flex}><Text style={styles.oweLabel}>I OWE SUPPLIER</Text><Money value={outstanding} color={colors.success} size="small" /></View></View>
        <Input label="Purchase Date (YYYY-MM-DD)" icon="calendar-outline" value={purchaseDate} onChangeText={setPurchaseDate} />
        <Input label="Reference / Invoice (optional)" icon="barcode-outline" value={reference} onChangeText={setReference} />
        <Input label="Note (optional)" icon="document-text-outline" value={note} onChangeText={setNote} multiline />
      </Card>
      <Button title={busy ? 'Posting…' : 'Post Purchase & Receive Stock'} icon="checkmark-circle-outline" onPress={save} disabled={busy || !supplierId || !lines.length || total <= 0 || Number(amountPaid) < 0 || Number(amountPaid) > total} />
    </Screen>
  );
}

function Step({ number, label, active = false }: { number: string; label: string; active?: boolean }) {
  return <View style={styles.step}><View style={[styles.stepCircle, active && styles.stepCircleActive]}><Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{number}</Text></View><Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text></View>;
}

function Choice({ icon, label, active, onPress }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.active]}><Icon name={icon} size={17} color={active ? colors.onPrimary : colors.primary} /><Text style={[styles.chipText, active && styles.activeText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  steps: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: spacing.sm },
  step: { alignItems: 'center', gap: 5 },
  line: { flex: 1, maxWidth: 70, height: 2, backgroundColor: colors.borderStrong, marginTop: 16 },
  stepCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  stepNumber: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  stepNumberActive: { color: colors.onPrimary },
  stepLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  stepLabelActive: { color: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  productPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, maxHeight: 220, overflow: 'hidden' },
  chip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 13 },
  active: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  chipText: { maxWidth: 190, color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  activeText: { color: colors.onPrimary },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  productIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 15, fontWeight: '900' },
  small: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  removeButton: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  inputs: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  lineTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.mdSm, borderTopWidth: 1, borderTopColor: colors.border },
  lineTotalLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  paymentCard: { gap: spacing.md },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  totalLabel: { color: colors.text, fontSize: 17, fontWeight: '900' },
  owePreview: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, backgroundColor: colors.successSoft, borderRadius: radius.md, padding: spacing.mdSm },
  oweLabel: { color: colors.success, fontSize: 10, fontWeight: '900', letterSpacing: 0.45 },
});
