import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/i18n';
import { useFocusEffect } from 'expo-router';
import { Badge, Card, Icon, Loading, Message, Money, Screen, Title } from '@/components/ui';
import { cachedGet, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Paginated } from '@/types';

type Log = { id: number; party_name: string; phone: string; outstanding_amount: string; reminder_date: string; status: string; error_message: string; created_at: string };

export default function SMSLogsScreen() {
  const [items, setItems] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const result = await cachedGet<Paginated<Log>>('/sms-logs/?page_size=100');
      setItems(result.data.results);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (loading) return <Screen scroll={false}><Loading /></Screen>;
  const sent = items.filter(item => item.status === 'sent').length;
  const failed = items.filter(item => item.status === 'failed').length;
  const pending = items.length - sent - failed;
  return (
    <Screen>
      <Title eyebrow="Communication audit" subtitle="Debt reminder delivery attempts and results">SMS Logs</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <View style={styles.summaryGrid}><Summary icon="paper-plane-outline" label="Sent" value={sent} tone="success" /><Summary icon="alert-circle-outline" label="Failed" value={failed} tone="danger" /><Summary icon="time-outline" label="Pending" value={pending} tone="warning" /></View>
      {items.length ? (
        <Card style={styles.listCard}>
          {items.map((item, index) => {
            const tone = item.status === 'sent' ? 'success' : item.status === 'failed' ? 'danger' : 'warning';
            return (
              <View key={item.id} style={[styles.row, index > 0 && styles.borderTop]}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials(item.party_name)}</Text></View>
                <View style={styles.flex}><Text style={styles.name}>{item.party_name}</Text><Text style={styles.small}>{item.phone} · reminder {item.reminder_date}</Text>{item.error_message ? <View style={styles.errorBox}><Icon name="alert-circle-outline" size={16} color={colors.danger} /><Text style={styles.error}>{item.error_message}</Text></View> : null}</View>
                <View style={styles.right}><Badge label={item.status.toUpperCase()} tone={tone} /><Money value={item.outstanding_amount} size="small" /></View>
              </View>
            );
          })}
        </Card>
      ) : <Message text="No SMS reminders have been attempted yet." />}
    </Screen>
  );
}

function Summary({ icon, label, value, tone }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; value: number; tone: 'success' | 'danger' | 'warning' }) {
  const color = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : colors.warning;
  const background = tone === 'success' ? colors.successSoft : tone === 'danger' ? colors.dangerSoft : colors.warningSoft;
  return <Card style={styles.summary}><View style={[styles.summaryIcon, { backgroundColor: background }]}><Icon name={icon} size={20} color={color} /></View><Text style={[styles.summaryValue, { color }]}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></Card>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summaryGrid: { flexDirection: 'row', gap: spacing.sm },
  summary: { flex: 1, minHeight: 112, padding: spacing.mdSm, alignItems: 'center', justifyContent: 'center', gap: 3 },
  summaryIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '900' },
  summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  listCard: { paddingVertical: 0 },
  row: { minHeight: 90, flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, paddingVertical: spacing.mdSm },
  borderTop: { borderTopWidth: 1, borderTopColor: colors.border },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  name: { color: colors.text, fontSize: 14, fontWeight: '900' },
  small: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  right: { alignItems: 'flex-end', gap: spacing.sm },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
  error: { flex: 1, color: colors.danger, fontSize: 10, lineHeight: 14, fontWeight: '700' },
});
