import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/i18n';
import { router, useFocusEffect } from 'expo-router';
import { Badge, Button, Card, Icon, Loading, Message, Money, Screen, SearchField, Title } from '@/components/ui';
import { cachedGet, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Paginated, Party, Product } from '@/types';

export default function StockScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [factories, setFactories] = useState<Party[]>([]);
  const [factoryId, setFactoryId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const path = `/products/?page_size=100${factoryId ? `&factory=${factoryId}` : ''}${query ? `&search=${encodeURIComponent(query)}` : ''}`;
      const [productResult, factoryResult] = await Promise.all([
        cachedGet<Paginated<Product>>(path),
        cachedGet<Paginated<Party>>('/parties/?party_type=factory&page_size=200'),
      ]);
      setProducts(productResult.data.results);
      setFactories(factoryResult.data.results);
      setOffline(productResult.offline || factoryResult.offline);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [factoryId, query]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <Screen safeTop>
      <Title
        eyebrow="Inventory"
        subtitle={`${products.length} active products`}
        action={<Button title="Add Product" icon="add" compact onPress={() => router.push('/stock-new')} />}
      >Stock</Title>
      {offline ? <Message text="You're offline. Showing saved stock data." tone="warning" /> : null}
      {error ? <Message text={error} tone="error" /> : null}
      <Text style={styles.filterLabel}>FILTER BY FACTORY</Text>
      <View style={styles.factoryFilters}>
        <FactoryFilter label="All" active={factoryId === null} onPress={() => { setLoading(true); setFactoryId(null); }} />
        {factories.map(factory => <FactoryFilter key={factory.id} label={factory.name} active={factoryId === factory.id} onPress={() => { setLoading(true); setFactoryId(factory.id); }} />)}
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search product name or factory" onSubmitEditing={load} />

      {loading ? <Loading /> : products.length ? products.map(product => (
        <Card key={product.id} style={product.is_low_stock ? styles.lowCard : undefined}>
          <View style={styles.productHeader}>
            <View style={[styles.productIcon, product.is_low_stock && styles.productIconLow]}><Icon name="cube-outline" size={23} color={product.is_low_stock ? colors.warning : colors.primary} /></View>
            <View style={styles.productCopy}>
              <Text style={styles.name}>{product.name}</Text>
              <View style={styles.factoryLine}><Icon name="business-outline" size={13} color={colors.primary} /><Text style={styles.factoryName}>{product.factory_name}</Text></View>
              <Text style={styles.meta}>{product.unit} × {product.pieces_per_unit} pcs per unit</Text>
            </View>
            {product.is_low_stock ? <Badge label="LOW STOCK" tone="warning" /> : <Badge label="IN STOCK" tone="success" />}
          </View>

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Available</Text>
              <Text style={[styles.quantity, product.is_low_stock && styles.quantityLow]}>{Number(product.current_quantity).toLocaleString()} {product.unit}</Text>
            </View>
            <View style={styles.metricRight}>
              <Text style={styles.metricLabel}>Price / piece</Text>
              <Money value={product.selling_price} size="small" />
              <Text style={styles.packPrice}>{Number(product.pack_selling_price).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB / {product.unit}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Action icon="add-circle-outline" label="Receive" onPress={() => router.push({ pathname: '/purchase-new', params: { factoryId: String(product.factory), productId: String(product.id) } })} />
            <Action icon="options-outline" label="Adjust" onPress={() => router.push({ pathname: '/stock-adjust', params: { productId: String(product.id), name: product.name, factoryName: product.factory_name, piecesPerUnit: String(product.pieces_per_unit), unit: product.unit, mode: 'adjust' } })} />
            <Action icon="time-outline" label="History" onPress={() => router.push({ pathname: '/stock-history', params: { productId: String(product.id), name: product.name } })} />
            <Action icon="create-outline" label="Edit" onPress={() => router.push({ pathname: '/product-edit', params: { productId: String(product.id) } })} />
          </View>
        </Card>
      )) : (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}><Icon name="cube-outline" size={32} color={colors.primary} /></View>
          <Text style={styles.emptyTitle}>No products found</Text>
          <Text style={styles.emptyText}>Add your first product or try a different search.</Text>
          <Button title="Add Product" icon="add" onPress={() => router.push('/stock-new')} />
        </Card>
      )}
    </Screen>
  );
}

function FactoryFilter({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.factoryFilter, active && styles.factoryFilterActive, pressed && styles.pressed]}><Text style={[styles.factoryFilterText, active && styles.factoryFilterTextActive]}>{label}</Text></Pressable>;
}

function Action({ icon, label, onPress }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <Icon name={icon} size={18} color={colors.primary} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lowCard: { borderColor: colors.warningBorder },
  productHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  productIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  productIconLow: { backgroundColor: colors.warningSoft },
  productCopy: { flex: 1 },
  name: { fontSize: 17, lineHeight: 22, fontWeight: '900', color: colors.text },
  filterLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  factoryFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  factoryFilter: { minHeight: 38, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  factoryFilterActive: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  factoryFilterText: { color: colors.textSoft, fontSize: 12, fontWeight: '900' },
  factoryFilterTextActive: { color: colors.onPrimary },
  factoryLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  factoryName: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginVertical: spacing.md, paddingVertical: spacing.mdSm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  metric: { flex: 1 },
  metricRight: { flex: 1, alignItems: 'flex-end' },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', marginBottom: 4 },
  packPrice: { color: colors.primary, fontSize: 10, fontWeight: '800', marginTop: 3 },
  quantity: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '900' },
  quantityLow: { color: colors.warning },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  action: { minHeight: 40, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  actionText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.65 },
  emptyCard: { minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
