import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Badge, Card, Icon, Loading, Message, Screen, Title } from '@/components/ui';
import { apiFetch, cachedGet, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Notification, Paginated } from '@/types';

export default function NotificationsScreen() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const result = await cachedGet<Paginated<Notification>>('/notifications/?is_resolved=false&page_size=100');
      setItems(result.data.results);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const markRead = async (item: Notification) => {
    if (item.is_read) return;
    try {
      await apiFetch(`/notifications/${item.id}/mark_read/`, { method: 'POST', body: '{}' });
      setItems(current => current.map(value => value.id === item.id ? { ...value, is_read: true } : value));
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  };
  if (loading) return <Screen scroll={false}><Loading /></Screen>;
  const unread = items.filter(item => !item.is_read).length;
  return (
    <Screen>
      <Title eyebrow="Store activity" subtitle="Stock, balances, payments and generated reports">Notifications</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <View style={styles.summary}><View style={styles.summaryIcon}><Icon name="notifications-outline" size={23} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.summaryTitle}>{unread} unread notification{unread === 1 ? '' : 's'}</Text><Text style={styles.summaryText}>Tap an unread notification to mark it as read.</Text></View><Badge label={`${items.length} ACTIVE`} tone="primary" /></View>
      {items.length ? (
        <Card style={styles.listCard}>
          {items.map((item, index) => {
            const icon = notificationIcon(item.notification_type, item.title);
            return (
              <Pressable key={item.id} onPress={() => markRead(item)} style={({ pressed }) => [styles.row, index > 0 && styles.borderTop, !item.is_read && styles.unread, pressed && styles.pressed]}>
                <View style={[styles.icon, !item.is_read && styles.iconUnread]}><Icon name={icon} size={21} color={!item.is_read ? colors.primary : colors.muted} /></View>
                <View style={styles.flex}><View style={styles.titleRow}><Text style={styles.title}>{item.title}</Text>{!item.is_read ? <View style={styles.dot} /> : null}</View><Text style={styles.message}>{item.message}</Text><Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text></View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            );
          })}
        </Card>
      ) : <Message text="No active notifications." tone="success" />}
    </Screen>
  );
}

function notificationIcon(type: string, title: string): React.ComponentProps<typeof Icon>['name'] {
  const value = `${type} ${title}`.toLowerCase();
  if (value.includes('stock')) return 'cube-outline';
  if (value.includes('payment')) return 'wallet-outline';
  if (value.includes('report')) return 'document-text-outline';
  if (value.includes('overdue') || value.includes('debt')) return 'warning-outline';
  return 'notifications-outline';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg, padding: spacing.md },
  summaryIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  summaryText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  listCard: { paddingVertical: 0, overflow: 'hidden' },
  row: { minHeight: 90, flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, paddingVertical: spacing.mdSm, paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm },
  borderTop: { borderTopWidth: 1, borderTopColor: colors.border },
  unread: { backgroundColor: colors.successSoft },
  icon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  iconUnread: { backgroundColor: colors.surface },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontWeight: '900', fontSize: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryButton },
  message: { color: colors.textSoft, fontSize: 12, lineHeight: 17, marginTop: 4 },
  date: { color: colors.muted, fontSize: 10, marginTop: 5 },
  pressed: { opacity: 0.65 },
});
