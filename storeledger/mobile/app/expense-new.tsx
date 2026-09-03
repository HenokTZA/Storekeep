import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button, Card, Icon, Input, Loading, Message, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { ExpenseCategory, Paginated } from '@/types';

const localDate = () => { const value = new Date(); value.setMinutes(value.getMinutes() - value.getTimezoneOffset()); return value.toISOString().slice(0, 10); };
const METHODS = [
  { value: 'cash', label: 'Cash', icon: 'cash-outline' },
  { value: 'bank', label: 'Bank', icon: 'business-outline' },
  { value: 'mobile', label: 'Mobile', icon: 'phone-portrait-outline' },
  { value: 'credit', label: 'Credit', icon: 'card-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
] as const;

export default function ExpenseNewScreen() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [category, setCategory] = useState(0);
  const [newCategory, setNewCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(localDate());
  const [paymentMethod, setPaymentMethod] = useState<typeof METHODS[number]['value']>('cash');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const result = await apiFetch<Paginated<ExpenseCategory>>('/expense-categories/?page_size=100');
      setCategories(result.results);
      if (!category && result.results.length) setCategory(result.results[0].id);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [category]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const addCategory = async () => {
    if (!newCategory.trim()) return;
    setBusy(true);
    setError('');
    try {
      const created = await apiFetch<ExpenseCategory>('/expense-categories/', { method: 'POST', body: JSON.stringify({ name: newCategory.trim(), color: colors.primaryButton }) });
      setCategories(current => [...current, created]);
      setCategory(created.id);
      setNewCategory('');
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/expenses/', { method: 'POST', body: JSON.stringify({ category, amount, expense_date: expenseDate, payment_method: paymentMethod, description, reference, notes }) });
      Alert.alert('Expense recorded', 'The expense dashboard and reports are updated.');
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
      <Title eyebrow="Operating cost" subtitle="Posted expenses remain available in the audit history">New Expense</Title>
      {error ? <Message text={error} tone="error" /> : null}

      <Card style={styles.formCard}>
        <SectionHeader title="Category" subtitle="Choose the most useful reporting category" />
        <View style={styles.chips}>{categories.map(item => <Choice key={item.id} label={item.name} active={category === item.id} onPress={() => setCategory(item.id)} />)}</View>
        <View style={styles.addRow}><View style={styles.flex}><Input label="New Category" icon="pricetag-outline" value={newCategory} onChangeText={setNewCategory} placeholder="Category name" /></View><View style={styles.addButton}><Button title="Add" icon="add" compact variant="secondary" onPress={addCategory} disabled={busy || !newCategory.trim()} /></View></View>
      </Card>

      <Card style={styles.formCard}>
        <SectionHeader title="Expense details" />
        <Input label="Amount" icon="cash-outline" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
        <Input label="Expense Date (YYYY-MM-DD)" icon="calendar-outline" value={expenseDate} onChangeText={setExpenseDate} />
        <Input label="Description" icon="receipt-outline" value={description} onChangeText={setDescription} placeholder="What was this expense for?" />
      </Card>

      <Card style={styles.formCard}>
        <SectionHeader title="Payment" />
        <View style={styles.methodGrid}>{METHODS.map(method => <Method key={method.value} label={method.label} icon={method.icon} active={paymentMethod === method.value} onPress={() => setPaymentMethod(method.value)} />)}</View>
        <Input label="Reference (optional)" icon="barcode-outline" value={reference} onChangeText={setReference} placeholder="Receipt or invoice number" />
        <Input label="Notes (optional)" icon="document-text-outline" value={notes} onChangeText={setNotes} multiline placeholder="Additional details" />
      </Card>
      <Button title={busy ? 'Saving…' : 'Record Expense'} icon="checkmark-circle-outline" onPress={save} disabled={busy || !category || Number(amount) <= 0 || !description.trim()} />
      <Message text="Recording an expense does not change sales or customer balances." />
    </Screen>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.active]}><Text style={[styles.chipText, active && styles.activeText]}>{label}</Text></Pressable>;
}

function Method({ label, icon, active, onPress }: { label: string; icon: React.ComponentProps<typeof Icon>['name']; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.method, active && styles.methodActive]}><Icon name={icon} size={21} color={active ? colors.primary : colors.muted} /><Text style={[styles.methodText, active && styles.methodTextActive]}>{label}</Text>{active ? <View style={styles.check}><Icon name="checkmark" size={11} color={colors.onPrimary} /></View> : null}</Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  formCard: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 14 },
  active: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  chipText: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  activeText: { color: colors.onPrimary },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  addButton: { width: 96, paddingBottom: 2 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  method: { width: '31%', minHeight: 76, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 5 },
  methodActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  methodText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  methodTextActive: { color: colors.primary },
  check: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primaryButton, alignItems: 'center', justifyContent: 'center' },
});
