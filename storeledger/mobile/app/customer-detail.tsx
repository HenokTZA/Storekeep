import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Icon, Loading, Message, Money, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Paginated, Party, Transaction } from '@/types';

export default function CustomerDetailScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const [party, setParty] = useState<Party | null>(null);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const [profile, transactions] = await Promise.all([apiFetch<Party>(`/parties/${partyId}/`), apiFetch<Paginated<Transaction>>(`/parties/${partyId}/history/?page_size=100`)]);
      setParty(profile);
      setHistory(transactions.results);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [partyId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (loading || !party) return <Screen scroll={false}><Loading /></Screen>;

  const balanceColor = party.balance_color === 'red' ? colors.danger : party.balance_color === 'green' ? colors.success : colors.neutral;
  const paymentSent = Number(party.current_balance) < 0;
  return (
    <Screen>
      <Title eyebrow="Customer profile" subtitle="Contact, balance and permanent transaction history">{party.name}</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <Card style={styles.profileCard}>
        <View style={styles.identityRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(party.name)}</Text></View>
          <View style={styles.flex}>
            <View style={styles.nameRow}><Text style={styles.name}>{party.name}</Text><Badge label={party.party_type.toUpperCase()} tone={party.party_type === 'agent' ? 'success' : 'primary'} /></View>
            {party.company ? <Text style={styles.company}>{party.company}</Text> : null}
          </View>
          <Pressable onPress={() => router.push({ pathname: '/customer-edit', params: { partyId } })} style={styles.editButton}><Icon name="create-outline" size={20} color={colors.primary} /></Pressable>
        </View>
        <View style={[styles.balancePanel, { backgroundColor: party.balance_color === 'red' ? colors.dangerSoft : party.balance_color === 'green' ? colors.successSoft : colors.surfaceMuted }]}>
          <View><Text style={[styles.balanceLabel, { color: balanceColor }]}>{party.balance_label.toUpperCase()}</Text><Text style={styles.balanceHint}>Current running balance</Text></View>
          <Money value={party.balance_amount} color={balanceColor} size="large" />
        </View>
        <View style={styles.details}>
          <Detail icon="call-outline" value={party.phone} />
          {party.account_number ? <Detail icon="card-outline" value={`Account ${party.account_number}`} /> : null}
          {party.address ? <Detail icon="location-outline" value={party.address} /> : null}
          {party.notes ? <Detail icon="document-text-outline" value={party.notes} /> : null}
        </View>
      </Card>

      <View style={styles.primaryActions}>
        <View style={styles.actionButton}><Button title="New Sale" icon="cart-outline" onPress={() => router.push({ pathname: '/(tabs)/sale', params: { customerId: partyId } })} /></View>
        <View style={styles.actionButton}><Button title={paymentSent ? 'Payment Sent' : 'Payment Received'} icon={paymentSent ? 'paper-plane-outline' : 'wallet-outline'} variant="secondary" onPress={() => router.push({ pathname: paymentSent ? '/outgoing-payment' : '/payment-new', params: { partyId, name: party.name } })} /></View>
      </View>
      <View style={styles.secondaryActions}>
        <Pressable onPress={() => router.push({ pathname: '/credit-new', params: { partyId, name: party.name } })} style={styles.secondaryAction}><Icon name="repeat-outline" size={19} color={colors.primary} /><Text style={styles.secondaryText}>Credit / Loan</Text></Pressable>
        <Pressable onPress={() => router.push({ pathname: '/customer-edit', params: { partyId } })} style={styles.secondaryAction}><Icon name="create-outline" size={19} color={colors.primary} /><Text style={styles.secondaryText}>Edit Profile</Text></Pressable>
      </View>

      <SectionHeader title="Transaction History" subtitle={`${history.length} ledger entr${history.length === 1 ? 'y' : 'ies'}`} />
      {history.length ? (
        <Card style={styles.historyCard}>
          {history.map((item, index) => {
            const debit = item.credit_debit === 'debit';
            const color = debit ? colors.danger : colors.success;
            return (
              <View key={item.id} style={[styles.timelineRow, index > 0 && styles.borderTop]}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineIcon, { backgroundColor: debit ? colors.dangerSoft : colors.successSoft }]}><Icon name={debit ? 'arrow-down-outline' : 'arrow-up-outline'} size={18} color={color} /></View>
                  {index < history.length - 1 ? <View style={styles.timelineLine} /> : null}
                </View>
                <View style={styles.transactionCopy}>
                  <Text style={styles.transactionName}>{item.description}</Text>
                  <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()} · {item.transaction_type}</Text>
                  {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                  <Text style={styles.running}>Running balance: {Number(item.running_balance).toFixed(2)} ETB</Text>
                </View>
                <Money value={Math.abs(Number(item.delta))} color={color} size="small" />
              </View>
            );
          })}
        </Card>
      ) : <Message text="No transactions yet." />}
    </Screen>
  );
}

function Detail({ icon, value }: { icon: React.ComponentProps<typeof Icon>['name']; value: string }) {
  return <View style={styles.detailRow}><Icon name={icon} size={18} color={colors.muted} /><Text style={styles.detailText}>{value}</Text></View>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profileCard: { gap: spacing.md },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 19, fontWeight: '900' },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  name: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '900' },
  company: { color: colors.muted, fontSize: 13, marginTop: 3 },
  editButton: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  balancePanel: { borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  balanceLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.55 },
  balanceHint: { color: colors.muted, fontSize: 11, marginTop: 3 },
  details: { gap: spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  detailText: { flex: 1, color: colors.textSoft, fontSize: 13, lineHeight: 19 },
  primaryActions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1 },
  secondaryActions: { flexDirection: 'row', gap: spacing.sm },
  secondaryAction: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  secondaryText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  historyCard: { paddingVertical: 0 },
  timelineRow: { minHeight: 104, flexDirection: 'row', gap: spacing.mdSm, paddingVertical: spacing.md },
  borderTop: { borderTopWidth: 1, borderTopColor: colors.border },
  timelineRail: { width: 38, alignItems: 'center' },
  timelineIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, flex: 1, minHeight: 42, backgroundColor: colors.border, marginTop: 4 },
  transactionCopy: { flex: 1 },
  transactionName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  note: { color: colors.textSoft, fontSize: 12, lineHeight: 17, marginTop: 4 },
  running: { color: colors.muted, fontSize: 11, fontWeight: '800', marginTop: 6 },
});
