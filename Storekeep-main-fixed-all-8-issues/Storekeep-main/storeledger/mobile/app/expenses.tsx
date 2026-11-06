import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { localizedAlert, Text, useI18n } from '@/i18n';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { BarChart } from '@/components/BarChart';
import { Badge, Button, Card, Icon, Input, Loading, Message, Money, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, cachedGet, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Expense, ExpenseSummary, Paginated } from '@/types';

export default function ExpensesScreen() {
  const { t } = useI18n();
  const { store, role } = useAuth();
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [items, setItems] = useState<Expense[]>([]);
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const canManage = role === 'owner' || role === 'manager';

  const load = useCallback(async () => {
    try {
      setError('');
      const [summaryResult, listResult] = await Promise.all([
        cachedGet<ExpenseSummary>('/expenses/summary/'),
        cachedGet<Paginated<Expense>>('/expenses/?is_reversed=false&page_size=100'),
      ]);
      setSummary(summaryResult.data);
      setItems(listResult.data.results);
      setBudget(summaryResult.data.current_month.budget);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveBudget = async () => {
    if (!summary) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch('/budgets/', { method: 'POST', body: JSON.stringify({ year: summary.current_month.year, month: summary.current_month.month, amount: budget || '0' }) });
      setSuccess('Monthly expense budget saved.');
      await load();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  const reverseExpense = (expense: Expense) => localizedAlert('Reverse expense?', 'The record stays in the audit history and is excluded from totals.', [{ text: 'Cancel' }, { text: 'Reverse', style: 'destructive', onPress: async () => { try { await apiFetch(`/expenses/${expense.id}/reverse/`, { method: 'POST', body: JSON.stringify({ reason: 'Reversed from mobile app' }) }); await load(); } catch (nextError) { setError(errorMessage(nextError)); } } }]);

  if (loading && !summary) return <Screen scroll={false}><Loading /></Screen>;
  const budgetPercentage = Math.min(Number(summary?.current_month.percentage || 0), 100);
  return (
    <Screen>
      <Title eyebrow="Operating costs" subtitle="Track expenses and cash paid to factories or people">Expenses</Title>
      {error ? <Message text={error} tone="error" /> : null}
      {success ? <Message text={success} tone="success" /> : null}

      <View style={styles.actions}>
        <View style={styles.action}><Button title="Add Expense" icon="add" onPress={() => router.push('/expense-new')} /></View>
        <View style={styles.action}><Button title="Analytics" icon="bar-chart-outline" variant="secondary" onPress={() => router.push('/expense-reports')} /></View>
      </View>

      <View style={styles.grid}>
        <Metric icon="calendar-outline" label="Month Cash Out" value={summary?.current_month.spent || 0} currency={store?.currency} tone="danger" />
        <Metric icon="wallet-outline" label="Budget Remaining" value={summary?.current_month.remaining || 0} currency={store?.currency} tone={Number(summary?.current_month.remaining || 0) < 0 ? 'danger' : 'success'} />
        <Metric icon="receipt-outline" label="Entries" count={summary?.count || 0} tone="primary" wide />
      </View>

      <Card style={styles.budgetCard}>
        <SectionHeader title="Monthly Budget" subtitle={`${summary?.current_month.percentage || '0'}% used`} />
        <View style={styles.progress}><View style={[styles.progressBar, { width: `${budgetPercentage}%`, backgroundColor: Number(summary?.current_month.percentage || 0) > 100 ? colors.dangerButton : colors.primaryButton }]} /></View>
        <View style={styles.budgetMeta}><Text style={styles.small}>{Number(summary?.current_month.spent || 0).toLocaleString()} {store?.currency} spent</Text><Text style={styles.budgetRemaining}>{Number(summary?.current_month.remaining || 0).toLocaleString()} {store?.currency} remaining</Text></View>
        {canManage ? <View style={styles.budgetForm}><View style={styles.flex}><Input label={`Budget (${store?.currency || 'ETB'})`} icon="cash-outline" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" /></View><View style={styles.saveBudget}><Button title={busy ? 'Saving…' : 'Save'} compact variant="secondary" onPress={saveBudget} disabled={busy || Number(budget) < 0} /></View></View> : null}
      </Card>

      <Card style={styles.chartCard}>
        <SectionHeader title="Spending by Category" subtitle="This reporting period" />
        <BarChart data={(summary?.by_category || []).map(item => ({ label: item.category_name, value: Number(item.amount), color: item.color }))} valueLabel={value => value.toLocaleString()} />
      </Card>

      <SectionHeader title="Recent Expenses" subtitle={`${items.length} active entr${items.length === 1 ? 'y' : 'ies'}`} />
      {items.length ? (
        <Card style={styles.listCard}>
          {items.map((item, index) => (
            <View key={item.id} style={[styles.expenseRow, index > 0 && styles.borderTop]}>
              <View style={styles.expenseIcon}><Icon name={categoryIcon(item.category_name)} size={20} color={colors.danger} /></View>
              <View style={styles.flex}>
                <Text style={styles.name}>{item.description}</Text>
                <View style={styles.metaRow}><Badge label={item.category_name.toUpperCase()} tone="danger" /><Text style={styles.small}>{item.expense_date} · {item.payment_method}</Text></View>
                {item.reference ? <Text style={styles.reference}>Ref: {item.reference}</Text> : null}
              </View>
              <View style={styles.amountColumn}><Money value={item.amount} currency={store?.currency} color={colors.danger} size="small" />{canManage ? <Pressable accessibilityLabel={t('Reverse expense')} onPress={() => reverseExpense(item)} style={styles.reverseButton}><Icon name="arrow-undo-outline" size={16} color={colors.danger} /><Text style={styles.reverse}>Reverse</Text></Pressable> : null}</View>
            </View>
          ))}
        </Card>
      ) : <Message text="No expenses recorded for this store." />}
    </Screen>
  );
}

function Metric({ icon, label, value, count, currency, tone, wide = false }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; value?: string | number; count?: number; currency?: string; tone: 'primary' | 'danger' | 'success'; wide?: boolean }) {
  const color = tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.primary;
  const background = tone === 'danger' ? colors.dangerSoft : tone === 'success' ? colors.successSoft : colors.primarySoft;
  return <Card style={[styles.metric, wide && styles.metricWide]}><View style={[styles.metricIcon, { backgroundColor: background }]}><Icon name={icon} size={20} color={color} /></View><Text style={styles.metricLabel}>{label}</Text>{count !== undefined ? <Text style={[styles.count, { color }]}>{count}</Text> : <Money value={value || 0} currency={currency} color={color} size="small" />}</Card>;
}

function categoryIcon(name: string): React.ComponentProps<typeof Icon>['name'] {
  const value = name.toLowerCase();
  if (value.includes('transport')) return 'car-outline';
  if (value.includes('rent')) return 'home-outline';
  if (value.includes('util')) return 'flash-outline';
  if (value.includes('suppl')) return 'cube-outline';
  return 'receipt-outline';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.mdSm },
  metric: { width: '48%', minHeight: 128, gap: spacing.sm, justifyContent: 'space-between', padding: spacing.mdSm },
  metricWide: { width: '100%', minHeight: 100 },
  metricIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  count: { fontSize: 26, fontWeight: '900' },
  budgetCard: { gap: spacing.md },
  progress: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: radius.pill },
  budgetMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  small: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  budgetRemaining: { color: colors.success, fontSize: 11, fontWeight: '900' },
  budgetForm: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  saveBudget: { width: 92, paddingBottom: 2 },
  chartCard: { gap: spacing.md },
  listCard: { paddingVertical: 0 },
  expenseRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, paddingVertical: spacing.md },
  borderTop: { borderTopWidth: 1, borderTopColor: colors.border },
  expenseIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 14, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: 5 },
  reference: { color: colors.muted, fontSize: 10, marginTop: 4 },
  amountColumn: { alignItems: 'flex-end', gap: spacing.sm },
  reverseButton: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  reverse: { color: colors.danger, fontSize: 10, fontWeight: '900' },
});
