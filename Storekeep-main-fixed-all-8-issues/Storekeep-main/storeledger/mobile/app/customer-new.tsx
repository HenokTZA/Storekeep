import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Icon, Input, Message, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';

export default function NewCustomerScreen() {
  const { type = 'trader' } = useLocalSearchParams<{ type: 'trader' | 'agent' | 'factory' }>();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const label = type === 'factory' ? 'Factory' : type === 'trader' ? 'Trader' : 'Agent';

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/parties/', { method: 'POST', body: JSON.stringify({ party_type: type, name, company, phone, address, notes, sms_enabled: type !== 'factory' }) });
      router.back();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Title eyebrow="People" subtitle={type === 'factory' ? 'Add a stock source and Factory payable ledger' : `Create a new ${label.toLowerCase()} profile and financial ledger`}>Add {label}</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <View style={styles.typeRow}>
        <View style={styles.typeIcon}><Icon name={type === 'factory' ? 'business-outline' : type === 'agent' ? 'people-outline' : 'person-outline'} size={22} color={colors.primary} /></View>
        <View style={styles.typeCopy}><Text style={styles.typeTitle}>New {label}</Text><Text style={styles.typeText}>{type === 'factory' ? 'Products and purchases will be organized under this factory.' : type === 'agent' ? 'Agent pricing defaults apply, with a per-sale override when needed.' : 'Track sales, payments and running balances.'}</Text></View>
        <Badge label={label.toUpperCase()} tone={type === 'agent' ? 'success' : 'primary'} />
      </View>

      <Card style={styles.formCard}>
        <SectionHeader title={type === 'factory' ? 'Factory details' : 'Contact'} subtitle={type === 'factory' ? 'Factory name is required; contact details are optional' : 'The name and phone number are required'} />
        <Input label={type === 'factory' ? 'Factory Name' : 'Contact Name'} icon={type === 'factory' ? 'business-outline' : 'person-outline'} value={name} onChangeText={setName} placeholder={type === 'factory' ? 'e.g. FF' : 'Full name'} />
        <Input label={type === 'factory' ? 'Contact Person (optional)' : 'Company (optional)'} icon="business-outline" value={company} onChangeText={setCompany} placeholder={type === 'factory' ? 'Factory representative' : 'Company or shop name'} />
        <Input label={`Phone Number${type === 'factory' ? ' (optional)' : ''}`} icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="09…" />
      </Card>

      <Card style={styles.formCard}>
        <SectionHeader title="Additional details" subtitle="Optional information for delivery and reference" />
        <Input label="Address (optional)" icon="location-outline" value={address} onChangeText={setAddress} placeholder="Area, city" />
        <Input label="Notes (optional)" icon="document-text-outline" value={notes} onChangeText={setNotes} multiline placeholder="Add relevant notes" />
      </Card>

      {type === 'agent' ? <Message text="Sales are 1.875% below the entered price. You can edit the base price for an individual sale." tone="success" /> : null}
      {type === 'factory' ? <Message text="Products with the same name can be stored separately when they belong to different factories." tone="success" /> : null}
      <Button title={busy ? 'Saving…' : `Save ${label}`} icon="checkmark-circle-outline" onPress={save} disabled={busy || !name.trim() || (type !== 'factory' && !phone.trim())} />
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
