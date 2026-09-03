import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Button, Card, Icon, IconButton, IconName, Loading, Message, Money, Screen, SearchField, SectionHeader } from '@/components/ui';
import { cachedGet, errorMessage } from '@/lib/api';
import { colors, radius, shadow, spacing } from '@/theme';
import type { Dashboard, DashboardDetailKind } from '@/types';

type Tone = 'neutral' | 'danger' | 'success' | 'warning';

const QUICK_ACTIONS: { label: string; icon: IconName; onPress: () => void; primary?: boolean }[] = [
  { label: 'New Sale', icon: 'cart-outline', primary: true, onPress: () => router.push('/(tabs)/sale') },
  { label: 'Add Stock', icon: 'cube-outline', onPress: () => router.push('/(tabs)/stock') },
  { label: 'Add Trader', icon: 'person-add-outline', onPress: () => router.push({ pathname: '/customer-new', params: { type: 'trader' } }) },
  { label: 'Add Agent', icon: 'people-outline', onPress: () => router.push({ pathname: '/customer-new', params: { type: 'agent' } }) },
  { label: 'Record Payment', icon: 'wallet-outline', onPress: () => router.push('/payment-new') },
  { label: 'Pay Someone', icon: 'paper-plane-outline', onPress: () => router.push('/outgoing-payment') },
  { label: 'Add Expense', icon: 'receipt-outline', onPress: () => router.push('/expense-new') },
  { label: 'Receive Purchase', icon: 'bag-handle-outline', onPress: () => router.push('/purchase-new') },
];

export default function DashboardScreen() {
  const { store, me } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await cachedGet<Dashboard>('/dashboard/');
      setData(result.data);
      setOffline(result.offline);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openSearch = () => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setError('Type at least two characters to search.');
      return;
    }
    setError('');
    router.push({ pathname: '/global-search', params: { q: query } });
  };

  if (loading && !data) return <Screen scroll={false} safeTop safeTopColor={colors.primaryButton}><Loading /></Screen>;
  const firstName = me?.user.name?.trim().split(/\s+/)[0] || me?.user.username || 'there';
  const percentage = Math.min(Number(data?.budget_percentage || 0), 100);

  return (
    <Screen style={styles.screen} safeTop safeTopColor={colors.primaryButton}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.greeting}>Good to see you, {firstName}</Text>
            <Text style={styles.storeName}>{store?.name || 'StoreLedger'}</Text>
            <Text style={styles.heroSubtitle}>Here is today&apos;s business overview.</Text>
          </View>
          <IconButton icon="notifications-outline" label="Open notifications" variant="plain" onPress={() => router.push('/notifications')} />
        </View>
        <SearchField value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={openSearch} placeholder="Search products, people, sales, expenses…" />
      </View>

      {offline ? <Message text="You're offline. Showing the most recently saved dashboard." tone="warning" /> : null}
      {error ? <Message text={error} tone="error" /> : null}

      <SectionHeader title="Overview" subtitle="Tap any card to see the complete details" />
      <View style={styles.grid}>
        <SummaryCard kind="today_sales" label="Today's Sales" value={data?.today_sales || '0'} currency={data?.currency} icon="stats-chart-outline" />
        <SummaryCard kind="collected" label="Collected" value={data?.total_collected || '0'} currency={data?.currency} icon="wallet-outline" />
        <SummaryCard kind="owes_me" label="Owes Me" value={data?.customers_owing || '0'} currency={data?.currency} icon="person-outline" tone="danger" />
        <SummaryCard kind="i_owe" label="I Owe" value={data?.store_payables || '0'} currency={data?.currency} icon="arrow-up-circle-outline" tone="success" />
        <SummaryCard kind="today_expenses" label="Today's Expenses" value={data?.today_expenses || '0'} currency={data?.currency} icon="receipt-outline" tone="danger" />
        <SummaryCard kind="month_expenses" label="Month Expenses" value={data?.month_expenses || '0'} currency={data?.currency} icon="calendar-outline" tone="warning" />
        <SummaryCountCard kind="today_transactions" label="Today's Transactions" value={data?.today_transaction_count || 0} />
      </View>

      <SectionHeader title="Quick actions" subtitle="Everything you use most, one tap away" />
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map(action => <QuickAction key={action.label} {...action} />)}
      </View>

      <Card style={styles.budgetCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerWithIcon}>
            <View style={styles.iconSoft}><Icon name="pie-chart-outline" color={colors.primary} size={21} /></View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>Monthly Expense Budget</Text>
              <Text style={styles.small}>{data?.budget_percentage || '0'}% used</Text>
            </View>
          </View>
          <Pressable onPress={() => router.push('/expenses')}><Text style={styles.link}>Manage</Text></Pressable>
        </View>
        <View style={styles.progress}><View style={[styles.progressBar, { width: `${percentage}%`, backgroundColor: Number(data?.budget_percentage || 0) > 100 ? colors.dangerButton : colors.primaryButton }]} /></View>
        <View style={styles.budgetMeta}>
          <Text style={styles.small}>{Number(data?.month_expenses || 0).toLocaleString()} {data?.currency} spent</Text>
          <Text style={styles.remaining}>{Number(data?.budget_remaining || 0).toLocaleString()} {data?.currency} remaining</Text>
        </View>
      </Card>

      <Card>
        <SectionHeader title="Alerts" subtitle="Items that may need your attention" />
        <AlertRow icon="warning-outline" label="Low-stock items" count={data?.low_stock_count || 0} tone="warning" onPress={() => router.push('/(tabs)/stock')} />
        <AlertRow icon="notifications-outline" label="Unread notifications" count={data?.unread_notification_count || 0} tone="primary" onPress={() => router.push('/notifications')} />
        <AlertRow icon="time-outline" label={`Overdue ${data?.overdue_days || 0}+ days`} count={data?.overdue_count || 0} tone="danger" onPress={() => router.push('/overdue')} />
      </Card>

      <BalanceList title="Customers Owing Me" items={data?.customers_owing_list || []} currency={data?.currency || 'ETB'} tone="danger" />
      <BalanceList title="Store Payables" items={data?.store_payables_list || []} currency={data?.currency || 'ETB'} tone="success" />

      {data?.low_stock?.length ? (
        <Card>
          <SectionHeader title="Low-stock Products" action={<Pressable onPress={() => router.push('/(tabs)/stock')}><Text style={styles.link}>View stock</Text></Pressable>} />
          {data.low_stock.map(product => (
            <View key={product.id} style={styles.listRow}>
              <View style={styles.avatarWarning}><Icon name="cube-outline" size={19} color={colors.warning} /></View>
              <View style={styles.flex}><Text style={styles.rowLabel}>{product.name}</Text><Text style={styles.small}>{product.sku} · {product.unit}</Text></View>
              <Badge label={`${product.current_quantity} left`} tone="warning" />
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionHeader title="Recent Transactions" action={<Pressable onPress={() => router.push('/transactions')}><Text style={styles.link}>View all</Text></Pressable>} />
        {data?.recent_transactions?.length ? data.recent_transactions.map(item => {
          const debit = Number(item.delta) > 0;
          return (
            <View key={item.id} style={styles.listRow}>
              <View style={[styles.transactionIcon, { backgroundColor: debit ? colors.dangerSoft : colors.successSoft }]}><Icon name={debit ? 'arrow-down-outline' : 'arrow-up-outline'} size={18} color={debit ? colors.danger : colors.success} /></View>
              <View style={styles.flex}><Text style={styles.rowLabel}>{item.party_name}</Text><Text style={styles.small} numberOfLines={1}>{item.description}</Text></View>
              <Money value={Math.abs(Number(item.delta))} currency={data.currency} color={debit ? colors.danger : colors.success} size="small" />
            </View>
          );
        }) : <Text style={styles.emptyText}>No transactions yet.</Text>}
      </Card>

      <Button title="Refresh Dashboard" icon="refresh-outline" variant="secondary" onPress={load} />
    </Screen>
  );
}

function openDashboardDetail(kind: DashboardDetailKind) {
  router.push({ pathname: '/dashboard-detail', params: { kind } });
}

function toneColor(tone: Tone) {
  if (tone === 'danger') return colors.danger;
  if (tone === 'success') return colors.success;
  if (tone === 'warning') return colors.warning;
  return colors.primary;
}

function toneBackground(tone: Tone) {
  if (tone === 'danger') return colors.dangerSoft;
  if (tone === 'success') return colors.successSoft;
  if (tone === 'warning') return colors.warningSoft;
  return colors.primarySoft;
}

function SummaryCard({ kind, label, value, currency = 'ETB', icon, tone = 'neutral' }: { kind: DashboardDetailKind; label: string; value: string; currency?: string; icon: IconName; tone?: Tone }) {
  const color = toneColor(tone);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. Open details.`} onPress={() => openDashboardDetail(kind)} style={({ pressed }) => [styles.summaryPressable, pressed && styles.pressed]}>
      <Card style={styles.summaryCard}>
        <View style={[styles.metricIcon, { backgroundColor: toneBackground(tone) }]}><Icon name={icon} size={17} color={color} /></View>
        <Text style={styles.metricLabel}>{label}</Text>
        <Money value={value} currency={currency} color={tone === 'neutral' ? colors.text : color} size="small" />
        <View style={styles.detailsRow}><Text style={styles.viewDetails}>View details</Text><Icon name="chevron-forward" size={14} color={colors.primary} /></View>
      </Card>
    </Pressable>
  );
}

function SummaryCountCard({ kind, label, value }: { kind: DashboardDetailKind; label: string; value: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. Open details.`} onPress={() => openDashboardDetail(kind)} style={({ pressed }) => [styles.summaryWide, pressed && styles.pressed]}>
      <Card style={styles.countCard}>
        <View style={styles.headerWithIcon}>
          <View style={styles.metricIcon}><Icon name="swap-horizontal-outline" size={17} color={colors.primary} /></View>
          <View style={styles.flex}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.countValue}>{value}</Text></View>
        </View>
        <View style={styles.detailsRow}><Text style={styles.viewDetails}>Open today&apos;s activity</Text><Icon name="chevron-forward" size={14} color={colors.primary} /></View>
      </Card>
    </Pressable>
  );
}

function QuickAction({ label, icon, onPress, primary = false }: { label: string; icon: IconName; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      <View style={[styles.quickIcon, primary && styles.quickIconPrimary]}><Icon name={icon} size={22} color={primary ? colors.onPrimary : colors.primary} /></View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function AlertRow({ icon, label, count, tone, onPress }: { icon: IconName; label: string; count: number; tone: 'primary' | 'warning' | 'danger'; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.listRow, pressed && styles.pressed]} onPress={onPress}>
      <Icon name={icon} size={20} color={tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.primary} />
      <Text style={styles.alertLabel}>{label}</Text>
      <Badge label={String(count)} tone={tone} />
      <Icon name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function BalanceList({ title, items, currency, tone }: { title: string; items: Dashboard['customers_owing_list']; currency: string; tone: 'danger' | 'success' }) {
  if (!items.length) return null;
  const color = tone === 'danger' ? colors.danger : colors.success;
  return (
    <Card>
      <SectionHeader title={title} />
      {items.map(item => (
        <Pressable key={item.id} style={({ pressed }) => [styles.listRow, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/customer-detail', params: { partyId: String(item.id) } })}>
          <View style={[styles.avatar, { backgroundColor: tone === 'danger' ? colors.dangerSoft : colors.successSoft }]}><Text style={[styles.avatarText, { color }]}>{initials(item.name)}</Text></View>
          <View style={styles.flex}><Text style={styles.rowLabel}>{item.name}</Text><Text style={styles.small}>{item.party_type === 'agent' ? 'Agent' : 'Trader'}</Text></View>
          <Money value={item.balance_amount} currency={currency} color={color} size="small" />
          <Icon name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      ))}
    </Card>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

const styles = StyleSheet.create({
  screen: { paddingTop: 0 },
  flex: { flex: 1 },
  hero: { backgroundColor: colors.primaryButton, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.mdSm, paddingBottom: spacing.md, gap: spacing.mdSm, ...shadow.card },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  heroCopy: { flex: 1, gap: 2 },
  greeting: { color: colors.onPrimary, opacity: 0.84, fontSize: 13, fontWeight: '700' },
  storeName: { color: colors.onPrimary, fontSize: 23, lineHeight: 28, fontWeight: '900', letterSpacing: -0.4 },
  heroSubtitle: { color: colors.onPrimary, opacity: 0.78, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryPressable: { width: '48%' },
  summaryWide: { width: '100%' },
  summaryCard: { flex: 1, minHeight: 118, padding: 10, gap: 4, justifyContent: 'space-between' },
  countCard: { minHeight: 114, gap: spacing.sm, justifyContent: 'space-between' },
  pressed: { opacity: 0.68 },
  metricIcon: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { color: colors.muted, fontSize: 11, lineHeight: 14, fontWeight: '800' },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewDetails: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  countValue: { color: colors.primary, fontSize: 28, lineHeight: 32, fontWeight: '900' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  quickAction: { width: '23%', minHeight: 88, alignItems: 'center', justifyContent: 'flex-start', gap: spacing.sm },
  quickIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  quickIconPrimary: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  quickLabel: { color: colors.textSoft, fontSize: 11, lineHeight: 15, fontWeight: '800', textAlign: 'center' },
  budgetCard: { gap: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  headerWithIcon: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, flex: 1 },
  iconSoft: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900', color: colors.text },
  progress: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: radius.pill },
  budgetMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  remaining: { color: colors.success, fontSize: 12, fontWeight: '900', textAlign: 'right' },
  listRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.mdSm },
  alertLabel: { flex: 1, color: colors.text, fontWeight: '800', fontSize: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '900' },
  avatarWarning: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' },
  transactionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: colors.text, fontWeight: '800', fontSize: 14 },
  small: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  emptyText: { color: colors.muted, fontSize: 13, paddingVertical: spacing.lg, textAlign: 'center' },
  link: { color: colors.primary, fontWeight: '900', fontSize: 13 },
});
