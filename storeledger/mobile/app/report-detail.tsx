import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/i18n';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Badge, Card, Icon, Loading, Message, Screen, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Report } from '@/types';

export default function ReportDetailScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => { try { setReport(await apiFetch<Report>(`/reports/${reportId}/`)); } catch (nextError) { setError(errorMessage(nextError)); } }, [reportId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!report) return <Screen scroll={false}><Loading /></Screen>;
  const summary = report.summary as Record<string, unknown>;
  return <Screen><Title eyebrow="Generated report" subtitle={`${report.period_start} to ${report.period_end} · version ${report.version}`}>{report.report_type.toUpperCase()} Report</Title>{error ? <Message text={error} tone="error" /> : null}<Card style={styles.reportHeader}><View style={styles.reportIcon}><Icon name="document-text-outline" size={25} color={colors.success} /></View><View style={styles.headerCopy}><Text style={styles.headerTitle}>{report.report_type.toUpperCase()} REPORT</Text><Text style={styles.headerMeta}>{report.period_start} – {report.period_end}</Text></View><Badge label={report.status.toUpperCase()} tone={report.status === 'ready' ? 'success' : 'warning'} /></Card>{Object.entries(summary).filter(([key]) => key !== 'period').map(([key, value]) => <Section key={key} title={key.replaceAll('_', ' ')} value={value} />)}</Screen>;
}

function Section({ title, value }: { title: string; value: unknown }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  const scalars = entries.filter(([, item]) => item === null || ['string', 'number', 'boolean'].includes(typeof item));
  const objects = entries.filter(([, item]) => item && typeof item === 'object' && !Array.isArray(item)) as [string, Record<string, unknown>][];
  const lists = entries.filter(([, item]) => Array.isArray(item) && item.length) as [string, Record<string, unknown>[]][];
  return <Card><View style={styles.sectionHeading}><View style={styles.sectionIcon}><Icon name="analytics-outline" size={19} color={colors.primary} /></View><Text style={styles.heading}>{title.toUpperCase()}</Text></View>{scalars.map(([key, item]) => <View key={key} style={styles.row}><Text style={styles.label}>{key.replaceAll('_', ' ')}</Text><Text style={styles.value}>{String(item ?? '-')}</Text></View>)}{objects.map(([key, item]) => <View key={key} style={styles.item}><Text style={styles.subheading}>{key.replaceAll('_', ' ')}</Text>{Object.entries(item).map(([childKey, child]) => <Text key={childKey} style={styles.itemText}><Text style={styles.itemKey}>{childKey.replaceAll('_', ' ')}: </Text>{String(child)}</Text>)}</View>)}{lists.map(([key, items]) => <View key={key} style={styles.list}><Text style={styles.subheading}>{key.replaceAll('_', ' ')}</Text>{items.slice(0, 250).map((item, index) => <View key={`${key}-${index}`} style={styles.item}>{Object.entries(item).filter(([, child]) => ['string', 'number', 'boolean'].includes(typeof child)).map(([childKey, child]) => <Text key={childKey} style={styles.itemText}><Text style={styles.itemKey}>{childKey.replaceAll('_', ' ')}: </Text>{String(child)}</Text>)}</View>)}</View>)}</Card>;
}
const styles = StyleSheet.create({ reportHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm }, reportIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1 }, headerTitle: { color: colors.text, fontSize: 15, fontWeight: '900' }, headerMeta: { color: colors.muted, fontSize: 11, marginTop: 3 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }, sectionIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, heading: { color: colors.text, fontWeight: '900', fontSize: 17 }, subheading: { color: colors.primary, fontWeight: '900', textTransform: 'capitalize', marginTop: spacing.md }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border }, label: { color: colors.muted, fontSize: 12, textTransform: 'capitalize', flex: 1 }, value: { color: colors.text, fontSize: 12, fontWeight: '900', textAlign: 'right', flex: 1 }, list: { gap: spacing.sm }, item: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.mdSm, marginTop: spacing.sm }, itemText: { color: colors.text, fontSize: 12, lineHeight: 17, marginVertical: 2 }, itemKey: { color: colors.muted, fontWeight: '800', textTransform: 'capitalize' } });
