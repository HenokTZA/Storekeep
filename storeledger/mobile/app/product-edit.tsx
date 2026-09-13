import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { localizedAlert, Text } from '@/i18n';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Icon, Input, Loading, Message, Money, Screen, SectionHeader, Title } from '@/components/ui';
import { FactoryDropdown } from '@/components/FactoryDropdown';
import { apiFetch, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Paginated, Party, Product } from '@/types';

export default function ProductEditScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const [data, setData] = useState<Product | null>(null);
  const [factories, setFactories] = useState<Party[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [product, factoryResult] = await Promise.all([
        apiFetch<Product>(`/products/${productId}/`),
        apiFetch<Paginated<Party>>('/parties/?party_type=factory&page_size=200'),
      ]);
      setData(product);
      setFactories(factoryResult.results);
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  }, [productId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!data) return <Screen scroll={false}><Loading /></Screen>;
  const update = <K extends keyof Product>(key: K, value: Product[K]) => setData(current => current ? { ...current, [key]: value } : current);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/products/${productId}/`, { method: 'PATCH', body: JSON.stringify({ name: data.name, factory: data.factory, unit: data.unit, pieces_per_unit: data.pieces_per_unit, purchase_price: data.purchase_price, selling_price: data.selling_price, minimum_stock_threshold: data.minimum_stock_threshold, notes: data.notes }) });
      router.back();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  const archive = () => localizedAlert('Archive product?', 'Historical sales and stock movements will remain available.', [{ text: 'Cancel' }, { text: 'Archive', style: 'destructive', onPress: async () => { try { await apiFetch(`/products/${productId}/`, { method: 'DELETE' }); router.back(); } catch (nextError) { setError(errorMessage(nextError)); } } }]);
  return (
    <Screen>
      <Title eyebrow="Inventory" subtitle="Update product details without changing recorded history">Edit Product</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <Card style={styles.identityCard}>
        <View style={styles.productIcon}><Icon name="cube-outline" size={25} color={colors.primary} /></View>
        <View style={styles.flex}><Text style={styles.name}>{data.name}</Text><Text style={styles.meta}>Factory {data.factory_name} · {data.unit}</Text><Badge label={data.is_low_stock ? 'LOW STOCK' : 'IN STOCK'} tone={data.is_low_stock ? 'warning' : 'success'} /></View>
        <View style={styles.stock}><Text style={styles.stockLabel}>CURRENT</Text><Text style={styles.stockValue}>{data.current_quantity}</Text><Text style={styles.stockUnit}>{data.unit}</Text></View>
      </Card>

      <Card style={styles.formCard}>
        <SectionHeader title="Product details" />
        <FactoryDropdown factories={factories} value={data.factory} onChange={value => update('factory', value)} />
        <Input label="Product Name / Shoe ID" icon="cube-outline" value={data.name} onChangeText={value => update('name', value)} />
        <Input label="Stock Unit / Pack Name" icon="layers-outline" value={data.unit} onChangeText={value => update('unit', value)} />
        <Input label="Pieces in One Unit" icon="apps-outline" value={String(data.pieces_per_unit)} onChangeText={value => update('pieces_per_unit', Number(value || 0))} keyboardType="number-pad" hint="This changes future sales only; completed invoices keep their original pack size." />
      </Card>

      <Card style={styles.formCard}>
        <SectionHeader title="Pricing & alerts" />
        <View style={styles.row}>
          <View style={styles.flex}><Input label="Purchase / Piece" icon="arrow-down-outline" value={data.purchase_price} onChangeText={value => update('purchase_price', value)} keyboardType="decimal-pad" /></View>
          <View style={styles.flex}><Input label="Selling / Piece" icon="arrow-up-outline" value={data.selling_price} onChangeText={value => update('selling_price', value)} keyboardType="decimal-pad" /></View>
        </View>
        <View style={styles.agentPrice}><Text style={styles.agentLabel}>Default agent price (−1.5%)</Text><Money value={Number(data.selling_price || 0) * 0.985} color={colors.success} size="small" /></View>
        <Input label="Low-stock Threshold" icon="warning-outline" value={data.minimum_stock_threshold} onChangeText={value => update('minimum_stock_threshold', value)} keyboardType="decimal-pad" />
        <Input label="Notes" icon="document-text-outline" value={data.notes} onChangeText={value => update('notes', value)} multiline />
      </Card>

      <Button title={busy ? 'Saving…' : 'Save Changes'} icon="checkmark-circle-outline" onPress={save} disabled={busy || data.pieces_per_unit < 1 || !Number.isInteger(data.pieces_per_unit)} />
      <View style={styles.dangerZone}><View style={styles.dangerCopy}><Text style={styles.dangerTitle}>Archive this product</Text><Text style={styles.dangerText}>Historical sales and movements remain available.</Text></View><Button title="Archive" icon="archive-outline" compact variant="danger" onPress={archive} /></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  productIcon: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 17, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: 5 },
  stock: { alignItems: 'flex-end' },
  stockLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  stockValue: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  stockUnit: { color: colors.muted, fontSize: 10 },
  formCard: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  agentPrice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.successSoft, borderRadius: radius.md, padding: spacing.mdSm },
  agentLabel: { color: colors.success, fontSize: 12, fontWeight: '900' },
  dangerZone: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: radius.lg, padding: spacing.md },
  dangerCopy: { flex: 1 },
  dangerTitle: { color: colors.danger, fontSize: 14, fontWeight: '900' },
  dangerText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
});
