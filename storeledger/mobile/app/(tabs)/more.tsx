import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/i18n';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { Button, Card, Icon, IconName, Screen, SectionHeader, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type LinkItem = { label: string; href: string; icon: IconName; subtitle?: string };

const groups: { title: string; links: LinkItem[] }[] = [
  {
    title: 'Finance',
    links: [
      { label: 'Transactions', href: '/transactions', icon: 'swap-horizontal-outline', subtitle: 'Complete financial ledger' },
      { label: 'Expenses & Budget', href: '/expenses', icon: 'receipt-outline', subtitle: 'Costs, categories and budget' },
      { label: 'Purchases', href: '/purchases', icon: 'bag-handle-outline', subtitle: 'Factory purchases and payables' },
      { label: 'Payment Sent', href: '/outgoing-payment', icon: 'paper-plane-outline', subtitle: 'Settle an I Owe balance' },
      { label: 'Overdue Receivables', href: '/overdue', icon: 'time-outline', subtitle: 'Balances that need attention' },
      { label: 'Reports', href: '/reports', icon: 'bar-chart-outline', subtitle: 'Generate and download reports' },
    ],
  },
  {
    title: 'Operations',
    links: [
      { label: 'Search Everything', href: '/global-search', icon: 'search-outline', subtitle: 'Products, people and records' },
      { label: 'Notifications', href: '/notifications', icon: 'notifications-outline', subtitle: 'Stock, debt and report alerts' },
      { label: 'SMS Logs', href: '/sms-logs', icon: 'chatbox-ellipses-outline', subtitle: 'Reminder delivery history' },
    ],
  },
  {
    title: 'Administration',
    links: [
      { label: 'Export & Backup', href: '/data-export', icon: 'cloud-download-outline', subtitle: 'Portable copies of store data' },
      { label: 'Settings', href: '/settings', icon: 'settings-outline', subtitle: 'Store rules and automations' },
    ],
  },
];

export default function MoreScreen() {
  const { me, store, role, logout } = useAuth();
  const displayName = me?.user.name || me?.user.username || 'Store user';
  return (
    <Screen safeTop>
      <Title subtitle="Finance, operations and store administration">More</Title>
      <Card style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(displayName)}</Text></View>
        <View style={styles.profileCopy}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.role}>{role || 'User'} · {store?.name}</Text>
          <Text style={styles.small}>{store?.currency} · {store?.timezone}</Text>
        </View>
        <View style={styles.roleIcon}><Icon name="storefront-outline" size={20} color={colors.primary} /></View>
      </Card>

      {groups.map(group => (
        <View key={group.title} style={styles.group}>
          <SectionHeader title={group.title} />
          <Card style={styles.linkCard}>
            {group.links.map((item, index) => (
              <Pressable key={item.href} onPress={() => router.push(item.href as never)} style={({ pressed }) => [styles.linkRow, index > 0 && styles.linkBorder, pressed && styles.pressed]}>
                <View style={styles.linkIcon}><Icon name={item.icon} size={21} color={colors.primary} /></View>
                <View style={styles.linkCopy}>
                  <Text style={styles.label}>{item.label}</Text>
                  {item.subtitle ? <Text style={styles.small}>{item.subtitle}</Text> : null}
                </View>
                <Icon name="chevron-forward" size={20} color={colors.muted} />
              </Pressable>
            ))}
          </Card>
        </View>
      ))}

      <Button title="Sign Out" icon="log-out-outline" variant="danger" onPress={async () => { await logout(); router.replace('/login'); }} />
      <Text style={styles.version}>StoreLedger Mobile · Version 2.0.0</Text>
    </Screen>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'SL';
}

const styles = StyleSheet.create({
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  profileCopy: { flex: 1 },
  name: { fontSize: 18, lineHeight: 24, fontWeight: '900', color: colors.text },
  role: { color: colors.textSoft, fontSize: 13, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
  small: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  roleIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  group: { gap: spacing.sm },
  linkCard: { paddingVertical: 0, paddingHorizontal: spacing.md },
  linkRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, paddingVertical: spacing.mdSm },
  linkBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  linkIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  linkCopy: { flex: 1 },
  label: { color: colors.text, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.65 },
  version: { textAlign: 'center', color: colors.muted, fontSize: 11, marginBottom: spacing.md },
});
