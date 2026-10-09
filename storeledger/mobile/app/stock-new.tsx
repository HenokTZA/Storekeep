import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button, Card, Input, Loading, Message, Screen, SectionHeader, Title } from '@/components/ui';
import { FactoryDropdown } from '@/components/FactoryDropdown';
import { apiFetch, errorMessage } from '@/lib/api';
import { spacing } from '@/theme';
import type { Paginated, Party } from '@/types';

export default function NewProductScreen() {
  const [name, setName] = useState('');
  const [factories, setFactories] = useState<Party[]>([]);
  const [factoryId, setFactoryId] = useState<number | null>(null);
  const [unit, setUnit] = useState('unit');
  const [piecesPerUnit, setPiecesPerUnit] = useState('1');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [threshold, setThreshold] = useState('5');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadFactories = useCallback(async () => {
    try {
      const result = await apiFetch<Paginated<Party>>('/parties/?party_type=factory&page_size=200');
      setFactories(result.results);
      setFactoryId(current => current || result.results[0]?.id || null);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { loadFactories(); }, [loadFactories]));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/products/', { method: 'POST', body: JSON.stringify({ name, factory: factoryId, unit, pieces_per_unit: Number(piecesPerUnit), purchase_price: purchasePrice || '0', selling_price: sellingPrice, initial_quantity: quantity || '0', minimum_stock_threshold: threshold || '5', notes }) });
      router.back();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <Screen scroll={false}><Loading /></Screen>;
  return (
    <Screen>
      <Title eyebrow="Inventory" subtitle="Add the product once, then manage stock through recorded movements">Add Product</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <Card style={styles.formCard}>
        <SectionHeader title="Product details" subtitle="Factory, shoe ID/name and distributor pack" />
        {factories.length ? <FactoryDropdown factories={factories} value={factoryId} onChange={setFactoryId} /> : (
          <View style={styles.emptyFactory}>
            <Message text="Add a factory before adding stock. Products are tracked separately for each factory." tone="warning" />
            <Button title="Add Factory" icon="business-outline" variant="secondary" onPress={() => router.push({ pathname: '/customer-new', params: { type: 'factory' } })} />
          </View>
        )}
        <Input label="Product Name / Shoe ID" icon="cube-outline" value={name} onChangeText={setName} placeholder="e.g. Shoe 356" />
        <Input label="Stock Unit / Pack Name" icon="layers-outline" value={unit} onChangeText={setUnit} placeholder="carton, pack, case…" />
        <Input label="Pieces in One Unit" icon="apps-outline" value={piecesPerUnit} onChangeText={setPiecesPerUnit} keyboardType="number-pad" hint="Example: enter 54 when one carton contains 54 individual pieces." />
      </Card>

      <Card style={styles.formCard}>
        <SectionHeader title="Pricing" subtitle="Enter prices for one individual piece" />
        <View style={styles.row}>
          <View style={styles.flex}><Input label="Purchase / Piece" icon="arrow-down-outline" value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="decimal-pad" /></View>
          <View style={styles.flex}><Input label="Selling / Piece" icon="arrow-up-outline" value={sellingPrice} onChangeText={setSellingPrice} keyboardType="decimal-pad" /></View>
        </View>
        <Message text="Agent sales are 1.875% below the entered price; you can edit the base price for one sale." tone="success" />
      </Card>

      <Card style={styles.formCard}>
        <SectionHeader title="Opening inventory" subtitle="Set the starting balance and alert threshold" />
        <View style={styles.row}>
          <View style={styles.flex}><Input label="Opening Units" icon="add-circle-outline" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" /></View>
          <View style={styles.flex}><Input label="Low-stock Units" icon="warning-outline" value={threshold} onChangeText={setThreshold} keyboardType="decimal-pad" /></View>
        </View>
        <Input label="Notes (optional)" icon="document-text-outline" value={notes} onChangeText={setNotes} multiline />
      </Card>
      <Button title={busy ? 'Saving…' : 'Save Product'} icon="checkmark-circle-outline" onPress={save} disabled={busy || !factoryId || !name.trim() || !sellingPrice || Number(piecesPerUnit) < 1 || !Number.isInteger(Number(piecesPerUnit))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  formCard: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  emptyFactory: { gap: spacing.sm },
});
