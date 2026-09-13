import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { localizedAlert, Text } from '@/i18n';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Icon, Input, Loading, Message, Money, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Party } from '@/types';

export default function CustomerEditScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const [data, setData] = useState<Party | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setData(await apiFetch<Party>(`/parties/${partyId}/`)); } catch (nextError) { setError(errorMessage(nextError)); } }, [partyId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!data) return <Screen scroll={false}><Loading /></Screen>;

  const update = <K extends keyof Party>(key: K, value: Party[K]) => setData(current => current ? { ...current, [key]: value } : current);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/parties/${partyId}/`, { method: 'PATCH', body: JSON.stringify({ party_type: data.party_type, name: data.name, company: data.company, phone: data.phone, address: data.address, notes: data.notes, sms_enabled: data.party_type === 'factory' ? false : data.sms_enabled }) });
      router.back();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  const label = data.party_type === 'factory' ? 'Factory' : data.party_type === 'agent' ? 'Agent' : 'Trader';
  const archiveMessage = data.party_type === 'factory'
    ? 'Settle its balance and archive or move all active Products first. Financial history remains available.'
    : 'Settle its balance first. Financial history remains available and cannot be deleted.';
  const archive = () => localizedAlert(`Archive ${label.toLowerCase()}?`, archiveMessage, [{ text: 'Cancel' }, { text: 'Archive', style: 'destructive', onPress: async () => { try { await apiFetch(`/parties/${partyId}/`, { method: 'DELETE' }); router.back(); } catch (nextError) { setError(errorMessage(nextError)); } } }]);
  const balanceColor = data.balance_color === 'red' ? colors.danger : data.balance_color === 'green' ? colors.success : colors.neutral;

  return (
    <Screen>
      <Title eyebrow={`${label} profile`} subtitle="Update contact and reference information">Edit {label}</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <Card style={styles.identityCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(data.name)}</Text></View>
        <View style={styles.identityCopy}><View style={styles.nameRow}><Text style={styles.name}>{data.name}</Text><Badge label={data.party_type.toUpperCase()} tone={data.party_type === 'agent' ? 'success' : 'primary'} /></View><Text style={[styles.balanceLabel, { color: balanceColor }]}>{data.balance_label.toUpperCase()}</Text></View>
        <Money value={data.balance_amount} color={balanceColor} size="small" />
      </Card>

      <Card style={styles.formCard}>
        <SectionHeader title={data.party_type === 'factory' ? 'Factory details' : 'Contact'} />
        <Input label={data.party_type === 'factory' ? 'Factory Name' : 'Contact Name'} icon={data.party_type === 'factory' ? 'business-outline' : 'person-outline'} value={data.name} onChangeText={value => update('name', value)} />
        <Input label={data.party_type === 'factory' ? 'Contact Person' : 'Company'} icon="business-outline" value={data.company} onChangeText={value => update('company', value)} />
        <Input label={`Phone${data.party_type === 'factory' ? ' (optional)' : ''}`} icon="call-outline" value={data.phone} onChangeText={value => update('phone', value)} keyboardType="phone-pad" />
      </Card>

      <Card style={styles.formCard}>
        <SectionHeader title="Additional details" />
        <Input label="Address" icon="location-outline" value={data.address} onChangeText={value => update('address', value)} />
        <Input label="Notes" icon="document-text-outline" value={data.notes} onChangeText={value => update('notes', value)} multiline />
      </Card>

      <Button title={busy ? 'Saving…' : 'Save Changes'} icon="checkmark-circle-outline" onPress={save} disabled={busy} />
      <View style={styles.dangerZone}>
        <View style={styles.dangerCopy}><Text style={styles.dangerTitle}>Archive this {label.toLowerCase()}</Text><Text style={styles.dangerText}>{data.party_type === 'factory' ? 'Requires a zero balance and no active Products.' : 'Requires a zero balance. History is preserved.'}</Text></View>
        <Button title="Archive" icon="archive-outline" compact variant="danger" onPress={archive} />
      </View>
    </Screen>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

const styles = StyleSheet.create({
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 17, fontWeight: '900' },
  identityCopy: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  name: { color: colors.text, fontSize: 17, fontWeight: '900' },
  balanceLabel: { fontSize: 11, letterSpacing: 0.5, fontWeight: '900', marginTop: 5 },
  formCard: { gap: spacing.md },
  dangerZone: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerBorder, borderRadius: radius.lg, padding: spacing.md },
  dangerCopy: { flex: 1 },
  dangerTitle: { color: colors.danger, fontSize: 14, fontWeight: '900' },
  dangerText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
});
