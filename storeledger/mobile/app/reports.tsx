import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { localizedAlert, Text } from '@/i18n';
import { router, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Badge, Button, Card, Icon, Input, Loading, Message, Screen, SearchField, SectionHeader, Title } from '@/components/ui';
import { apiFetch, cachedGet, errorMessage, getAuthHeaders } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Paginated, Report } from '@/types';

type Preset = 'daily' | 'weekly' | 'monthly' | 'custom';
const localDate = (date = new Date()) => { const value = new Date(date); value.setMinutes(value.getMinutes() - value.getTimezoneOffset()); return value.toISOString().slice(0, 10); };

export default function ReportsScreen() {
  const today = localDate();
  const [items, setItems] = useState<Report[]>([]);
  const [preset, setPreset] = useState<Preset>('daily');
  const [periodStart, setPeriodStart] = useState(today);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const result = await cachedGet<Paginated<Report>>('/reports/?page_size=100');
      setItems(result.data.results);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const choosePreset = (value: Preset) => {
    setPreset(value);
    const end = new Date();
    let start = new Date(end);
    if (value === 'weekly') start.setDate(end.getDate() - 6);
    if (value === 'monthly') start = new Date(end.getFullYear(), end.getMonth(), 1);
    if (value !== 'custom') { setPeriodStart(localDate(start)); setPeriodEnd(localDate(end)); }
  };
  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/reports/', { method: 'POST', body: JSON.stringify({ report_type: preset, period_start: periodStart, period_end: periodEnd }) });
      await load();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  const download = async (report: Report, format: 'pdf' | 'excel') => {
    try {
      const url = format === 'pdf' ? report.pdf_url : report.excel_url;
      if (!url) throw new Error('File is not ready.');
      const headers = await getAuthHeaders();
      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      if (Platform.OS === 'web') {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error('Download failed.');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `store-report-${report.id}.${extension}`;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
        return;
      }
      const target = `${FileSystem.documentDirectory}store-report-${report.id}.${extension}`;
      const result = await FileSystem.downloadAsync(url, target, { headers });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri); else localizedAlert('Downloaded', result.uri);
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  };
  const filtered = useMemo(() => items.filter(item => `${item.report_type} ${item.period_start} ${item.period_end}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  if (loading) return <Screen scroll={false}><Loading /></Screen>;
  return (
    <Screen>
      <Title eyebrow="Business intelligence" subtitle="Generate, inspect, download and share historical reports">Reports</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <Card style={styles.generator}>
        <SectionHeader title="Generate new report" subtitle="Choose a period and create a permanent version" />
        <View style={styles.chips}>{(['daily', 'weekly', 'monthly', 'custom'] as Preset[]).map(value => <Pressable key={value} onPress={() => choosePreset(value)} style={[styles.chip, preset === value && styles.active]}><Text style={[styles.chipText, preset === value && styles.activeText]}>{value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}</View>
        <View style={styles.dates}><View style={styles.flex}><Input label="Start Date" icon="calendar-outline" value={periodStart} onChangeText={value => { setPreset('custom'); setPeriodStart(value); }} /></View><View style={styles.flex}><Input label="End Date" icon="calendar-outline" value={periodEnd} onChangeText={value => { setPreset('custom'); setPeriodEnd(value); }} /></View></View>
        <Button title={busy ? 'Generating…' : `Generate ${preset[0].toUpperCase() + preset.slice(1)} Report`} icon="document-text-outline" onPress={generate} disabled={busy || !periodStart || !periodEnd} />
      </Card>

      <SectionHeader title="Historical Reports" subtitle={`${filtered.length} matching report${filtered.length === 1 ? '' : 's'}`} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search by type or date" />
      {filtered.length ? filtered.map(report => {
        const ready = report.status === 'ready';
        return (
          <Card key={report.id}>
            <View style={styles.reportHeader}>
              <View style={[styles.reportIcon, { backgroundColor: ready ? colors.successSoft : colors.warningSoft }]}><Icon name="document-text-outline" size={23} color={ready ? colors.success : colors.warning} /></View>
              <View style={styles.flex}><Text style={styles.name}>{report.report_type.toUpperCase()} REPORT</Text><Text style={styles.small}>{report.period_start} to {report.period_end} · Version {report.version}</Text></View>
              <Badge label={report.status.toUpperCase()} tone={ready ? 'success' : 'warning'} />
            </View>
            {ready ? (
              <View style={styles.actions}>
                <ReportAction icon="eye-outline" label="View" onPress={() => router.push({ pathname: '/report-detail', params: { reportId: String(report.id) } })} />
                <ReportAction icon="document-outline" label="PDF" onPress={() => download(report, 'pdf')} />
                <ReportAction icon="grid-outline" label="Excel" onPress={() => download(report, 'excel')} />
              </View>
            ) : <Text style={styles.processing}>The file is being prepared. Return shortly to download it.</Text>}
          </Card>
        );
      }) : <Message text="No matching historical reports." />}
    </Screen>
  );
}

function ReportAction({ icon, label, onPress }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.reportAction, pressed && styles.pressed]}><Icon name={icon} size={18} color={colors.primary} /><Text style={styles.actionText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  generator: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 38, justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 13, backgroundColor: colors.surface },
  active: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  chipText: { color: colors.textSoft, fontSize: 12, fontWeight: '800' },
  activeText: { color: colors.onPrimary },
  dates: { flexDirection: 'row', gap: spacing.sm },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  reportIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 14, fontWeight: '900' },
  small: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  reportAction: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.primarySoft, borderRadius: radius.sm },
  actionText: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  processing: { color: colors.warning, fontSize: 11, lineHeight: 16, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.65 },
});
