import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Icon, Input, Loading, Message, Money, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { createUuid } from '@/lib/uuid';
import { colors, radius, spacing } from '@/theme';
import type { Paginated, Party } from '@/types';

const localDate = () => { const value = new Date(); value.setMinutes(value.getMinutes() - value.getTimezoneOffset()); return value.toISOString().slice(0, 10); };
const methods = [
  { value: 'cash', label: 'Cash', icon: 'cash-outline' },
  { value: 'bank', label: 'Bank', icon: 'business-outline' },
  { value: 'mobile', label: 'Mobile', icon: 'phone-portrait-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
] as const;

export default function OutgoingPaymentScreen() {
  const params = useLocalSearchParams<{ partyId?: string; name?: string }>();
  const requestedPartyId = params.partyId ? Number(params.partyId) : 0;
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState(requestedPartyId);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(localDate());
  const [method, setMethod] = useState<'cash' | 'bank' | 'mobile' | 'other'>('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError('');
      const result = await apiFetch<Paginated<Party>>('/parties/?ordering=current_balance&page_size=100');
      const owing = result.results.filter(item => Number(item.current_balance) < 0);
      setParties(owing);
      if (!requestedPartyId && owing.length) setPartyId(current => current || owing[0].id);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [requestedPartyId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const selected = parties.find(item => item.id === partyId);
  const maximum = Number(selected?.balance_amount || 0);

  const save = async () => {
    const entered = Number(amount);
    if (!partyId || entered <= 0) return setError('Choose who you paid and enter an amount greater than zero.');
    if (maximum > 0 && entered > maximum) return setError(`Payment cannot exceed the current I Owe balance of ${maximum.toFixed(2)} ETB.`);
    setBusy(true);
    setError('');
    try {
      await apiFetch('/payments/', { method: 'POST', body: JSON.stringify({ party_id: partyId, amount, payment_date: paymentDate, method, direction: 'sent', note, idempotency_key: createUuid() }) });
      Alert.alert('Payment sent recorded', 'The I Owe balance, expense totals and today’s transactions were updated.');
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
      <Title eyebrow="Outgoing payment" subtitle="Record money paid to settle an I Owe balance">Payment Sent</Title>
      {error ? <Message text={error} tone="error" /> : null}

      <SectionHeader title="1. Who did you pay?" subtitle="Only people with an I Owe balance are shown" />
      <View style={styles.chips}>{parties.map(item => <Choice key={item.id} label={item.name} active={partyId === item.id} onPress={() => { setPartyId(item.id); setAmount(''); }} />)}</View>
      {!parties.length ? <Message text="No people currently have an I Owe balance." tone="success" /> : null}
      {selected ? (
        <Card style={styles.balanceCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(selected.name)}</Text></View>
          <View style={styles.flex}><Text style={styles.selectedName}>{selected.name}</Text><Text style={styles.help}>{selected.company || `${selected.party_type === 'agent' ? 'Agent' : 'Trader'} · ${selected.phone}`}</Text><Badge label="I OWE" tone="success" /></View>
          <View style={styles.amountRight}><Money value={selected.balance_amount} color={colors.success} /><Pressable accessibilityRole="button" onPress={() => setAmount(selected.balance_amount)}><Text style={styles.fullAmount}>Use full amount</Text></Pressable></View>
        </Card>
      ) : null}

      <SectionHeader title="2. Payment details" subtitle="Enter how and when you paid" />
      <Card style={styles.formCard}>
        <Input label="Amount Sent" icon="paper-plane-outline" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
        <Input label="Payment Date (YYYY-MM-DD)" icon="calendar-outline" value={paymentDate} onChangeText={setPaymentDate} />
        <View style={styles.methodGroup}>
          <Text style={styles.label}>Payment Method</Text>
          <View style={styles.methodGrid}>{methods.map(item => <Method key={item.value} label={item.label} icon={item.icon} active={method === item.value} onPress={() => setMethod(item.value)} />)}</View>
        </View>
        <Input label="Note (optional)" icon="document-text-outline" value={note} onChangeText={setNote} placeholder="Reference or reason" />
      </Card>
      <Button title={busy ? 'Saving…' : 'Record Payment Sent'} icon="checkmark-circle-outline" onPress={save} disabled={busy || !selected || Number(amount) <= 0 || Number(amount) > maximum} />
      <Text style={styles.footerHelp}>This reduces only the selected person's I Owe balance.</Text>
    </Screen>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.active, pressed && styles.pressed]}><Text style={[styles.chipText, active && styles.activeText]}>{label}</Text></Pressable>;
}

function Method({ label, icon, active, onPress }: { label: string; icon: React.ComponentProps<typeof Icon>['name']; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.method, active && styles.methodActive]}><Icon name={icon} size={22} color={active ? colors.primary : colors.muted} /><Text style={[styles.methodText, active && styles.methodTextActive]}>{label}</Text>{active ? <View style={styles.check}><Icon name="checkmark" size={12} color={colors.onPrimary} /></View> : null}</Pressable>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 40, justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 14 },
  active: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  pressed: { opacity: 0.7 },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  activeText: { color: colors.onPrimary },
  balanceCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, backgroundColor: colors.successSoft, borderColor: colors.primaryBorder },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.success, fontSize: 15, fontWeight: '900' },
  flex: { flex: 1, gap: 3 },
  selectedName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  help: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  amountRight: { alignItems: 'flex-end', gap: spacing.sm },
  fullAmount: { color: colors.primary, fontSize: 11, fontWeight: '900', textDecorationLine: 'underline' },
  formCard: { gap: spacing.md },
  methodGroup: { gap: spacing.sm },
  label: { color: colors.textSoft, fontSize: 13, fontWeight: '800' },
  methodGrid: { flexDirection: 'row', gap: spacing.sm },
  method: { flex: 1, minHeight: 76, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 5 },
  methodActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  methodText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  methodTextActive: { color: colors.primary },
  check: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primaryButton, alignItems: 'center', justifyContent: 'center' },
  footerHelp: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
