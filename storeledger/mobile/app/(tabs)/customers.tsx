import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Badge, Button, Card, Icon, Loading, Message, Money, Screen, SearchField, Title } from '@/components/ui';
import { cachedGet, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Paginated, Party } from '@/types';

export default function CustomersScreen() {
  const [type, setType] = useState<'trader' | 'agent'>('trader');
  const [parties, setParties] = useState<Party[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await cachedGet<Paginated<Party>>(`/parties/?party_type=${type}&page_size=100${query ? `&search=${encodeURIComponent(query)}` : ''}`);
      setParties(result.data.results);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [type, query]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <Screen safeTop>
      <Title
        eyebrow="People & balances"
        subtitle="Balances are shown from your store's perspective"
        action={<Button title={`Add ${type === 'trader' ? 'Trader' : 'Agent'}`} icon="person-add-outline" compact onPress={() => router.push({ pathname: '/customer-new', params: { type } })} />}
      >Customers</Title>
      {error ? <Message text={error} tone="error" /> : null}

      <View style={styles.toggle}>
        {(['trader', 'agent'] as const).map(value => (
          <Pressable key={value} onPress={() => { setLoading(true); setType(value); }} style={[styles.toggleButton, type === value && styles.toggleActive]}>
            <Icon name={value === 'trader' ? 'person-outline' : 'people-outline'} size={18} color={type === value ? colors.onPrimary : colors.muted} />
            <Text style={[styles.toggleText, type === value && styles.toggleTextActive]}>{value === 'trader' ? 'Traders' : 'Agents'}</Text>
          </Pressable>
        ))}
      </View>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search name, phone or account" onSubmitEditing={load} />

      {loading ? <Loading /> : parties.length ? parties.map(party => {
        const tone = party.balance_color === 'red' ? 'danger' : party.balance_color === 'green' ? 'success' : 'neutral';
        const balanceColor = tone === 'danger' ? colors.danger : tone === 'success' ? colors.success : colors.neutral;
        const owesStore = Number(party.current_balance) >= 0;
        return (
          <Card key={party.id}>
            <Pressable onPress={() => router.push({ pathname: '/customer-detail', params: { partyId: String(party.id) } })} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={[styles.avatar, { backgroundColor: party.party_type === 'agent' ? colors.successSoft : colors.primarySoft }]}>
                <Text style={[styles.avatarText, { color: party.party_type === 'agent' ? colors.success : colors.primary }]}>{initials(party.name)}</Text>
              </View>
              <View style={styles.customerCopy}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{party.name}</Text>
                  <Badge label={party.party_type === 'agent' ? 'AGENT' : 'TRADER'} tone={party.party_type === 'agent' ? 'success' : 'primary'} />
                </View>
                <Text style={styles.small}>{party.phone}{party.account_number ? ` · ${party.account_number}` : ''}</Text>
                {party.company ? <Text style={styles.company}>{party.company}</Text> : null}
              </View>
              <Icon name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>

            <View style={styles.balancePanel}>
              <View>
                <Text style={[styles.balanceLabel, { color: balanceColor }]}>{party.balance_label.toUpperCase()}</Text>
                <Money value={party.balance_amount} color={balanceColor} size="small" />
              </View>
              <View style={styles.balanceActions}>
                <MiniAction icon="cart-outline" label="Sale" onPress={() => router.push({ pathname: '/(tabs)/sale', params: { customerId: String(party.id) } })} />
                <MiniAction icon={owesStore ? 'wallet-outline' : 'paper-plane-outline'} label={owesStore ? 'Payment' : 'Pay'} onPress={() => router.push({ pathname: owesStore ? '/payment-new' : '/outgoing-payment', params: { partyId: String(party.id), name: party.name } })} />
                <MiniAction icon="create-outline" label="Credit" onPress={() => router.push({ pathname: '/credit-new', params: { partyId: String(party.id), name: party.name } })} />
                <MiniAction icon="ellipsis-horizontal" label="Profile" onPress={() => router.push({ pathname: '/customer-detail', params: { partyId: String(party.id) } })} />
              </View>
            </View>
          </Card>
        );
      }) : (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}><Icon name="people-outline" size={32} color={colors.primary} /></View>
          <Text style={styles.emptyTitle}>No {type}s found</Text>
          <Text style={styles.emptyText}>Add the first {type} or try another search.</Text>
          <Button title={`Add ${type === 'trader' ? 'Trader' : 'Agent'}`} icon="person-add-outline" onPress={() => router.push({ pathname: '/customer-new', params: { type } })} />
        </Card>
      )}
    </Screen>
  );
}

function MiniAction({ icon, label, onPress }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.miniAction, pressed && styles.pressed]}>
      <Icon name={icon} size={17} color={colors.primary} />
      <Text style={styles.miniActionText}>{label}</Text>
    </Pressable>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  toggleButton: { flex: 1, minHeight: 44, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  toggleActive: { backgroundColor: colors.primaryButton },
  toggleText: { color: colors.muted, fontWeight: '800' },
  toggleTextActive: { color: colors.onPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '900' },
  customerCopy: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  name: { fontSize: 16, lineHeight: 22, fontWeight: '900', color: colors.text },
  small: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  company: { color: colors.textSoft, fontSize: 12, fontWeight: '700', marginTop: 2 },
  balancePanel: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  balanceLabel: { fontWeight: '900', fontSize: 10, letterSpacing: 0.45, marginBottom: 2 },
  balanceActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniAction: { minWidth: 48, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 7, paddingHorizontal: 5, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  miniActionText: { color: colors.primary, fontSize: 9, fontWeight: '900' },
  pressed: { opacity: 0.62 },
  emptyCard: { minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
});
