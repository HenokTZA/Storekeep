import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Icon, Input, Loading, Message, Money, Screen, SearchField, SectionHeader, Title } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { apiFetch, cachedGet, errorMessage } from '@/lib/api';
import { createUuid } from '@/lib/uuid';
import { getLocalValue, removeLocalValue, setLocalValue } from '@/lib/database';
import { colors, radius, shadow, spacing } from '@/theme';
import type { Paginated, Party, Product } from '@/types';

const PRODUCT_PAGE_SIZE = 3;

type Draft = {
  customerId: number | null;
  quantities: Record<string, number>;
  selectedProducts?: Product[];
  amountPaid: string;
  note: string;
};

export default function SaleScreen() {
  const { store } = useAuth();
  const { customerId: requestedCustomerId } = useLocalSearchParams<{ customerId?: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [productQuery, setProductQuery] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productLoading, setProductLoading] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedProducts, setSelectedProducts] = useState<Record<string, Product>>({});
  const [amountPaid, setAmountPaid] = useState('0');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [partyOffline, setPartyOffline] = useState(false);
  const [productOffline, setProductOffline] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const offline = partyOffline || productOffline;

  const selectedCustomer = parties.find(party => party.id === customerId) || null;
  const isAgentSale = selectedCustomer?.party_type === 'agent';
  const selectedProductList = useMemo(
    () => Object.values(selectedProducts).filter(product => (quantities[String(product.id)] || 0) > 0),
    [quantities, selectedProducts],
  );
  const piecePrice = useCallback(
    (product: Product) => Number(isAgentSale ? product.agent_selling_price : product.selling_price),
    [isAgentSale],
  );
  const packPrice = useCallback(
    (product: Product) => piecePrice(product) * Number(product.pieces_per_unit || 1),
    [piecePrice],
  );
  const total = useMemo(
    () => selectedProductList.reduce(
      (sum, product) => sum + (quantities[String(product.id)] || 0) * packPrice(product),
      0,
    ),
    [packPrice, quantities, selectedProductList],
  );
  const selectedUnitCount = useMemo(
    () => selectedProductList.reduce((sum, product) => sum + (quantities[String(product.id)] || 0), 0),
    [quantities, selectedProductList],
  );
  const totalPages = Math.max(1, Math.ceil(productCount / PRODUCT_PAGE_SIZE));

  const loadProducts = useCallback(async (query: string, page: number) => {
    setProductLoading(true);
    try {
      const params = new URLSearchParams({
        page_size: String(PRODUCT_PAGE_SIZE),
        page: String(page),
        common: '1',
      });
      if (query.trim()) params.set('search', query.trim());
      const result = await cachedGet<Paginated<Product>>(`/products/?${params.toString()}`);
      setProducts(result.data.results);
      setProductCount(result.data.count);
      setProductOffline(result.offline);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setProductLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError('');
      const [partyResult, draft] = await Promise.all([
        cachedGet<Paginated<Party>>('/parties/?page_size=100'),
        getLocalValue<Draft>('sale-draft'),
      ]);
      setParties(partyResult.data.results);
      setPartyOffline(partyResult.offline);
      if (draft) {
        setCustomerId(draft.customerId);
        setQuantities(draft.quantities || {});
        setSelectedProducts(Object.fromEntries((draft.selectedProducts || []).map(product => [String(product.id), product])));
        setAmountPaid(draft.amountPaid);
        setNote(draft.note);
      }
      if (requestedCustomerId) setCustomerId(Number(requestedCustomerId));
      setProductQuery('');
      setProductPage(1);
      await loadProducts('', 1);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [loadProducts, requestedCustomerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (loading) return undefined;
    const timer = setTimeout(() => loadProducts(productQuery, productPage), 300);
    return () => clearTimeout(timer);
  }, [loading, loadProducts, productPage, productQuery]);

  useEffect(() => {
    if (!loading) {
      setLocalValue('sale-draft', {
        customerId,
        quantities,
        selectedProducts: selectedProductList,
        amountPaid,
        note,
      });
    }
  }, [amountPaid, customerId, loading, note, quantities, selectedProductList]);

  useEffect(() => {
    if (customerId === null) setAmountPaid(total.toFixed(2));
  }, [customerId, total]);

  const changeQuantity = (product: Product, delta: number) => {
    const key = String(product.id);
    const next = Math.max(0, Math.min(Number(product.current_quantity), (quantities[key] || 0) + delta));
    setQuantities(current => ({ ...current, [key]: next }));
    setSelectedProducts(current => {
      const updated = { ...current };
      if (next > 0) updated[key] = product;
      else delete updated[key];
      return updated;
    });
  };

  const submit = async () => {
    if (!selectedProductList.length) return setError('Select at least one product.');
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
          sale_items: selectedProductList.map(product => ({
            product_id: product.id,
            quantity: quantities[String(product.id)],
          })),
        }),
      });
      await removeLocalValue('sale-draft');
      setPreviewVisible(false);
      setCustomerId(null);
      setQuantities({});
      setSelectedProducts({});
      setNote('');
      setAmountPaid('0');
      Alert.alert('Sale saved', 'Stock, customer balance and invoice were created successfully.');
      await loadProducts(productQuery, productPage);
    } catch (nextError) {
      setError(errorMessage(nextError));
      setPreviewVisible(false);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Screen scroll={false} safeTop><Loading /></Screen>;
  const balance = total - Number(amountPaid || 0);
  return (
    <Screen safeTop>
      <Title eyebrow="Point of sale" subtitle="Choose a customer, sell in packs and confirm payment">New Sale</Title>
      <View style={styles.steps}>
        <Step number="1" label="Customer" active />
        <View style={styles.stepLine} />
        <Step number="2" label="Products" active={selectedUnitCount > 0} />
        <View style={styles.stepLine} />
        <Step number="3" label="Payment" active={selectedUnitCount > 0} />
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
      {isAgentSale ? <Message text="Agent price applied automatically: 1.5% below every product's standard price per piece." tone="success" /> : null}

      <SectionHeader title="2. Products" subtitle={`${selectedUnitCount} unit${selectedUnitCount === 1 ? '' : 's'} across ${selectedProductList.length} product${selectedProductList.length === 1 ? '' : 's'}`} />
      <SearchField
        value={productQuery}
        onChangeText={value => { setProductQuery(value); setProductPage(1); }}
        placeholder="Search product name or SKU"
        onSubmitEditing={() => loadProducts(productQuery, 1)}
      />
      {productLoading ? <Card><Loading /></Card> : products.length ? products.map(product => {
        const selectedQuantity = quantities[String(product.id)] || 0;
        const selected = selectedQuantity > 0;
        const piecesPerUnit = Number(product.pieces_per_unit || 1);
        return (
          <Card key={product.id} style={selected ? styles.selectedProduct : undefined}>
            <View style={styles.productRow}>
              <View style={[styles.productIcon, product.is_low_stock && styles.productIconLow]}><Icon name="cube-outline" size={23} color={product.is_low_stock ? colors.warning : colors.primary} /></View>
              <View style={styles.productInfo}>
                <View style={styles.productNameRow}><Text style={styles.productName}>{product.name}</Text>{product.is_low_stock ? <Badge label="LOW" tone="warning" /> : null}</View>
                <Text style={styles.small}>{product.current_quantity} units available · {product.sku}</Text>
                <View style={styles.packRow}>
                  <Text style={styles.packBadge}>×{piecesPerUnit} pcs / unit</Text>
                  <Text style={styles.small}><Money value={piecePrice(product)} size="small" /> per piece</Text>
                </View>
                <Text style={styles.packTotal}>{packPrice(product).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB per unit</Text>
                {isAgentSale ? <Text style={styles.standardPrice}>{Number(product.selling_price).toFixed(2)} ETB standard price / piece</Text> : null}
              </View>
            </View>
            <View style={styles.quantityRow}>
              <View>
                <Text style={styles.quantityTitle}>Sale quantity</Text>
                <Text style={styles.quantityHint}>Units / packs</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable disabled={!selected} accessibilityLabel={`Remove one unit of ${product.name}`} style={[styles.stepButton, !selected && styles.stepButtonDisabled]} onPress={() => changeQuantity(product, -1)}><Icon name="remove" size={20} color={selected ? colors.primary : colors.muted} /></Pressable>
                <View style={styles.qtyBox}><Text style={styles.qty}>{selectedQuantity}</Text><Text style={styles.qtyLabel}>unit{selectedQuantity === 1 ? '' : 's'}</Text></View>
                <Pressable accessibilityLabel={`Add one unit of ${product.name}`} style={[styles.stepButton, selected && styles.stepButtonSelected]} onPress={() => changeQuantity(product, 1)}><Icon name="add" size={20} color={selected ? colors.onPrimary : colors.primary} /></Pressable>
              </View>
            </View>
          </Card>
        );
      }) : <Message text={productQuery ? 'No products match this search.' : 'No active products are available.'} />}
      <View style={styles.pagination}>
        <Pressable disabled={productPage <= 1 || productLoading} onPress={() => setProductPage(page => Math.max(1, page - 1))} style={({ pressed }) => [styles.pageButton, (productPage <= 1 || productLoading) && styles.pageDisabled, pressed && styles.pressed]}>
          <Icon name="chevron-back" size={18} color={colors.primary} /><Text style={styles.pageButtonText}>Previous</Text>
        </Pressable>
        <View style={styles.pageStatus}><Text style={styles.pageNumber}>Page {productPage} of {totalPages}</Text><Text style={styles.pageCount}>{productCount.toLocaleString()} products</Text></View>
        <Pressable disabled={productPage >= totalPages || productLoading} onPress={() => setProductPage(page => Math.min(totalPages, page + 1))} style={({ pressed }) => [styles.pageButton, (productPage >= totalPages || productLoading) && styles.pageDisabled, pressed && styles.pressed]}>
          <Text style={styles.pageButtonText}>Next</Text><Icon name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <SectionHeader title="3. Payment" subtitle="Review the invoice before final confirmation" />
      <Card style={styles.paymentCard}>
        <View style={styles.totalRow}>
          <View><Text style={styles.totalLabel}>Sale Total</Text><Text style={styles.small}>{selectedUnitCount} unit{selectedUnitCount === 1 ? '' : 's'} · {selectedProductList.length} lines</Text></View>
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
      <Button title="View Invoice" icon="document-text-outline" variant="secondary" onPress={() => setPreviewVisible(true)} disabled={total <= 0} />
      <Button title={busy ? 'Saving Sale…' : `Confirm Sale · ${total.toFixed(2)} ETB`} icon="checkmark-circle-outline" onPress={submit} disabled={busy || total <= 0} />
      <Text style={styles.footerNote}>Saving updates stock and the selected customer's balance in one transaction.</Text>

      <InvoicePreview
        visible={previewVisible}
        storeName={store?.name || 'StoreLedger'}
        currency={store?.currency || 'ETB'}
        customer={selectedCustomer}
        products={selectedProductList}
        quantities={quantities}
        piecePrice={piecePrice}
        total={total}
        amountPaid={Number(amountPaid || 0)}
        note={note}
        busy={busy}
        onClose={() => setPreviewVisible(false)}
        onConfirm={submit}
      />
    </Screen>
  );
}

function InvoicePreview({ visible, storeName, currency, customer, products, quantities, piecePrice, total, amountPaid, note, busy, onClose, onConfirm }: {
  visible: boolean;
  storeName: string;
  currency: string;
  customer: Party | null;
  products: Product[];
  quantities: Record<string, number>;
  piecePrice: (product: Product) => number;
  total: number;
  amountPaid: number;
  note: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.invoiceSheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.invoiceHeader}>
            <View><Text style={styles.invoiceEyebrow}>INVOICE PREVIEW</Text><Text style={styles.invoiceStore}>{storeName}</Text><Text style={styles.invoiceMeta}>{customer?.name || 'Walk-in customer'} · {new Date().toLocaleString()}</Text></View>
            <Pressable accessibilityLabel="Close invoice preview" onPress={onClose} style={styles.closeButton}><Icon name="close" size={22} color={colors.text} /></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.invoiceContent}>
            <Message text="This is a preview. Stock and balances change only after you confirm the sale." />
            {products.map(product => {
              const units = quantities[String(product.id)] || 0;
              const pieces = Number(product.pieces_per_unit || 1);
              const lineTotal = units * pieces * piecePrice(product);
              return (
                <View key={product.id} style={styles.invoiceLine}>
                  <View style={styles.invoiceLineTop}><Text style={styles.invoiceProduct}>{product.name}</Text><Money value={lineTotal} currency={currency} size="small" /></View>
                  <Text style={styles.invoiceCalculation}>{units} unit{units === 1 ? '' : 's'} × {pieces} pieces × {piecePrice(product).toFixed(2)} {currency} / piece</Text>
                  <Text style={styles.invoicePieces}>{(units * pieces).toLocaleString()} individual pieces</Text>
                </View>
              );
            })}
            <View style={styles.invoiceSummary}>
              <SummaryRow label="Invoice total" value={total} currency={currency} strong />
              <SummaryRow label="Amount paid" value={amountPaid} currency={currency} />
              <SummaryRow label="Outstanding" value={total - amountPaid} currency={currency} tone={total - amountPaid > 0 ? 'danger' : total - amountPaid < 0 ? 'success' : 'normal'} />
            </View>
            {note ? <View style={styles.invoiceNote}><Text style={styles.invoiceNoteLabel}>NOTE</Text><Text style={styles.invoiceNoteText}>{note}</Text></View> : null}
          </ScrollView>
          <View style={styles.invoiceFooter}>
            <View style={styles.invoiceFooterButton}><Button title="Edit Sale" variant="ghost" onPress={onClose} disabled={busy} /></View>
            <View style={styles.invoiceFooterButton}><Button title={busy ? 'Saving…' : 'Confirm & Post'} icon="checkmark-circle-outline" onPress={onConfirm} disabled={busy} /></View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SummaryRow({ label, value, currency, strong = false, tone = 'normal' }: { label: string; value: number; currency: string; strong?: boolean; tone?: 'normal' | 'danger' | 'success' }) {
  const color = tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.text;
  return <View style={styles.summaryRow}><Text style={[styles.summaryLabel, strong && styles.summaryStrong]}>{label}</Text><Text style={[styles.summaryValue, strong && styles.summaryStrong, { color }]}>{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</Text></View>;
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
  productIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  productIconLow: { backgroundColor: colors.warningSoft },
  productInfo: { flex: 1, gap: 2 },
  productNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  productName: { color: colors.text, fontWeight: '900', fontSize: 15, lineHeight: 20 },
  selectedProduct: { borderColor: colors.primaryBorder, backgroundColor: colors.successSoft },
  packRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  packBadge: { color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '900' },
  packTotal: { color: colors.text, fontSize: 11, fontWeight: '900', marginTop: 2 },
  standardPrice: { color: colors.muted, fontSize: 10, textDecorationLine: 'line-through' },
  small: { color: colors.muted, fontSize: 12, lineHeight: 17, marginVertical: 2 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.mdSm, paddingTop: spacing.mdSm, borderTopWidth: 1, borderTopColor: colors.border },
  quantityTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  quantityHint: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stepButton: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  stepButtonDisabled: { opacity: 0.45 },
  stepButtonSelected: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  qtyBox: { minWidth: 44, alignItems: 'center' },
  qty: { color: colors.text, fontWeight: '900', fontSize: 16 },
  qtyLabel: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pageButton: { minHeight: 42, minWidth: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radius.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, paddingHorizontal: spacing.sm },
  pageButtonText: { color: colors.primary, fontWeight: '900', fontSize: 12 },
  pageDisabled: { opacity: 0.38 },
  pageStatus: { alignItems: 'center' },
  pageNumber: { color: colors.text, fontSize: 11, fontWeight: '900' },
  pageCount: { color: colors.muted, fontSize: 9, marginTop: 2 },
  pressed: { opacity: 0.65 },
  paymentCard: { gap: spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  totalLabel: { color: colors.text, fontSize: 17, fontWeight: '900' },
  balancePreview: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, borderRadius: radius.md, padding: spacing.mdSm },
  balanceState: { fontWeight: '900', fontSize: 12, textTransform: 'uppercase', marginBottom: 2 },
  footerNote: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: spacing.md },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10, 24, 19, 0.48)' },
  invoiceSheet: { maxHeight: '92%', backgroundColor: colors.background, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: spacing.md, ...shadow.card },
  invoiceHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  invoiceEyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  invoiceStore: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 3 },
  invoiceMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  invoiceContent: { padding: spacing.md, gap: spacing.md },
  invoiceLine: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.mdSm },
  invoiceLineTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  invoiceProduct: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '900' },
  invoiceCalculation: { color: colors.textSoft, fontSize: 11, lineHeight: 17, marginTop: 6 },
  invoicePieces: { color: colors.primary, fontSize: 10, fontWeight: '800', marginTop: 2 },
  invoiceSummary: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.mdSm, gap: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  summaryLabel: { color: colors.textSoft, fontSize: 12 },
  summaryValue: { color: colors.text, fontSize: 12, fontWeight: '800' },
  summaryStrong: { fontSize: 15, fontWeight: '900' },
  invoiceNote: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.mdSm },
  invoiceNoteLabel: { color: colors.warning, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  invoiceNoteText: { color: colors.text, fontSize: 12, lineHeight: 18, marginTop: 4 },
  invoiceFooter: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  invoiceFooterButton: { flex: 1 },
});
