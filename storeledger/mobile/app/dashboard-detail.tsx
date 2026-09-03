import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button, Card, Icon, Loading, Message, Money, Screen, Title } from '@/components/ui';
import { cachedGet, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { DashboardDetail, DashboardDetailKind, Expense, Party, Payment, Sale } from '@/types';

const VALID_KINDS: DashboardDetailKind[] = ['today_sales', 'collected', 'owes_me', 'i_owe', 'today_expenses', 'month_expenses', 'today_transactions'];

type Activity =
  | { type: 'sale'; createdAt: string; sale: Sale }
  | { type: 'payment'; createdAt: string; payment: Payment }
  | { type: 'expense'; createdAt: string; expense: Expense };

export default function DashboardDetailScreen() {
  const params = useLocalSearchParams<{ kind?: string | string[] }>();
  const rawKind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const kind = VALID_KINDS.includes(rawKind as DashboardDetailKind) ? rawKind as DashboardDetailKind : null;
  const [data, setData] = useState<DashboardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!kind) {
      setError('This dashboard detail type is not supported.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      const result = await cachedGet<DashboardDetail>(`/dashboard/details/?kind=${kind}`);
      setData(result.data);
      setOffline(result.offline);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const activities = useMemo<Activity[]>(() => {
    if (!data || !['collected', 'today_transactions', 'today_expenses', 'month_expenses'].includes(data.kind)) return [];
    const includeSales = data.kind === 'collected' || data.kind === 'today_transactions';
    const includeExpenses = data.kind === 'today_transactions' || data.kind === 'today_expenses' || data.kind === 'month_expenses';
    return [
      ...(includeSales ? data.sales.map(sale => ({ type: 'sale' as const, createdAt: sale.created_at, sale })) : []),
      ...data.payments.map(payment => ({ type: 'payment' as const, createdAt: payment.created_at, payment })),
      ...(includeExpenses ? data.expenses.map(expense => ({ type: 'expense' as const, createdAt: expense.created_at, expense })) : []),
    ].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
  }, [data]);

  if (loading && !data) return <Screen scroll={false}><Loading /></Screen>;
  if (!data) return <Screen><Title>Dashboard Details</Title><Message text={error || 'No details are available.'} tone="error" /><Button title="Go Back" variant="secondary" onPress={() => router.back()} /></Screen>;

  const period = data.period.start === data.period.end ? data.period.start : `${data.period.start} – ${data.period.end}`;
  const hasRecords = data.sales.length > 0 || data.payments.length > 0 || data.parties.length > 0 || data.expenses.length > 0;
  const amountMode = data.kind === 'collected' ? 'collected' : 'total';

  return (
    <Screen>
      <Title eyebrow="Dashboard details" subtitle={data.subtitle}>{data.title}</Title>
      {offline ? <Message text="Offline: showing the most recently saved details." tone="warning" /> : null}
      {error ? <Message text={error} tone="error" /> : null}
      <Card style={styles.overview}>
        <View style={styles.overviewIcon}><Icon name={detailIcon(data.kind)} size={24} color={detailColor(data.kind)} /></View>
        <View style={styles.overviewRow}>
          {data.total !== null ? <View style={styles.overviewItem}><Text style={styles.overviewLabel}>Total</Text><Money value={data.total} currency={data.currency} color={detailColor(data.kind)} /></View> : null}
          <View style={styles.overviewItem}><Text style={styles.overviewLabel}>Records</Text><Text style={styles.recordCount}>{data.count}</Text></View>
        </View>
        <Text style={styles.period}>Period: {period}</Text>
      </Card>

      {data.kind === 'today_sales' ? <SectionTitle>Sales</SectionTitle> : null}
      {data.kind === 'today_sales' ? data.sales.map(sale => <SaleCard key={sale.id} sale={sale} currency={data.currency} amountMode="total" />) : null}

      {['collected', 'today_transactions', 'today_expenses', 'month_expenses'].includes(data.kind) ? (
        <SectionTitle>{data.kind === 'collected' ? 'Collection Sources' : data.kind === 'today_transactions' ? 'Sales, Payments and Expenses' : 'Expenses and Payments Sent'}</SectionTitle>
      ) : null}
      {activities.map(activity => {
        if (activity.type === 'sale') return <SaleCard key={`sale-${activity.sale.id}`} sale={activity.sale} currency={data.currency} amountMode={amountMode} />;
        if (activity.type === 'payment') return <PaymentCard key={`payment-${activity.payment.id}`} payment={activity.payment} currency={data.currency} />;
        return <ExpenseCard key={`expense-${activity.expense.id}`} expense={activity.expense} currency={data.currency} />;
      })}

      {(data.kind === 'owes_me' || data.kind === 'i_owe') ? <SectionTitle>{data.kind === 'owes_me' ? 'Customers Owing the Store' : 'People and Suppliers to Pay'}</SectionTitle> : null}
      {data.parties.map(party => <PartyCard key={party.id} party={party} currency={data.currency} />)}

      {!hasRecords ? <Message text="No records contribute to this dashboard card for the selected period." /> : null}
      <Button title="Refresh Details" variant="secondary" onPress={load} />
    </Screen>
  );
}

function detailColor(kind: DashboardDetailKind) {
  if (kind === 'owes_me' || kind === 'today_expenses' || kind === 'month_expenses') return colors.danger;
  if (kind === 'i_owe') return colors.success;
  return colors.text;
}

function detailIcon(kind: DashboardDetailKind): React.ComponentProps<typeof Icon>['name'] {
  if (kind === 'today_sales') return 'stats-chart-outline';
  if (kind === 'collected') return 'wallet-outline';
  if (kind === 'owes_me') return 'person-outline';
  if (kind === 'i_owe') return 'arrow-up-circle-outline';
  if (kind === 'today_expenses' || kind === 'month_expenses') return 'receipt-outline';
  return 'swap-horizontal-outline';
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <View style={styles.sectionHeading}><View style={styles.sectionIcon}><Icon name="list-outline" size={19} color={colors.primary} /></View><Text style={styles.sectionTitle}>{children}</Text></View>;
}

function SaleCard({ sale, currency, amountMode }: { sale: Sale; currency: string; amountMode: 'total' | 'collected' }) {
  const displayedAmount = amountMode === 'collected' ? sale.amount_paid : sale.total;
  return (
    <Card>
      <View style={styles.cardHeader}>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{amountMode === 'collected' ? 'Collected at sale' : 'Sale'} #{sale.id.slice(0, 8)}</Text>
          <Text style={styles.meta}>{sale.customer_name || 'Walk-in'} · {friendlyType(sale.customer_type)}</Text>
          <Text style={styles.meta}>{new Date(sale.created_at).toLocaleString()} · by {sale.created_by_name}</Text>
        </View>
        <Money value={displayedAmount} currency={currency} color={amountMode === 'collected' ? colors.success : colors.text} />
      </View>
      <View style={styles.itemList}>
        {sale.items.map(item => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.flex}><Text style={styles.itemName}>{item.product_name}</Text><Text style={styles.meta}>{formatQuantity(item.quantity)} × {Number(item.unit_price).toFixed(2)} {currency}</Text></View>
            <Text style={styles.lineTotal}>{Number(item.line_total).toFixed(2)} {currency}</Text>
          </View>
        ))}
      </View>
      <View style={styles.amountRow}><Text style={styles.paid}>Paid: {Number(sale.amount_paid).toFixed(2)} {currency}</Text><Text style={[styles.outstanding, Number(sale.outstanding) > 0 && styles.outstandingOpen]}>Outstanding: {Number(sale.outstanding).toFixed(2)} {currency}</Text></View>
      {sale.note ? <Text style={styles.note}>Note: {sale.note}</Text> : null}
      {sale.customer_record_id ? <ProfileLink partyId={sale.customer_record_id} label="Open customer profile and history" /> : <Text style={styles.walkIn}>Walk-in sale — no customer account</Text>}
    </Card>
  );
}

function PaymentCard({ payment, currency }: { payment: Payment; currency: string }) {
  const isSent = payment.direction === 'sent';
  const isPurchasePayment = isSent && Boolean(payment.purchase);
  return (
    <Card>
      <View style={styles.cardHeader}>
        <View style={styles.flex}><Text style={styles.cardTitle}>{isPurchasePayment ? 'Purchase amount paid now' : isSent ? 'Payment sent' : 'Later payment received'}</Text><Text style={styles.meta}>{payment.party_name} · {payment.method}</Text><Text style={styles.meta}>Payment date: {payment.payment_date} · recorded {new Date(payment.created_at).toLocaleString()}</Text>{isPurchasePayment ? <Text style={styles.meta}>Purchase #{payment.purchase?.slice(0, 8)}</Text> : null}</View>
        <Money value={payment.amount} currency={currency} color={isSent ? colors.danger : colors.success} />
      </View>
      {payment.note ? <Text style={styles.note}>Note: {payment.note}</Text> : null}
      <Text style={styles.balance}>Balance after this payment: {Number(payment.balance_after).toFixed(2)} {currency}</Text>
      <ProfileLink partyId={payment.party_record_id} label="Open customer profile and history" />
    </Card>
  );
}

function PartyCard({ party, currency }: { party: Party; currency: string }) {
  const color = party.balance_color === 'red' ? colors.danger : party.balance_color === 'green' ? colors.success : colors.neutral;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${party.name} profile`} onPress={() => openParty(party.id)} style={({ pressed }) => pressed && styles.pressed}>
      <Card>
        <View style={styles.cardHeader}><View style={styles.flex}><Text style={styles.cardTitle}>{party.name}</Text>{party.company ? <Text style={styles.meta}>{party.company}</Text> : null}<Text style={styles.meta}>{friendlyType(party.party_type)} · {party.phone}</Text>{party.account_number ? <Text style={styles.meta}>Account: {party.account_number}</Text> : null}</View><View style={styles.amountRight}><Text style={[styles.balanceLabel, { color }]}>{party.balance_label}</Text><Money value={party.balance_amount} currency={currency} color={color} /></View></View>
        <Text style={styles.profileLink}>Open profile and transaction history ›</Text>
      </Card>
    </Pressable>
  );
}

function ExpenseCard({ expense, currency }: { expense: Expense; currency: string }) {
  return (
    <Card>
      <View style={styles.cardHeader}><View style={styles.flex}><Text style={styles.cardTitle}>{expense.description}</Text><Text style={styles.meta}>{expense.category_name} · {expense.expense_date} · {expense.payment_method}</Text>{expense.reference ? <Text style={styles.meta}>Reference: {expense.reference}</Text> : null}{expense.created_by_name ? <Text style={styles.meta}>Recorded by: {expense.created_by_name}</Text> : null}</View><Money value={expense.amount} currency={currency} color={colors.danger} /></View>
      {expense.notes ? <Text style={styles.note}>Notes: {expense.notes}</Text> : null}
    </Card>
  );
}

function ProfileLink({ partyId, label }: { partyId: number; label: string }) {
  return <Pressable accessibilityRole="button" onPress={() => openParty(partyId)}><Text style={styles.profileLink}>{label} ›</Text></Pressable>;
}

function openParty(partyId: number) {
  router.push({ pathname: '/customer-detail', params: { partyId: String(partyId) } });
}

function friendlyType(value: string) {
  if (value === 'walk_in') return 'Walk-in';
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : 'Customer';
}

function formatQuantity(value: string) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

const styles = StyleSheet.create({
  overview: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder, paddingTop: 58 },
  overviewIcon: { position: 'absolute', top: 14, left: 16, width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  overviewItem: { flex: 1, gap: spacing.xs },
  overviewLabel: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  recordCount: { color: colors.primary, fontSize: 28, fontWeight: '900' },
  period: { color: colors.muted, marginTop: spacing.md, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  sectionIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  flex: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  meta: { color: colors.muted, marginTop: spacing.xs, lineHeight: 18 },
  itemList: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemName: { color: colors.text, fontWeight: '800' },
  lineTotal: { color: colors.text, fontWeight: '800' },
  amountRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.sm },
  paid: { color: colors.success, fontWeight: '800' },
  outstanding: { color: colors.neutral, fontWeight: '800' },
  outstandingOpen: { color: colors.danger },
  note: { color: colors.text, marginTop: spacing.sm, lineHeight: 19 },
  walkIn: { color: colors.muted, marginTop: spacing.md, fontWeight: '700' },
  balance: { color: colors.text, marginTop: spacing.sm, fontWeight: '800' },
  balanceLabel: { fontSize: 12, fontWeight: '900', textAlign: 'right' },
  amountRight: { alignItems: 'flex-end', gap: spacing.xs },
  profileLink: { color: colors.primary, fontWeight: '900', marginTop: spacing.md },
  pressed: { opacity: 0.65 },
});
