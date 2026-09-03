import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Icon, Input, Message, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';

export default function NewCustomerScreen() {
  const { type = 'trader' } = useLocalSearchParams<{ type: 'trader' | 'agent' }>();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [account, setAccount] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const label = type === 'trader' ? 'Trader' : 'Agent';

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/parties/', { method: 'POST', body: JSON.stringify({ party_type: type, name, company, phone, account_number: account, address, notes, sms_enabled: true }) });
      router.back();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title eyebrow="People" subtitle={`Create a new ${label.toLowerCase()} profile and financial ledger`}>Add {label}</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <View style={styles.typeRow}>
        <View style={styles.typeIcon}><Icon name={type === 'agent' ? 'people-outline' : 'person-outline'} size={22} color={colors.primary} /></View>
        <View style={styles.typeCopy}><Text style={styles.typeTitle}>New {label}</Text><Text style={styles.typeText}>{type === 'agent' ? 'Agent pricing will apply automatically to future sales.' : 'Track sales, payments and running balances.'}</Text></View>
        <Badge label={label.toUpperCase()} tone={type === 'agent' ? 'success' : 'primary'} />
      </View>

      <Card style={styles.formCard}>
        <SectionHeader title="Contact" subtitle="The name and phone number are required" />
        <Input label="Contact Name" icon="person-outline" value={name} onChangeText={setName} placeholder="Full name" />
        <Input label="Company (optional)" icon="business-outline" value={company} onChangeText={setCompany} placeholder="Company or shop name" />
        <Input label="Phone Number" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="09…" />
      </Card>

      <Card style={styles.formCard}>
        <SectionHeader title="Account details" subtitle="Optional information for easy identification" />
        <Input label="Account Number" icon="card-outline" value={account} onChangeText={setAccount} placeholder={`${type === 'agent' ? 'AGT' : 'TRD'}-0001`} />
        <Input label="Address (optional)" icon="location-outline" value={address} onChangeText={setAddress} placeholder="Area, city" />
        <Input label="Notes (optional)" icon="document-text-outline" value={notes} onChangeText={setNotes} multiline placeholder="Add relevant notes" />
      </Card>

      {type === 'agent' ? <Message text="Sales to this agent automatically use a price 1.5% below the standard selling price." tone="success" /> : null}
      <Button title={busy ? 'Saving…' : `Save ${label}`} icon="checkmark-circle-outline" onPress={save} disabled={busy || !name || !phone} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, backgroundColor: colors.primarySoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primaryBorder, padding: spacing.md },
  typeIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  typeCopy: { flex: 1 },
  typeTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  typeText: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  formCard: { gap: spacing.md },
});
