import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { BarChart } from '@/components/BarChart';
import { Badge, Card, Icon, Loading, Message, Money, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { OverdueParty } from '@/types';

type Result = { threshold_days: number; count: number; results: OverdueParty[] };

export default function OverdueScreen() {
  const { store } = useAuth();
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Result>('/parties/overdue/'));
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (loading) return <Screen scroll={false}><Loading /></Screen>;
  const total = (data?.results || []).reduce((sum, item) => sum + Number(item.balance_amount), 0);
  return (
    <Screen>
      <Title eyebrow="Receivables" subtitle={`Balances open for at least ${data?.threshold_days || 0} days`}>Overdue Receivables</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryIcon}><Icon name="hourglass-outline" size={25} color={colors.danger} /></View>
        <View style={styles.flex}><Text style={styles.metricLabel}>TOTAL OVERDUE</Text><Money value={total} currency={store?.currency} color={colors.danger} size="large" /></View>
        <View style={styles.countBlock}><Text style={styles.count}>{data?.count || 0}</Text><Text style={styles.countLabel}>CUSTOMERS</Text></View>
      </Card>
      {data?.results.length ? (
        <>
          <Card style={styles.chartCard}><SectionHeader title="Top overdue balances" subtitle="Highest open receivables" /><BarChart data={data.results.slice(0, 10).map(item => ({ label: item.name, value: Number(item.balance_amount), color: colors.danger }))} /></Card>
          <SectionHeader title="Customers" subtitle="Sorted by overdue age" />
          <Card style={styles.listCard}>
            {data.results.map((item, index) => (
              <Pressable key={item.id} onPress={() => router.push({ pathname: '/customer-detail', params: { partyId: String(item.id) } })} style={({ pressed }) => [styles.row, index > 0 && styles.borderTop, pressed && styles.pressed]}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials(item.name)}</Text></View>
                <View style={styles.flex}><Text style={styles.name}>{item.name}</Text><Text style={styles.small}>{item.days_overdue} days overdue · since {item.overdue_since}</Text><Badge label={item.party_type.toUpperCase()} tone="neutral" /></View>
                <View style={styles.amount}><Money value={item.balance_amount} currency={store?.currency} color={colors.danger} size="small" /><Icon name="chevron-forward" size={18} color={colors.muted} /></View>
              </Pressable>
            ))}
          </Card>
        </>
      ) : <Message text="No balances have passed the configured overdue threshold." tone="success" />}
    </Screen>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryIcon: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginBottom: 3 },
  countBlock: { alignItems: 'flex-end' },
  count: { color: colors.text, fontSize: 24, fontWeight: '900' },
  countLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  chartCard: { gap: spacing.md },
  listCard: { paddingVertical: 0 },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, paddingVertical: spacing.mdSm },
  borderTop: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.65 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.danger, fontSize: 13, fontWeight: '900' },
  name: { color: colors.text, fontSize: 14, fontWeight: '900' },
  small: { color: colors.muted, fontSize: 10, lineHeight: 15, marginVertical: 3 },
  amount: { alignItems: 'flex-end', gap: spacing.sm },
});
