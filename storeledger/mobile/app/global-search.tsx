import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { Badge, Button, Card, Icon, Message, Money, Screen, SearchField, SectionHeader, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { SearchResults } from '@/types';

export default function GlobalSearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string | string[] }>();
  const initialQuery = (Array.isArray(q) ? q[0] : q || '').trim();
  const autoSearched = useRef(false);
  const { store } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState<SearchResults | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const search = async (term = query) => {
    const clean = term.trim();
    if (clean.length < 2) return;
    setBusy(true);
    setError('');
    try {
      setData(await apiFetch<SearchResults>(`/search/?q=${encodeURIComponent(clean)}`));
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { if (!autoSearched.current && initialQuery.length >= 2) { autoSearched.current = true; void search(initialQuery); } }, [initialQuery]);
  const resultCount = data ? data.products.length + data.parties.length + data.sales.length + data.purchases.length + data.expenses.length : 0;
  return (
    <Screen>
      <Title eyebrow="Global search" subtitle="Products, people, sales, purchases, expenses and references">Search Everything</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <View style={styles.searchRow}><View style={styles.flex}><SearchField value={query} onChangeText={setQuery} placeholder="Name, factory, phone, reference or note" onSubmitEditing={() => { void search(); }} /></View><View style={styles.searchButton}><Button title={busy ? '…' : 'Search'} icon="search-outline" compact onPress={() => { void search(); }} disabled={busy || query.trim().length < 2} /></View></View>
      {data ? <View style={styles.resultSummary}><Icon name="search-outline" size={18} color={colors.primary} /><Text style={styles.count}>{resultCount} results for “{data.query}”</Text></View> : null}

      {data?.products.length ? <Section title="Products" icon="cube-outline" count={data.products.length}>{data.products.map(item => <ResultRow key={item.id} icon="cube-outline" title={item.name} subtitle={`Factory ${item.factory_name} · stock ${item.current_quantity}`} value={<Money value={item.selling_price} currency={store?.currency} size="small" />} onPress={() => router.push({ pathname: '/product-edit', params: { productId: String(item.id) } })} />)}</Section> : null}
      {data?.parties.length ? <Section title="People & Companies" icon="people-outline" count={data.parties.length}>{data.parties.map(item => <ResultRow key={item.id} icon="person-outline" title={item.name} subtitle={`${item.company || item.phone} · ${item.balance_label}`} value={<Money value={item.balance_amount} currency={store?.currency} color={item.balance_color === 'red' ? colors.danger : item.balance_color === 'green' ? colors.success : colors.neutral} size="small" />} onPress={() => router.push({ pathname: '/customer-detail', params: { partyId: String(item.id) } })} />)}</Section> : null}
      {data?.sales.length ? <Section title="Sales" icon="cart-outline" count={data.sales.length}>{data.sales.map(item => <ResultRow key={item.id} icon="cart-outline" title={item.customer_name || 'Walk-in'} subtitle={`${new Date(item.created_at).toLocaleString()} · ${item.id.slice(0, 8)}`} value={<Money value={item.total} currency={store?.currency} size="small" />} />)}</Section> : null}
      {data?.purchases.length ? <Section title="Purchases" icon="bag-handle-outline" count={data.purchases.length}>{data.purchases.map(item => <ResultRow key={item.id} icon="business-outline" title={item.supplier_name} subtitle={`${item.purchase_date} · ${item.reference || item.id.slice(0, 8)}`} value={<Money value={item.total} currency={store?.currency} size="small" />} />)}</Section> : null}
      {data?.expenses.length ? <Section title="Expenses" icon="receipt-outline" count={data.expenses.length}>{data.expenses.map(item => <ResultRow key={item.id} icon="receipt-outline" title={item.description} subtitle={`${item.category_name} · ${item.expense_date}`} value={<Money value={item.amount} currency={store?.currency} color={colors.danger} size="small" />} />)}</Section> : null}
      {data && !resultCount ? <Message text="No matching records in this store." /> : null}
    </Screen>
  );
}

function Section({ title, icon, count, children }: { title: string; icon: React.ComponentProps<typeof Icon>['name']; count: number; children: React.ReactNode }) {
  return <Card style={styles.section}><SectionHeader title={title} action={<Badge label={String(count)} tone="primary" />} /><View style={styles.sectionIcon}><Icon name={icon} size={19} color={colors.primary} /></View>{children}</Card>;
}

function ResultRow({ icon, title, subtitle, value, onPress }: { icon: React.ComponentProps<typeof Icon>['name']; title: string; subtitle: string; value: React.ReactNode; onPress?: () => void }) {
  const content = <><View style={styles.resultIcon}><Icon name={icon} size={19} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.name}>{title}</Text><Text style={styles.small}>{subtitle}</Text></View><View style={styles.value}>{value}</View>{onPress ? <Icon name="chevron-forward" size={18} color={colors.muted} /> : null}</>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>{content}</Pressable> : <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchButton: { width: 106 },
  resultSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.mdSm },
  count: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  section: { paddingVertical: 0, overflow: 'hidden' },
  sectionIcon: { position: 'absolute', top: 15, right: 58, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, paddingVertical: spacing.mdSm, borderTopWidth: 1, borderTopColor: colors.border },
  resultIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 14, fontWeight: '900' },
  small: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  value: { alignItems: 'flex-end' },
  pressed: { opacity: 0.65 },
});
