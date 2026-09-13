import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { localizedAlert, Text } from '@/i18n';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Button, Card, Icon, IconName, Message, Screen, SectionHeader, Title } from '@/components/ui';
import { API_URL, errorMessage, getAuthHeaders } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';

const DATASETS: { value: 'transactions' | 'sales' | 'payments' | 'purchases' | 'expenses' | 'products' | 'parties' | 'stock_movements'; label: string; icon: IconName }[] = [
  { value: 'transactions', label: 'Transactions', icon: 'swap-horizontal-outline' },
  { value: 'sales', label: 'Sales', icon: 'cart-outline' },
  { value: 'payments', label: 'Payments', icon: 'wallet-outline' },
  { value: 'purchases', label: 'Purchases', icon: 'bag-handle-outline' },
  { value: 'expenses', label: 'Expenses', icon: 'receipt-outline' },
  { value: 'products', label: 'Products', icon: 'cube-outline' },
  { value: 'parties', label: 'Customers', icon: 'people-outline' },
  { value: 'stock_movements', label: 'Stock', icon: 'layers-outline' },
];

export default function DataExportScreen() {
  const [dataset, setDataset] = useState<typeof DATASETS[number]['value']>('transactions');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const download = async (kind: 'csv' | 'backup') => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const query = kind === 'csv' ? `?dataset=${dataset}` : '';
      const url = `${API_URL}/exports/${kind}/${query}`;
      const extension = kind === 'csv' ? 'csv' : 'json';
      const filename = kind === 'csv' ? `storeledger-${dataset}.${extension}` : `storeledger-full-backup.${extension}`;
      const headers = await getAuthHeaders();
      if (Platform.OS === 'web') {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error('Export failed.');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      } else {
        const result = await FileSystem.downloadAsync(url, `${FileSystem.documentDirectory}${filename}`, { headers });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri); else localizedAlert('Export saved', result.uri);
      }
      setSuccess(`${filename} is ready.`);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Title eyebrow="Data ownership" subtitle="Owner-controlled portable copies of your store data">Export & Backup</Title>
      {error ? <Message text={error} tone="error" /> : null}
      {success ? <Message text={success} tone="success" /> : null}
      <Card style={styles.exportCard}>
        <View style={styles.cardTop}><View style={styles.fileIcon}><Icon name="document-text-outline" size={25} color={colors.primary} /></View><View style={styles.flex}><SectionHeader title="CSV Export" subtitle="Choose one dataset for spreadsheet analysis" /></View></View>
        <View style={styles.datasetGrid}>{DATASETS.map(item => <Pressable key={item.value} onPress={() => setDataset(item.value)} style={[styles.dataset, dataset === item.value && styles.datasetActive]}><Icon name={item.icon} size={22} color={dataset === item.value ? colors.primary : colors.muted} /><Text style={[styles.datasetText, dataset === item.value && styles.datasetTextActive]}>{item.label}</Text>{dataset === item.value ? <View style={styles.check}><Icon name="checkmark" size={11} color={colors.onPrimary} /></View> : null}</Pressable>)}</View>
        <Button title={busy ? 'Preparing…' : 'Download CSV'} icon="download-outline" variant="secondary" onPress={() => download('csv')} disabled={busy} />
      </Card>

      <Card style={styles.exportCard}>
        <View style={styles.cardTop}><View style={styles.backupIcon}><Icon name="shield-checkmark-outline" size={27} color={colors.success} /></View><View style={styles.flex}><SectionHeader title="Full JSON Backup" subtitle="A complete, store-scoped portable copy" /></View></View>
        <Text style={styles.description}>Includes master data, ledgers, stock movements, expenses, purchases, reports, notifications, SMS logs and audit events. Passwords are never included.</Text>
        <Button title={busy ? 'Preparing…' : 'Download Full Backup'} icon="cloud-download-outline" onPress={() => download('backup')} disabled={busy} />
      </Card>
      <Message text="Restore is deliberately not automatic. A backup should only be imported through a validated migration to prevent duplicate financial postings." tone="warning" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  exportCard: { gap: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  fileIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  backupIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  datasetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dataset: { width: '23%', minHeight: 86, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 6, padding: spacing.sm },
  datasetActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  datasetText: { color: colors.muted, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  datasetTextActive: { color: colors.primary },
  check: { position: 'absolute', top: 5, right: 5, width: 17, height: 17, borderRadius: 9, backgroundColor: colors.primaryButton, alignItems: 'center', justifyContent: 'center' },
  description: { color: colors.textSoft, fontSize: 12, lineHeight: 18 },
});
