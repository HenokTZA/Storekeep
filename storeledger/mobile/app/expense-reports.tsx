import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart } from '@/components/BarChart';
import { Button, Card, Icon, Input, Loading, Message, Money, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius, spacing } from '@/theme';
import type { ExpenseSummary } from '@/types';

const localDate = (date = new Date()) => { const value = new Date(date); value.setMinutes(value.getMinutes() - value.getTimezoneOffset()); return value.toISOString().slice(0, 10); };

export default function ExpenseReportsScreen() {
  const { store } = useAuth();
  const end = localDate();
  const initial = new Date();
  initial.setDate(initial.getDate() - 29);
  const [start, setStart] = useState(localDate(initial));
  const [periodEnd, setPeriodEnd] = useState(end);
  const [data, setData] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await apiFetch<ExpenseSummary>(`/expenses/summary/?start=${start}&end=${periodEnd}`));
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [start, periodEnd]);
  React.useEffect(() => { load(); }, []);
  return (
    <Screen>
      <Title eyebrow="Expense reporting" subtitle="Category and daily spending trends">Expense Analytics</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <Card style={styles.filterCard}>
        <SectionHeader title="Reporting period" />
        <View style={styles.dates}><View style={styles.flex}><Input label="Start" icon="calendar-outline" value={start} onChangeText={setStart} /></View><View style={styles.flex}><Input label="End" icon="calendar-outline" value={periodEnd} onChangeText={setPeriodEnd} /></View></View>
        <Button title="Apply Period" icon="filter-outline" variant="secondary" onPress={load} />
      </Card>
      {loading ? <Loading /> : data ? (
        <>
          <Card style={styles.totalCard}>
            <View style={styles.totalIcon}><Icon name="receipt-outline" size={24} color={colors.danger} /></View>
            <View style={styles.flex}><Text style={styles.metricLabel}>TOTAL EXPENSES</Text><Money value={data.total} currency={store?.currency} color={colors.danger} size="large" /></View>
            <View style={styles.entryCount}><Text style={styles.count}>{data.count}</Text><Text style={styles.countLabel}>ENTRIES</Text></View>
          </Card>
          <Card style={styles.chartCard}><SectionHeader title="By Category" subtitle="Compare where the money went" /><BarChart data={data.by_category.map(item => ({ label: item.category_name, value: Number(item.amount), color: item.color }))} /></Card>
          <Card style={styles.chartCard}><SectionHeader title="Daily Trend" subtitle="Up to the last 31 days" /><BarChart data={data.daily.slice(-31).map(item => ({ label: item.date.slice(5), value: Number(item.amount), color: colors.danger }))} /></Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filterCard: { gap: spacing.md },
  dates: { flexDirection: 'row', gap: spacing.sm },
  totalCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  totalIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginBottom: 3 },
  entryCount: { alignItems: 'flex-end' },
  count: { color: colors.text, fontSize: 24, fontWeight: '900' },
  countLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  chartCard: { gap: spacing.md },
});
