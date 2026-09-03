import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Icon, Input, Message, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';

export default function CreditScreen() {
  const { partyId, name } = useLocalSearchParams<{ partyId: string; name: string }>();
  const [direction, setDirection] = useState<'owes_me' | 'i_owe'>('owes_me');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/parties/${partyId}/credit/`, { method: 'POST', body: JSON.stringify({ direction, amount, note }) });
      Alert.alert('Balance updated', 'A permanent ledger entry was added.');
      router.back();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Title eyebrow="Manual ledger entry" subtitle="Record a credit or loan without creating a sale">Credit / Loan</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <Card style={styles.personCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(name)}</Text></View>
        <View style={styles.flex}><Text style={styles.personName}>{name}</Text><Text style={styles.small}>This entry will change this person's running balance.</Text></View>
      </Card>

      <SectionHeader title="Direction" subtitle="Choose whose balance increases" />
      <View style={styles.row}>
        <Choice icon="person-outline" label="Customer Owes Me" description="Money owed to your store" active={direction === 'owes_me'} tone="danger" onPress={() => setDirection('owes_me')} />
        <Choice icon="storefront-outline" label="I Owe Customer" description="Money your store owes" active={direction === 'i_owe'} tone="success" onPress={() => setDirection('i_owe')} />
      </View>

      <Card style={styles.formCard}>
        <Input label="Amount" icon="cash-outline" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
        <Input label="Reason / Note" icon="document-text-outline" value={note} onChangeText={setNote} multiline placeholder="Explain why this entry is being created" />
      </Card>
      <Message text="This creates a permanent financial ledger entry and is included in reports." tone="warning" />
      <Button title={busy ? 'Saving…' : 'Record Credit / Loan'} icon="checkmark-circle-outline" onPress={save} disabled={busy || Number(amount) <= 0 || !note} />
    </Screen>
  );
}

function Choice({ icon, label, description, active, tone, onPress }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; description: string; active: boolean; tone: 'danger' | 'success'; onPress: () => void }) {
  const color = tone === 'danger' ? colors.danger : colors.success;
  const background = tone === 'danger' ? colors.dangerSoft : colors.successSoft;
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && { borderColor: color, backgroundColor: background }]}>
      <View style={[styles.choiceIcon, { backgroundColor: active ? colors.surface : background }]}><Icon name={icon} size={25} color={color} /></View>
      <Text style={[styles.choiceText, active && { color }]}>{label}</Text>
      <Text style={styles.choiceDescription}>{description}</Text>
      {active ? <View style={[styles.check, { backgroundColor: color }]}><Icon name="checkmark" size={12} color={colors.onPrimary} /></View> : null}
    </Pressable>
  );
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

const styles = StyleSheet.create({
  personCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  flex: { flex: 1 },
  personName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  small: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  row: { flexDirection: 'row', gap: spacing.sm },
  choice: { flex: 1, minHeight: 160, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, padding: spacing.mdSm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  choiceIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  choiceText: { textAlign: 'center', color: colors.text, fontSize: 13, fontWeight: '900' },
  choiceDescription: { textAlign: 'center', color: colors.muted, fontSize: 10, lineHeight: 14 },
  check: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  formCard: { gap: spacing.md },
});
