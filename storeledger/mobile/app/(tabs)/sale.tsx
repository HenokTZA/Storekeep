import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { localizedAlert, Text, useI18n } from '@/i18n';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Icon, Input, Loading, Message, Money, Screen, SearchField, SectionHeader, Title } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { apiFetch, cachedGet, errorMessage } from '@/lib/api';
import { agentSellingPrice } from '@/lib/pricing';
import { createUuid } from '@/lib/uuid';
import { getLocalValue, removeLocalValue, setLocalValue } from '@/lib/database';
import { colors, radius, shadow, spacing } from '@/theme';
import type { Paginated, Party, Product } from '@/types';

const PRODUCT_PAGE_SIZE = 3;
const CUSTOMER_PAGE_SIZE = 5;

type Draft = {
  customerId: number | null;
  selectedCustomer?: Party | null;
  isWalkIn?: boolean;
  quantities: Record<string, number>;
  selectedProducts?: Product[];
  customPrices?: Record<string, string>;
  amountPaid: string;
  note: string;
};

export default function SaleScreen() {
  const { t } = useI18n();
  const { store } = useAuth();
  const { customerId: requestedCustomerId } = useLocalSearchParams<{ customerId?: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [productQuery, setProductQuery] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productLoading, setProductLoading] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const [partyCount, setPartyCount] = useState(0);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerType, setCustomerType] = useState<'all' | 'trader' | 'agent'>('all');
  const [customerPage, setCustomerPage] = useState(1);
  const [partyLoading, setPartyLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Party | null>(null);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const customerRequest = useRef(0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedProducts, setSelectedProducts] = useState<Record<string, Product>>({});
  const [customPrices, setCustomPrices] = useState<Record<string, string>>({});
  const [amountPaid, setAmountPaid] = useState('0');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [partyOffline, setPartyOffline] = useState(false);
  const [productOffline, setProductOffline] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [quantityEditor, setQuantityEditor] = useState<Product | null>(null);
  const [quantityDraft, setQuantityDraft] = useState('');
  const [quantityError, setQuantityError] = useState('');
  const offline = partyOffline || productOffline;

  const isAgentSale = selectedCustomer?.party_type === 'agent';
  const selectedProductList = useMemo(
    () => Object.values(selectedProducts).filter(product => (quantities[String(product.id)] || 0) > 0),
    [quantities, selectedProducts],
  );
  const editablePiecePrice = useCallback(
    (product: Product) => {
      const custom = customPrices[String(product.id)];
      return custom !== undefined ? Number(custom) : Number(product.selling_price);
    },
    [customPrices],
  );
  const basePiecePrice = useCallback(
    (product: Product) => {
      const enteredPrice = editablePiecePrice(product);
      return Number.isFinite(enteredPrice) ? Number(enteredPrice.toFixed(2)) : enteredPrice;
    },
    [editablePiecePrice],
  );
  const salePiecePrice = useCallback(
    (product: Product) => {
      const basePrice = basePiecePrice(product);
      return isAgentSale ? agentSellingPrice(basePrice) : basePrice;
    },
    [basePiecePrice, isAgentSale],
  );
  const packPrice = useCallback(
    (product: Product) => salePiecePrice(product) * Number(product.pieces_per_unit || 1),
    [salePiecePrice],
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
  const customerTotalPages = Math.max(1, Math.ceil(partyCount / CUSTOMER_PAGE_SIZE));

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

  const loadCustomers = useCallback(async (query: string, type: 'all' | 'trader' | 'agent', page: number) => {
    const request = ++customerRequest.current;
    setPartyLoading(true);
    try {
      const params = new URLSearchParams({
        page_size: String(CUSTOMER_PAGE_SIZE),
        page: String(page),
        common: '1',
        customer_only: '1',
      });
      if (query.trim()) params.set('search', query.trim());
      if (type !== 'all') params.set('party_type', type);
      const result = await cachedGet<Paginated<Party>>(`/parties/?${params.toString()}`);
      if (request !== customerRequest.current) return [];
      setParties(result.data.results);
      setPartyCount(result.data.count);
      setPartyOffline(result.offline);
      setSelectedCustomer(current => current
        ? result.data.results.find(party => party.id === current.id) || current
        : current);
      return result.data.results;
    } catch (nextError) {
      if (request === customerRequest.current) setError(errorMessage(nextError));
      return [];
    } finally {
      if (request === customerRequest.current) setPartyLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setError('');
      const [initialCustomers, draft] = await Promise.all([
        loadCustomers('', 'all', 1),
        getLocalValue<Draft>('sale-draft'),
      ]);
      if (draft) {
        setQuantities(draft.quantities || {});
        setSelectedProducts(Object.fromEntries((draft.selectedProducts || []).map(product => [String(product.id), product])));
        setCustomPrices(draft.customPrices || {});
        setAmountPaid(draft.amountPaid);
        setNote(draft.note);
      }
      const requested = requestedCustomerId ? Number(requestedCustomerId) : null;
      const restoredId = requested || draft?.customerId || null;
      let restoredCustomer = restoredId
        ? initialCustomers.find(party => party.id === restoredId)
          || (draft?.selectedCustomer?.id === restoredId ? draft.selectedCustomer : null)
        : null;
      if (restoredId && !restoredCustomer) {
        try {
          const result = await cachedGet<Party>(`/parties/${restoredId}/`);
          restoredCustomer = result.data;
          if (result.offline) setPartyOffline(true);
        } catch {
          restoredCustomer = null;
        }
      }
      setSelectedCustomer(restoredCustomer);
      // Walk-in mode is an explicit per-sale choice and must always start off.
      // Older saved drafts may contain isWalkIn=true, so do not restore it.
      setIsWalkIn(false);
      setCustomerQuery('');
      setCustomerType('all');
      setCustomerPage(1);
      setProductQuery('');
      setProductPage(1);
      await loadProducts('', 1);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [loadCustomers, loadProducts, requestedCustomerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (loading) return undefined;
    const timer = setTimeout(() => loadProducts(productQuery, productPage), 300);
    return () => clearTimeout(timer);
  }, [loading, loadProducts, productPage, productQuery]);

  useEffect(() => {
    if (loading) return undefined;
    const timer = setTimeout(() => loadCustomers(customerQuery, customerType, customerPage), 300);
    return () => clearTimeout(timer);
  }, [customerPage, customerQuery, customerType, loadCustomers, loading]);

  useEffect(() => {
    if (!loading) {
      setLocalValue('sale-draft', {
        customerId: selectedCustomer?.id || null,
        selectedCustomer,
        isWalkIn,
        quantities,
        selectedProducts: selectedProductList,
        customPrices,
        amountPaid,
        note,
      });
    }
  }, [amountPaid, customPrices, isWalkIn, loading, note, quantities, selectedCustomer, selectedProductList]);

  useEffect(() => {
    if (isWalkIn) setAmountPaid(total.toFixed(2));
  }, [isWalkIn, total]);

  const setProductQuantity = (product: Product, requestedQuantity: number) => {
    const key = String(product.id);
    const next = Math.max(0, Math.min(Number(product.current_quantity), requestedQuantity));
    setQuantities(current => ({ ...current, [key]: next }));
    setSelectedProducts(current => {
      const updated = { ...current };
      if (next > 0) updated[key] = product;
      else delete updated[key];
      return updated;
    });
  };

  const changeQuantity = (product: Product, delta: number) => {
    setProductQuantity(product, (quantities[String(product.id)] || 0) + delta);
  };

  const openQuantityEditor = (product: Product) => {
    setQuantityDraft(String(quantities[String(product.id)] || 0));
    setQuantityError('');
    setQuantityEditor(product);
  };

  const updateQuantityDraft = (value: string) => {
    setQuantityDraft(value);
    if (!quantityEditor || !value.trim()) {
      setQuantityError('');
      return;
    }
    const next = Number(value);
    const available = Number(quantityEditor.current_quantity);
    if (!Number.isFinite(next) || next < 0) {
      setQuantityError(`Enter numbers only, from 0 to ${available.toLocaleString()} units.`);
    } else if (next > available) {
      setQuantityError(`You entered ${next.toLocaleString()} units, but only ${available.toLocaleString()} are in stock. Enter ${available.toLocaleString()} or less.`);
    } else {
      setQuantityError('');
    }
  };

  const applyQuantity = () => {
    if (!quantityEditor) return;
    const next = Number(quantityDraft);
    const available = Number(quantityEditor.current_quantity);
    if (!Number.isFinite(next) || next < 0) {
      setQuantityError(`Enter numbers only, from 0 to ${available.toLocaleString()} units.`);
      return;
    }
    if (next > available) {
      setQuantityError(`You entered ${next.toLocaleString()} units, but only ${available.toLocaleString()} are in stock. Enter ${available.toLocaleString()} or less.`);
      return;
    }
    setProductQuantity(quantityEditor, next);
    setQuantityError('');
    setQuantityEditor(null);
  };

  const submit = async () => {
    if (!isWalkIn && !selectedCustomer) return setError('Select a customer or turn on Walk-in.');
    if (!selectedProductList.length) return setError('Select at least one product.');
    if (selectedProductList.some(product => !Number.isFinite(basePiecePrice(product)) || basePiecePrice(product) < 0)) return setError('Enter a valid selling price for every selected product.');
    if (offline) return setError('Reconnect to the internet before posting this financial transaction. Your draft is saved.');
    setBusy(true);
    setError('');
    try {
      await apiFetch('/sales/', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: isWalkIn ? null : selectedCustomer?.id ?? null,
          idempotency_key: createUuid(),
          amount_paid: Number(amountPaid || 0).toFixed(2),
          note,
          sale_items: selectedProductList.map(product => ({
            product_id: product.id,
            quantity: quantities[String(product.id)],
            // Send the editable base; the API applies the Agent discount and
            // stores the final charged per-piece amount in the sale snapshot.
            unit_price: basePiecePrice(product).toFixed(2),
          })),
        }),
      });
      await removeLocalValue('sale-draft');
      setPreviewVisible(false);
      setSelectedCustomer(null);
      setIsWalkIn(false);
      setQuantities({});
      setSelectedProducts({});
      setCustomPrices({});
      setNote('');
      setAmountPaid('0');
      localizedAlert('Sale saved', 'Stock, transaction history and receipt were created successfully.');
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
  const accountBalanceAfter = Number(selectedCustomer?.current_balance || 0) + balance;
  const previousOutstanding = Number(selectedCustomer?.current_balance || 0);
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

      <SectionHeader title="1. Customer" subtitle={isWalkIn ? 'Walk-in sales must be paid in full' : 'Search by customer name or phone'} />
      <View style={styles.customerPicker}>
        {!isWalkIn ? (
          <SearchField
            value={customerQuery}
            onChangeText={value => { setCustomerQuery(value); setCustomerPage(1); }}
            placeholder="Search customers by name or phone"
            onSubmitEditing={() => loadCustomers(customerQuery, customerType, 1)}
          />
        ) : null}
        <View style={styles.walkInToggle}>
          <View style={styles.customerCopy}>
            <Text style={styles.customerName}>Walk-in sale</Text>
            <Text style={styles.small}>No customer account</Text>
          </View>
          <Switch
            accessibilityLabel={t('Walk-in sale')}
            accessibilityRole="switch"
            value={isWalkIn}
            onValueChange={enabled => {
              setIsWalkIn(enabled);
              if (enabled) {
                setSelectedCustomer(null);
                setCustomPrices({});
              }
            }}
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            thumbColor={colors.surface}
          />
        </View>
        {!isWalkIn ? (
          <>
            <View style={styles.customerTypeFilters}>
              <Choice selected={customerType === 'all'} label="All" icon="people-outline" onPress={() => { setCustomerType('all'); setCustomerPage(1); }} />
              <Choice selected={customerType === 'trader'} label="Trader" icon="person-outline" onPress={() => { setCustomerType('trader'); setCustomerPage(1); }} />
              <Choice selected={customerType === 'agent'} label="Agent" icon="people-outline" onPress={() => { setCustomerType('agent'); setCustomerPage(1); }} />
            </View>
            {partyLoading ? <Card><Loading /></Card> : parties.length ? (
              <View style={styles.customerResults}>
                {parties.map(party => (
                  <Pressable
                    key={party.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${party.name}, ${party.phone || party.party_type}`}
                    onPress={() => { setSelectedCustomer(party); setIsWalkIn(false); setCustomPrices({}); }}
                    style={({ pressed }) => [styles.customerResult, selectedCustomer?.id === party.id && styles.customerResultSelected, pressed && styles.pressed]}
                  >
                    <View style={styles.customerResultCopy}>
                      <Text style={styles.customerName}>{party.name}</Text>
                      <Text style={styles.small}>{party.phone || party.company || 'No phone number'}</Text>
                    </View>
                    <Badge label={party.party_type === 'agent' ? 'Agent' : 'Trader'} tone={party.party_type === 'agent' ? 'success' : 'neutral'} />
                  </Pressable>
                ))}
              </View>
            ) : <Message text={customerQuery ? 'No customers match this search.' : 'No traders or agents are available.'} />}
            {partyCount > CUSTOMER_PAGE_SIZE ? (
              <View style={styles.customerPagination}>
                <Pressable disabled={customerPage <= 1 || partyLoading} onPress={() => setCustomerPage(page => Math.max(1, page - 1))} style={({ pressed }) => [styles.pageButton, (customerPage <= 1 || partyLoading) && styles.pageDisabled, pressed && styles.pressed]}>
                  <Icon name="chevron-back" size={18} color={colors.primary} /><Text style={styles.pageButtonText}>Previous</Text>
                </Pressable>
                <View style={styles.pageStatus}><Text style={styles.pageNumber}>Page {customerPage} of {customerTotalPages}</Text><Text style={styles.pageCount}>{partyCount.toLocaleString()} customers</Text></View>
                <Pressable disabled={customerPage >= customerTotalPages || partyLoading} onPress={() => setCustomerPage(page => Math.min(customerTotalPages, page + 1))} style={({ pressed }) => [styles.pageButton, (customerPage >= customerTotalPages || partyLoading) && styles.pageDisabled, pressed && styles.pressed]}>
                  <Text style={styles.pageButtonText}>Next</Text><Icon name="chevron-forward" size={18} color={colors.primary} />
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
      {selectedCustomer ? (
        <Card style={styles.selectedCustomer}>
          <View style={styles.customerAvatar}><Text style={styles.customerInitials}>{initials(selectedCustomer.name)}</Text></View>
          <View style={styles.customerCopy}><Text style={styles.customerName}>{selectedCustomer.name}</Text><Text style={styles.small}>{selectedCustomer.party_type === 'agent' ? 'Agent pricing applies' : 'Trader'} · {selectedCustomer.phone}</Text></View>
          <Badge label={selectedCustomer.balance_label.toUpperCase()} tone={selectedCustomer.balance_color === 'red' ? 'danger' : selectedCustomer.balance_color === 'green' ? 'success' : 'neutral'} />
        </Card>
      ) : null}
      {isAgentSale ? <Message text="Agent selling prices are 1.875% below the editable price shown for each selected product." tone="success" /> : selectedCustomer ? <Message text="The standard price is prefilled. Edit any selected product's price for this sale only." /> : null}

      <SectionHeader title="2. Products" subtitle={`${selectedUnitCount} unit${selectedUnitCount === 1 ? '' : 's'} across ${selectedProductList.length} product${selectedProductList.length === 1 ? '' : 's'}`} />
      <SearchField
        value={productQuery}
        onChangeText={value => { setProductQuery(value); setProductPage(1); }}
        placeholder="Search product name or factory"
        onSubmitEditing={() => loadProducts(productQuery, 1)}
      />
      {productLoading ? <Card><Loading /></Card> : products.length ? products.map(product => {
        const selectedQuantity = quantities[String(product.id)] || 0;
        const selected = selectedQuantity > 0;
        const piecesPerUnit = Number(product.pieces_per_unit || 1);
        const overridden = customPrices[String(product.id)] !== undefined;
        return (
          <Card key={product.id} style={selected ? styles.selectedProduct : undefined}>
            <View style={styles.productRow}>
              <View style={[styles.productIcon, product.is_low_stock && styles.productIconLow]}><Icon name="cube-outline" size={23} color={product.is_low_stock ? colors.warning : colors.primary} /></View>
              <View style={styles.productInfo}>
                <View style={styles.productNameRow}><Text style={styles.productName}>{product.name}</Text>{product.is_low_stock ? <Badge label="LOW" tone="warning" /> : null}</View>
                <Text style={styles.factoryText}>Factory {product.factory_name}</Text>
                <Text style={styles.small}>{product.current_quantity} units available</Text>
                <View style={styles.packRow}>
                  <Text style={styles.packBadge}>×{piecesPerUnit} pcs / unit</Text>
                  <Text style={styles.small}><Money value={salePiecePrice(product)} size="small" /> selling price per piece</Text>
                </View>
                <Text style={styles.packTotal}>{packPrice(product).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB per unit</Text>
              </View>
            </View>
            <View style={styles.quantityRow}>
              <View>
                <Text style={styles.quantityTitle}>Sale quantity</Text>
                <Text style={styles.quantityHint}>Units / packs</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable disabled={!selected} accessibilityLabel={t(`Remove one unit of ${product.name}`)} style={[styles.stepButton, !selected && styles.stepButtonDisabled]} onPress={() => changeQuantity(product, -1)}><Icon name="remove" size={20} color={selected ? colors.primary : colors.muted} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t(`Enter units for ${product.name}`)} onPress={() => openQuantityEditor(product)} style={({ pressed }) => [styles.qtyBox, pressed && styles.pressed]}>
                  <View style={styles.qtyValueRow}><Text style={styles.qty}>{selectedQuantity}</Text><Icon name="create-outline" size={14} color={colors.primary} /></View>
                  <Text style={styles.qtyLabel}>Tap to enter</Text>
                </Pressable>
                <Pressable accessibilityLabel={t(`Add one unit of ${product.name}`)} style={[styles.stepButton, selected && styles.stepButtonSelected]} onPress={() => changeQuantity(product, 1)}><Icon name="add" size={20} color={selected ? colors.onPrimary : colors.primary} /></Pressable>
              </View>
            </View>
            {selected ? (
              <View style={styles.priceEditor}>
                <View style={styles.priceInputRow}>
                  <View style={styles.priceInput}><Input label="Actual Price / Piece" icon="pricetag-outline" value={overridden ? customPrices[String(product.id)] : Number(product.selling_price).toFixed(2)} onChangeText={value => setCustomPrices(current => ({ ...current, [String(product.id)]: value }))} keyboardType="decimal-pad" /></View>
                  {overridden ? <Button title="Reset" compact variant="ghost" onPress={() => setCustomPrices(current => { const next = { ...current }; delete next[String(product.id)]; return next; })} /> : null}
                </View>
                <View style={styles.priceResult}>
                  <Text style={styles.small}>Selling price / piece</Text>
                  <Money value={salePiecePrice(product)} size="small" color={colors.success} />
                </View>
              </View>
            ) : null}
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
        <Input label="Amount Paid" icon="wallet-outline" value={amountPaid} onChangeText={setAmountPaid} keyboardType="decimal-pad" editable={!isWalkIn} hint={isWalkIn ? 'Walk-in sales are automatically paid in full.' : undefined} />
        {selectedCustomer ? (
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
        piecePrice={salePiecePrice}
        total={total}
        amountPaid={Number(amountPaid || 0)}
        accountBalanceAfter={accountBalanceAfter}
        previousOutstanding={previousOutstanding}
        isWalkIn={isWalkIn}
        note={note}
        busy={busy}
        onClose={() => setPreviewVisible(false)}
        onConfirm={submit}
      />
      <QuantityEditorModal
        product={quantityEditor}
        value={quantityDraft}
        error={quantityError}
        onChange={updateQuantityDraft}
        onCancel={() => { setQuantityError(''); setQuantityEditor(null); }}
        onApply={applyQuantity}
      />
    </Screen>
  );
}

function QuantityEditorModal({ product, value, error, onChange, onCancel, onApply }: {
  product: Product | null;
  value: string;
  error: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return (
    <Modal visible={Boolean(product)} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.quantityModalBackdrop}>
        <View style={[styles.quantityModal, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.quantityModalHeader}>
            <View style={styles.customerCopy}>
              <Text style={styles.quantityModalEyebrow}>ENTER UNITS / BAGS</Text>
              <Text style={styles.quantityModalTitle}>{product?.name}</Text>
              <Text style={styles.quantityModalMeta}>Factory {product?.factory_name} · maximum {Number(product?.current_quantity || 0).toLocaleString()} units</Text>
            </View>
            <Pressable accessibilityLabel={t('Close unit entry')} onPress={onCancel} style={styles.closeButton}><Icon name="close" size={22} color={colors.text} /></Pressable>
          </View>
          {error ? <Message text={error} tone="error" /> : null}
          <Input label="Number of Units / Bags" icon="keypad-outline" value={value} onChangeText={onChange} keyboardType="decimal-pad" autoFocus selectTextOnFocus placeholder="0" hint="Enter zero to remove this product from the sale." />
          <View style={styles.quantityModalActions}>
            <View style={styles.invoiceFooterButton}><Button title="Cancel" variant="ghost" onPress={onCancel} /></View>
            <View style={styles.invoiceFooterButton}><Button title="Set Units" icon="checkmark-circle-outline" onPress={onApply} disabled={Boolean(error) || !value.trim()} /></View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InvoicePreview({ visible, storeName, currency, customer, products, quantities, piecePrice, total, amountPaid, accountBalanceAfter, previousOutstanding, isWalkIn, note, busy, onClose, onConfirm }: {
  visible: boolean;
  storeName: string;
  currency: string;
  customer: Party | null;
  products: Product[];
  quantities: Record<string, number>;
  piecePrice: (product: Product) => number;
  total: number;
  amountPaid: number;
  accountBalanceAfter: number;
  previousOutstanding: number;
  isWalkIn: boolean;
  note: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const thisSaleOutstanding = total - amountPaid;
  const totalOutstanding = customer ? accountBalanceAfter : isWalkIn ? 0 : thisSaleOutstanding;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.invoiceSheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.invoiceHeader}>
            <View><Text style={styles.invoiceEyebrow}>INVOICE PREVIEW</Text><Text style={styles.invoiceStore}>{storeName}</Text><Text style={styles.invoiceMeta}>{customer?.name || (isWalkIn ? 'Walk-in customer' : 'No customer selected')} · {new Date().toLocaleString()}</Text></View>
            <Pressable accessibilityLabel={t('Close invoice preview')} onPress={onClose} style={styles.closeButton}><Icon name="close" size={22} color={colors.text} /></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.invoiceContent}>
            <Message text="This is a preview. Stock and balances change only after you confirm the sale." />
            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
              <View style={styles.invoiceTable}>
                <View style={styles.invoiceTableHeader}>
                  <Text style={[styles.invoiceTableHeading, styles.invoiceItemCell]}>Item</Text>
                  <Text style={[styles.invoiceTableHeading, styles.invoicePriceCell]}>Per piece price</Text>
                  <Text style={[styles.invoiceTableHeading, styles.invoicePiecesCell]}>Pieces per unit</Text>
                  <Text style={[styles.invoiceTableHeading, styles.invoiceUnitsCell]}>Units bought</Text>
                  <Text style={[styles.invoiceTableHeading, styles.invoiceTotalCell]}>Total price</Text>
                </View>
                {products.map(product => {
                  const units = quantities[String(product.id)] || 0;
                  const pieces = Number(product.pieces_per_unit || 1);
                  const lineTotal = units * pieces * piecePrice(product);
                  return (
                    <View key={product.id} style={styles.invoiceTableRow}>
                      <View style={[styles.invoiceTableItem, styles.invoiceItemCell]}>
                        <Text style={styles.invoiceProduct}>{product.name}</Text>
                        <Text style={styles.invoiceFactory}>Factory {product.factory_name}</Text>
                      </View>
                      <Text style={[styles.invoiceTableValue, styles.invoicePriceCell]}>{piecePrice(product).toFixed(2)} {currency}</Text>
                      <Text style={[styles.invoiceTableValue, styles.invoicePiecesCell]}>{pieces.toLocaleString()}</Text>
                      <Text style={[styles.invoiceTableValue, styles.invoiceUnitsCell]}>{units.toLocaleString()}</Text>
                      <Text style={[styles.invoiceTableValue, styles.invoiceTotalCell]}>{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.invoiceSummary}>
              <SummaryRow label="Invoice total" value={total} currency={currency} strong />
              <SummaryRow label="Amount paid" value={amountPaid} currency={currency} />
              <SummaryRow label="This sale outstanding" value={Math.abs(thisSaleOutstanding)} currency={currency} tone={thisSaleOutstanding > 0 ? 'danger' : thisSaleOutstanding < 0 ? 'success' : 'normal'} />
              <SummaryRow label="Previous outstanding" value={previousOutstanding} currency={currency} tone={previousOutstanding > 0 ? 'danger' : previousOutstanding < 0 ? 'success' : 'normal'} />
              <SummaryRow label={totalOutstanding < 0 ? 'Total customer credit' : 'Total outstanding'} value={Math.abs(totalOutstanding)} currency={currency} strong tone={totalOutstanding > 0 ? 'danger' : totalOutstanding < 0 ? 'success' : 'normal'} />
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
  customerPicker: { gap: spacing.sm },
  walkInToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  customerTypeFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  customerResults: { gap: spacing.xs },
  customerResult: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  customerResultSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  customerResultCopy: { flex: 1, minWidth: 0 },
  customerPagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
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
  factoryText: { color: colors.primary, fontSize: 10, fontWeight: '900', marginTop: 2 },
  selectedProduct: { borderColor: colors.primaryBorder, backgroundColor: colors.successSoft },
  packRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  packBadge: { color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '900' },
  packTotal: { color: colors.text, fontSize: 11, fontWeight: '900', marginTop: 2 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 17, marginVertical: 2 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.mdSm, paddingTop: spacing.mdSm, borderTopWidth: 1, borderTopColor: colors.border },
  quantityTitle: { color: colors.text, fontSize: 12, fontWeight: '900' },
  quantityHint: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stepButton: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  stepButtonDisabled: { opacity: 0.45 },
  stepButtonSelected: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  qtyBox: { minWidth: 68, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primaryBorder, paddingHorizontal: 7 },
  qtyValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qty: { color: colors.text, fontWeight: '900', fontSize: 16 },
  qtyLabel: { color: colors.primary, fontSize: 8, fontWeight: '900' },
  priceEditor: { gap: spacing.sm, marginTop: spacing.mdSm, paddingTop: spacing.mdSm, borderTopWidth: 1, borderTopColor: colors.primaryBorder },
  priceInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  priceInput: { flex: 1 },
  priceResult: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.sm, backgroundColor: colors.successSoft, paddingHorizontal: spacing.mdSm, paddingVertical: spacing.sm },
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
  invoiceTable: { width: 650, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  invoiceTableHeader: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: colors.primarySoft, borderBottomWidth: 1, borderBottomColor: colors.border },
  invoiceTableHeading: { color: colors.primary, fontSize: 10, lineHeight: 14, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center', paddingHorizontal: 5, paddingVertical: spacing.sm },
  invoiceTableRow: { flexDirection: 'row', alignItems: 'stretch', minHeight: 58, borderBottomWidth: 1, borderBottomColor: colors.border },
  invoiceTableItem: { justifyContent: 'center', paddingVertical: spacing.sm },
  invoiceItemCell: { width: 184, paddingHorizontal: spacing.sm },
  invoicePriceCell: { width: 112 },
  invoicePiecesCell: { width: 112 },
  invoiceUnitsCell: { width: 104 },
  invoiceTotalCell: { width: 138 },
  invoiceProduct: { color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: '900' },
  invoiceFactory: { color: colors.primary, fontSize: 9, fontWeight: '800', marginTop: 3 },
  invoiceTableValue: { color: colors.text, fontSize: 11, lineHeight: 15, fontWeight: '800', textAlign: 'center', textAlignVertical: 'center', paddingHorizontal: 5, paddingVertical: spacing.sm },
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
  quantityModalBackdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.md, backgroundColor: 'rgba(20, 35, 30, 0.55)' },
  quantityModal: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: spacing.md, borderRadius: radius.lg, backgroundColor: colors.background, padding: spacing.md, ...shadow.card },
  quantityModalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingBottom: spacing.mdSm, borderBottomWidth: 1, borderBottomColor: colors.border },
  quantityModalEyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  quantityModalTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 4 },
  quantityModalMeta: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  quantityModalActions: { flexDirection: 'row', gap: spacing.sm },
});
