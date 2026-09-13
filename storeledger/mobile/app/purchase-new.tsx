import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { localizedAlert, Text, useI18n } from '@/i18n';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button, Card, Icon, Input, Loading, Message, Money, Screen, SearchField, SectionHeader, Title } from '@/components/ui';
import { FactoryDropdown } from '@/components/FactoryDropdown';
import { apiFetch, errorMessage } from '@/lib/api';
import { createUuid } from '@/lib/uuid';
import { colors, radius, spacing } from '@/theme';
import type { Paginated, Party, Product } from '@/types';

type Line = { product: Product; quantity: string; unitCost: string };
const localDate = () => { const value = new Date(); value.setMinutes(value.getMinutes() - value.getTimezoneOffset()); return value.toISOString().slice(0, 10); };

export default function PurchaseNewScreen() {
  const { t } = useI18n();
  const { factoryId: requestedFactoryId, productId: requestedProductId } = useLocalSearchParams<{ factoryId?: string; productId?: string }>();
  const [factories, setFactories] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [factoryId, setFactoryId] = useState<number | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [purchaseDate, setPurchaseDate] = useState(localDate());
  const [amountPaid, setAmountPaid] = useState('0');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preselectionDone, setPreselectionDone] = useState(!requestedProductId);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setError('');
      const factoryResult = await apiFetch<Paginated<Party>>('/parties/?party_type=factory&page_size=200');
      setFactories(factoryResult.results);
      const requested = Number(requestedFactoryId || 0);
      const selected = factoryResult.results.some(item => item.id === requested) ? requested : factoryResult.results[0]?.id || null;
      setFactoryId(selected);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [requestedFactoryId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loadProducts = useCallback(async () => {
    if (!factoryId) {
      setProducts([]);
      return;
    }
    try {
      const suffix = productQuery.trim() ? `&search=${encodeURIComponent(productQuery.trim())}` : '';
      const result = await apiFetch<Paginated<Product>>(`/products/?factory=${factoryId}&page_size=100${suffix}`);
      setProducts(result.results);
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  }, [factoryId, productQuery]);

  useEffect(() => {
    if (loading) return undefined;
    const timer = setTimeout(loadProducts, 250);
    return () => clearTimeout(timer);
  }, [loadProducts, loading]);

  useEffect(() => {
    if (loading || preselectionDone || !factoryId || !requestedProductId) return;
    let active = true;
    const preselectProduct = async () => {
      try {
        const product = await apiFetch<Product>(`/products/${requestedProductId}/`);
        if (!active) return;
        if (product.factory !== factoryId) throw new Error('The selected product does not belong to this factory.');
        setProducts(current => current.some(item => item.id === product.id) ? current : [product, ...current]);
        setLines(current => current.some(line => line.product.id === product.id)
          ? current
          : [...current, { product, quantity: '1', unitCost: product.purchase_price }]);
      } catch (nextError) {
        if (active) setError(errorMessage(nextError));
      } finally {
        if (active) setPreselectionDone(true);
      }
    };
    preselectProduct();
    return () => { active = false; };
  }, [factoryId, loading, preselectionDone, requestedProductId]);

  const chooseFactory = (nextFactoryId: number) => {
    if (nextFactoryId === factoryId) return;
    setFactoryId(nextFactoryId);
    setProductQuery('');
    setLines([]);
    setPreselectionDone(true);
  };
  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.product.pieces_per_unit || 1) * Number(line.unitCost || 0), 0), [lines]);
  const addLine = (product: Product) => setLines(current => current.some(line => line.product.id === product.id) ? current : [...current, { product, quantity: '1', unitCost: product.purchase_price }]);
  const updateLine = (productId: number, field: 'quantity' | 'unitCost', value: string) => setLines(current => current.map(line => line.product.id === productId ? { ...line, [field]: value } : line));
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/purchases/', { method: 'POST', body: JSON.stringify({ supplier_id: factoryId, idempotency_key: createUuid(), purchase_date: purchaseDate, amount_paid: amountPaid || '0', reference, note, purchase_items: lines.map(line => ({ product_id: line.product.id, quantity: line.quantity, unit_cost: line.unitCost })) }) });
      localizedAlert('Purchase received', 'Factory stock and payable balance were updated. Only the amount paid now was added to expenses and today’s transactions.');
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
      <Title eyebrow="Procurement" subtitle="Receive stock from a factory and post its payable together">{requestedProductId ? 'Receive Product Purchase' : 'Receive Purchase'}</Title>
      <View style={styles.steps}><Step number="1" label="Factory" active /><View style={styles.line} /><Step number="2" label="Products" active={lines.length > 0} /><View style={styles.line} /><Step number="3" label="Payment" active={lines.length > 0} /></View>
      {error ? <Message text={error} tone="error" /> : null}
      {requestedProductId ? <Message text="Opened from Stock: the factory and product are already selected. Complete the cost, payment, date, reference and note below." tone="success" /> : null}

      <SectionHeader title="1. Factory" subtitle="Only products belonging to this factory will be shown" />
      {factories.length ? <FactoryDropdown factories={factories} value={factoryId} onChange={chooseFactory} label="Purchase Factory" /> : (
        <View style={styles.emptyFactory}><Message text="No factories exist yet. Add a factory before receiving a purchase." tone="warning" /><Button title="Add Factory" icon="business-outline" variant="secondary" onPress={() => router.push({ pathname: '/customer-new', params: { type: 'factory' } })} /></View>
      )}

      <SectionHeader title="2. Products received" subtitle={`${lines.length} selected product line${lines.length === 1 ? '' : 's'}`} />
      {factoryId ? <SearchField value={productQuery} onChangeText={setProductQuery} placeholder="Search this factory's products" onSubmitEditing={loadProducts} /> : null}
      {available.length ? <View style={styles.productPicker}>{available.map(product => <Choice key={product.id} icon="add-circle-outline" label={product.name} active={false} onPress={() => addLine(product)} />)}</View> : factoryId ? <Message text={productQuery ? 'No products match this factory search.' : 'Add a product for this factory, or all matching products are already selected.'} /> : null}
      {lines.map(lineItem => {
        const lineTotal = Number(lineItem.quantity || 0) * Number(lineItem.product.pieces_per_unit || 1) * Number(lineItem.unitCost || 0);
        return (
          <Card key={lineItem.product.id}>
            <View style={styles.productRow}>
              <View style={styles.productIcon}><Icon name="cube-outline" size={22} color={colors.primary} /></View>
              <View style={styles.flex}><Text style={styles.name}>{lineItem.product.name}</Text><Text style={styles.factoryName}>Factory {lineItem.product.factory_name}</Text><Text style={styles.small}>×{lineItem.product.pieces_per_unit} pcs / unit · stock {lineItem.product.current_quantity} units</Text></View>
              <Pressable accessibilityLabel={t(`Remove ${lineItem.product.name}`)} onPress={() => setLines(current => current.filter(item => item.product.id !== lineItem.product.id))} style={styles.removeButton}><Icon name="trash-outline" size={18} color={colors.danger} /></Pressable>
            </View>
            <View style={styles.inputs}><View style={styles.flex}><Input label="Units" value={lineItem.quantity} onChangeText={value => updateLine(lineItem.product.id, 'quantity', value)} keyboardType="decimal-pad" /></View><View style={styles.flex}><Input label="Cost / Piece" value={lineItem.unitCost} onChangeText={value => updateLine(lineItem.product.id, 'unitCost', value)} keyboardType="decimal-pad" /></View></View>
            <View style={styles.lineTotalRow}><View><Text style={styles.lineTotalLabel}>Line total</Text><Text style={styles.small}>{lineItem.quantity || 0} units × {lineItem.product.pieces_per_unit} pcs × {lineItem.unitCost || 0}</Text></View><Money value={lineTotal} size="small" /></View>
          </Card>
        );
      })}

      <SectionHeader title="3. Payment" subtitle="Any unpaid amount becomes an I Owe balance" />
      <Card style={styles.paymentCard}>
        <View style={styles.totalRow}><View><Text style={styles.totalLabel}>Purchase Total</Text><Text style={styles.small}>{lines.length} product line{lines.length === 1 ? '' : 's'}</Text></View><Money value={total} size="large" /></View>
        <Input label="Amount Paid Now" icon="wallet-outline" value={amountPaid} onChangeText={setAmountPaid} keyboardType="decimal-pad" />
        <View style={styles.owePreview}><Icon name="arrow-up-circle-outline" size={24} color={colors.success} /><View style={styles.flex}><Text style={styles.oweLabel}>I OWE FACTORY</Text><Money value={outstanding} color={colors.success} size="small" /></View></View>
        <Input label="Purchase Date (YYYY-MM-DD)" icon="calendar-outline" value={purchaseDate} onChangeText={setPurchaseDate} />
        <Input label="Reference / Invoice (optional)" icon="barcode-outline" value={reference} onChangeText={setReference} />
        <Input label="Note (optional)" icon="document-text-outline" value={note} onChangeText={setNote} multiline />
      </Card>
      <Button title={busy ? 'Posting…' : 'Post Purchase & Receive Stock'} icon="checkmark-circle-outline" onPress={save} disabled={busy || !factoryId || !lines.length || total <= 0 || Number(amountPaid) < 0 || Number(amountPaid) > total} />
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
  emptyFactory: { gap: spacing.sm },
  productPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, maxHeight: 220, overflow: 'hidden' },
  chip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 13 },
  active: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  chipText: { maxWidth: 190, color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  activeText: { color: colors.onPrimary },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  productIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 15, fontWeight: '900' },
  factoryName: { color: colors.primary, fontSize: 10, fontWeight: '900', marginTop: 3 },
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
