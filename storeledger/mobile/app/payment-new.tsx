import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Icon, Input, Loading, Message, Screen, SectionHeader, Title } from '@/components/ui';
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

export default function NewPaymentScreen() {
  const params = useLocalSearchParams<{ partyId?: string; name?: string }>();
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState(params.partyId ? Number(params.partyId) : 0);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(localDate());
  const [method, setMethod] = useState<'cash' | 'bank' | 'mobile' | 'other'>('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!params.partyId);
  const load = useCallback(async () => {
    if (params.partyId) return;
    try {
      const result = await apiFetch<Paginated<Party>>('/parties/?page_size=100');
      setParties(result.results);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [params.partyId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/payments/', { method: 'POST', body: JSON.stringify({ party_id: partyId, amount, payment_date: paymentDate, method, direction: 'received', note, idempotency_key: createUuid() }) });
      Alert.alert('Payment recorded', 'The customer balance and transaction history were updated.');
      router.back();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <Screen scroll={false}><Loading /></Screen>;
  const selected = parties.find(item => item.id === partyId);
  const displayName = params.name || selected?.name || 'Select a customer';

  return (
    <Screen>
      <Title eyebrow="Incoming payment" subtitle="Record money received against an Owes Me balance">Payment Received</Title>
      {error ? <Message text={error} tone="error" /> : null}

      <Card style={styles.customerCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(displayName)}</Text></View>
        <View style={styles.customerCopy}><Text style={styles.customerName}>{displayName}</Text><Text style={styles.small}>Payment reduces this customer's Owes Me balance.</Text></View>
        <Badge label="OWES ME" tone="danger" />
      </Card>

      {!params.partyId ? (
        <View style={styles.group}>
          <SectionHeader title="Customer" subtitle="Choose who made the payment" />
          <View style={styles.chips}>{parties.map(item => <Choice key={item.id} label={item.name} active={partyId === item.id} onPress={() => setPartyId(item.id)} />)}</View>
        </View>
      ) : null}

      <Card style={styles.formCard}>
        <Input label="Amount Received" icon="wallet-outline" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus={Boolean(params.partyId)} placeholder="0.00" />
        <Input label="Payment Date (YYYY-MM-DD)" icon="calendar-outline" value={paymentDate} onChangeText={setPaymentDate} />
        <View style={styles.group}>
          <Text style={styles.label}>Payment Method</Text>
          <View style={styles.methodGrid}>{methods.map(item => <Method key={item.value} label={item.label} icon={item.icon} active={method === item.value} onPress={() => setMethod(item.value)} />)}</View>
        </View>
        <Input label="Note (optional)" icon="document-text-outline" value={note} onChangeText={setNote} placeholder="Reference or reason" />
      </Card>

      <Button title={busy ? 'Saving…' : 'Record Payment'} icon="checkmark-circle-outline" onPress={save} disabled={busy || !partyId || Number(amount) <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)} />
      <Text style={styles.footer}>This creates a permanent transaction and updates the customer balance.</Text>
    </Screen>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.active]}><Text style={[styles.chipText, active && styles.activeText]}>{label}</Text></Pressable>;
}

function Method({ label, icon, active, onPress }: { label: string; icon: React.ComponentProps<typeof Icon>['name']; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.method, active && styles.methodActive]}><Icon name={icon} size={22} color={active ? colors.primary : colors.muted} /><Text style={[styles.methodText, active && styles.methodTextActive]}>{label}</Text>{active ? <View style={styles.check}><Icon name="checkmark" size={12} color={colors.onPrimary} /></View> : null}</Pressable>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

const styles = StyleSheet.create({
  customerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  customerCopy: { flex: 1 },
  customerName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  small: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 40, justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 14 },
  active: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  activeText: { color: colors.onPrimary },
  formCard: { gap: spacing.md },
  label: { color: colors.textSoft, fontSize: 13, fontWeight: '800' },
  methodGrid: { flexDirection: 'row', gap: spacing.sm },
  method: { flex: 1, minHeight: 76, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 5 },
  methodActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  methodText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  methodTextActive: { color: colors.primary },
  check: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primaryButton, alignItems: 'center', justifyContent: 'center' },
  footer: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
