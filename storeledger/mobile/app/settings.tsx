import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Badge, Button, Card, Icon, IconName, Input, Loading, Message, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';

type Settings = {
  store: { name: string; currency: string; timezone: string; account_number: string };
  store_name: string;
  store_phone: string;
  store_address: string;
  store_account_number: string;
  store_currency: string;
  store_timezone: string;
  default_low_stock_threshold: string;
  prevent_negative_inventory: boolean;
  sms_enabled: boolean;
  sms_reminder_time: string;
  sms_provider: string;
  sms_account_number: string;
  automated_reports_enabled: boolean;
  daily_report_time: string;
  weekly_report_day: number;
  weekly_report_time: string;
  monthly_report_time: string;
  overdue_days: number;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SettingsScreen() {
  const [data, setData] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Settings>('/settings/'));
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setData(current => current ? { ...current, [key]: value } : current);
  const save = async () => {
    if (!data) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const payload = { ...data };
      delete (payload as Partial<Settings>).store;
      setData(await apiFetch<Settings>('/settings/', { method: 'PATCH', body: JSON.stringify(payload) }));
      setSuccess('Settings saved.');
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  const runNow = async (job: 'sms' | 'daily' | 'weekly' | 'monthly') => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await apiFetch<{ result?: { sent: number; failed: number; disabled: boolean }; id?: number }>('/automations/run-now/', { method: 'POST', body: JSON.stringify({ job }) });
      setSuccess(job === 'sms' ? `SMS test complete: ${result.result?.sent || 0} sent, ${result.result?.failed || 0} failed${result.result?.disabled ? ' (SMS is disabled)' : ''}.` : `${job} report generated successfully.`);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  if (loading || !data) return <Screen scroll={false}><Loading /></Screen>;
  return (
    <Screen>
      <Title eyebrow="Administration" subtitle="Store details, business rules and scheduled automations">Settings</Title>
      {error ? <Message text={error} tone="error" /> : null}
      {success ? <Message text={success} tone="success" /> : null}
      <Card style={styles.storeSummary}>
        <View style={styles.storeIcon}><Icon name="storefront-outline" size={25} color={colors.primary} /></View>
        <View style={styles.flex}><Text style={styles.storeName}>{data.store_name}</Text><Text style={styles.storeMeta}>{data.store_currency} · {data.store_timezone}</Text>{data.store_account_number ? <Text style={styles.storeMeta}>Account {data.store_account_number}</Text> : null}</View>
        <Badge label="ACTIVE" tone="success" />
      </Card>

      <Card style={styles.formCard}>
        <SectionTitle icon="storefront-outline" title="Store details" subtitle="Identity and contact information" />
        <Input label="Store Name" icon="storefront-outline" value={data.store_name} onChangeText={value => update('store_name', value)} />
        <Input label="Phone" icon="call-outline" value={data.store_phone} onChangeText={value => update('store_phone', value)} keyboardType="phone-pad" />
        <Input label="Address" icon="location-outline" value={data.store_address} onChangeText={value => update('store_address', value)} />
        <Input label="Account Number" icon="card-outline" value={data.store_account_number} onChangeText={value => update('store_account_number', value)} />
        <View style={styles.row}><View style={styles.flex}><Input label="Currency" icon="cash-outline" value={data.store_currency} onChangeText={value => update('store_currency', value.toUpperCase())} maxLength={3} /></View><View style={styles.flexWide}><Input label="Timezone" icon="time-outline" value={data.store_timezone} onChangeText={value => update('store_timezone', value)} /></View></View>
      </Card>

      <Card style={styles.formCard}>
        <SectionTitle icon="cube-outline" title="Inventory & aging" subtitle="Stock protection and overdue rules" />
        <View style={styles.row}><View style={styles.flex}><Input label="Default Low-stock Threshold" icon="warning-outline" value={data.default_low_stock_threshold} onChangeText={value => update('default_low_stock_threshold', value)} keyboardType="decimal-pad" /></View><View style={styles.flex}><Input label="Overdue After Days" icon="hourglass-outline" value={String(data.overdue_days)} onChangeText={value => update('overdue_days', Number(value) || 0)} keyboardType="number-pad" /></View></View>
        <Toggle icon="remove-circle-outline" label="Prevent Negative Inventory" description="Block sales that exceed available stock" value={data.prevent_negative_inventory} onChange={value => update('prevent_negative_inventory', value)} />
      </Card>

      <Card style={styles.formCard}>
        <SectionTitle icon="chatbox-ellipses-outline" title="SMS Reminders" subtitle="Automated debt reminders to customers" />
        <Toggle icon="notifications-outline" label="Enable Daily SMS" description="Send reminders at the configured time" value={data.sms_enabled} onChange={value => update('sms_enabled', value)} />
        <Input label="Reminder Time (HH:MM:SS)" icon="time-outline" value={data.sms_reminder_time} onChangeText={value => update('sms_reminder_time', value)} />
        <View style={styles.group}><Text style={styles.label}>Provider</Text><View style={styles.chips}><Choice label="Console test" active={data.sms_provider === 'console'} onPress={() => update('sms_provider', 'console')} /><Choice label="HTTP provider" active={data.sms_provider === 'http'} onPress={() => update('sms_provider', 'http')} /></View></View>
        <Input label="Payment Account Number" icon="card-outline" value={data.sms_account_number} onChangeText={value => update('sms_account_number', value)} />
        <Message text="Console test mode records the full SMS workflow without charging or contacting customers." />
        <Button title={busy ? 'Running…' : 'Send Debt Reminders Now'} icon="paper-plane-outline" variant="secondary" onPress={() => runNow('sms')} disabled={busy} />
      </Card>

      <Card style={styles.formCard}>
        <SectionTitle icon="bar-chart-outline" title="Automated Reports" subtitle="Daily, weekly and monthly report schedules" />
        <Toggle icon="document-text-outline" label="Automated Reports" description="Generate reports on the schedule below" value={data.automated_reports_enabled} onChange={value => update('automated_reports_enabled', value)} />
        <Input label="Daily Report Time" icon="sunny-outline" value={data.daily_report_time} onChangeText={value => update('daily_report_time', value)} />
        <View style={styles.group}><Text style={styles.label}>Weekly Report Day</Text><View style={styles.chips}>{DAYS.map((day, index) => <Choice key={day} label={day.slice(0, 3)} active={data.weekly_report_day === index} onPress={() => update('weekly_report_day', index)} />)}</View></View>
        <Input label="Weekly Report Time" icon="calendar-outline" value={data.weekly_report_time} onChangeText={value => update('weekly_report_time', value)} />
        <Input label="Monthly Report Time" icon="calendar-number-outline" value={data.monthly_report_time} onChangeText={value => update('monthly_report_time', value)} />
        <View style={styles.runRow}><RunButton label="Daily now" onPress={() => runNow('daily')} /><RunButton label="Weekly now" onPress={() => runNow('weekly')} /><RunButton label="Monthly now" onPress={() => runNow('monthly')} /></View>
      </Card>
      <Button title={busy ? 'Working…' : 'Save Settings'} icon="checkmark-circle-outline" onPress={save} disabled={busy} />
    </Screen>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: IconName; title: string; subtitle: string }) {
  return <View style={styles.sectionTitle}><View style={styles.sectionIcon}><Icon name={icon} size={21} color={colors.primary} /></View><View style={styles.flex}><SectionHeader title={title} subtitle={subtitle} /></View></View>;
}

function Toggle({ icon, label, description, value, onChange }: { icon: IconName; label: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.toggle}><View style={styles.toggleIcon}><Icon name={icon} size={20} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.toggleLabel}>{label}</Text><Text style={styles.toggleDescription}>{description}</Text></View><Switch value={value} onValueChange={onChange} trackColor={{ false: colors.borderStrong, true: colors.primaryBorder }} thumbColor={value ? colors.primaryButton : colors.surface} /></View>;
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.active]}><Text style={[styles.chipText, active && styles.activeText]}>{label}</Text></Pressable>;
}

function RunButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.runButton, pressed && styles.pressed]}><Icon name="play-outline" size={16} color={colors.primary} /><Text style={styles.runText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexWide: { flex: 1.45 },
  storeSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  storeIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  storeName: { color: colors.text, fontSize: 17, fontWeight: '900' },
  storeMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  formCard: { gap: spacing.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  sectionIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  group: { gap: spacing.sm },
  label: { color: colors.textSoft, fontSize: 13, fontWeight: '800' },
  toggle: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, paddingVertical: spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  toggleIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  toggleLabel: { color: colors.text, fontSize: 13, fontWeight: '900' },
  toggleDescription: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 38, justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 13, backgroundColor: colors.surface },
  active: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  chipText: { color: colors.textSoft, fontSize: 11, fontWeight: '800' },
  activeText: { color: colors.onPrimary },
  runRow: { flexDirection: 'row', gap: spacing.sm },
  runButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.primarySoft, borderRadius: radius.sm },
  runText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.65 },
});
