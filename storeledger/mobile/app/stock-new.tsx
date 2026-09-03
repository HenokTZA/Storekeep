import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Input, Message, Screen, SectionHeader, Title } from '@/components/ui';
import { CategoryPicker } from '@/components/CategoryPicker';
import { apiFetch, errorMessage } from '@/lib/api';
import { spacing } from '@/theme';

export default function NewProductScreen() {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('unit');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [threshold, setThreshold] = useState('5');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/products/', { method: 'POST', body: JSON.stringify({ name, sku, category, unit, purchase_price: purchasePrice || '0', selling_price: sellingPrice, initial_quantity: quantity || '0', minimum_stock_threshold: threshold || '5', supplier, notes }) });
      router.back();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Title eyebrow="Inventory" subtitle="Add the product once, then manage stock through recorded movements">Add Product</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <Card style={styles.formCard}>
        <SectionHeader title="Product details" subtitle="Name, code and selling unit" />
        <Input label="Product Name" icon="cube-outline" value={name} onChangeText={setName} placeholder="e.g. Coffee 250g" />
        <Input label="SKU / Product Code" icon="barcode-outline" value={sku} onChangeText={setSku} autoCapitalize="characters" placeholder="e.g. CF250" />
        <CategoryPicker value={category} onChange={setCategory} />
        <Input label="Unit" icon="layers-outline" value={unit} onChangeText={setUnit} placeholder="unit, pack, kg…" />
      </Card>

      <Card style={styles.formCard}>
        <SectionHeader title="Pricing" subtitle="Standard values used for sales and purchases" />
        <View style={styles.row}>
          <View style={styles.flex}><Input label="Purchase Price" icon="arrow-down-outline" value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="decimal-pad" /></View>
          <View style={styles.flex}><Input label="Selling Price" icon="arrow-up-outline" value={sellingPrice} onChangeText={setSellingPrice} keyboardType="decimal-pad" /></View>
        </View>
        <Message text="Agent sales automatically use 1.5% below the selling price." tone="success" />
      </Card>

      <Card style={styles.formCard}>
        <SectionHeader title="Opening inventory" subtitle="Set the starting balance and alert threshold" />
        <View style={styles.row}>
          <View style={styles.flex}><Input label="Opening Quantity" icon="add-circle-outline" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" /></View>
          <View style={styles.flex}><Input label="Low-stock Threshold" icon="warning-outline" value={threshold} onChangeText={setThreshold} keyboardType="decimal-pad" /></View>
        </View>
        <Input label="Supplier (optional)" icon="business-outline" value={supplier} onChangeText={setSupplier} />
        <Input label="Notes (optional)" icon="document-text-outline" value={notes} onChangeText={setNotes} multiline />
      </Card>
      <Button title={busy ? 'Saving…' : 'Save Product'} icon="checkmark-circle-outline" onPress={save} disabled={busy || !name || !sku || !sellingPrice} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  formCard: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
