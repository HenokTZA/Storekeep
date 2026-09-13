import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { localizedAlert, Text, useI18n } from '@/i18n';
import { useLocalSearchParams } from 'expo-router';
import { Button, Card, Loading, Message, Screen, Title } from '@/components/ui';
import { downloadTransactionReceipt, fetchTransactionReceipt, ReceiptKind, shareTransactionReceipt } from '@/lib/invoices';
import { errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';

export default function ReceiptViewScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ kind?: string; documentId?: string }>();
  const kind: ReceiptKind = params.kind === 'purchase' ? 'purchase' : 'sale';
  const documentId = params.documentId || '';
  const [uri, setUri] = useState('');
  const [aspectRatio, setAspectRatio] = useState(0.72);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'download' | 'share' | ''>('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!documentId) {
        setError('This receipt link is incomplete.');
        setLoading(false);
        return;
      }
      try {
        const nextUri = await fetchTransactionReceipt(kind, documentId);
        if (!active) return;
        setUri(nextUri);
        Image.getSize(nextUri, (width, height) => {
          if (active && width > 0 && height > 0) setAspectRatio(width / height);
        });
      } catch (nextError) {
        if (active) setError(errorMessage(nextError));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [documentId, kind]);

  const runAction = async (action: 'download' | 'share') => {
    setBusy(action);
    setError('');
    try {
      if (action === 'share') {
        await shareTransactionReceipt(kind, documentId);
      } else {
        const saved = await downloadTransactionReceipt(kind, documentId);
        if (saved) localizedAlert('Receipt saved', 'The PNG receipt image was saved in the folder you selected.');
      }
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy('');
    }
  };

  return (
    <Screen>
      <Title eyebrow="Transaction document" subtitle="Bold image receipt with the store watermark">
        {kind === 'sale' ? 'Sale Receipt' : 'Purchase Receipt'}
      </Title>
      {error ? <Message text={error} tone="error" /> : null}
      {loading ? <Loading /> : uri ? (
        <Card style={styles.receiptCard}>
          <Image accessibilityLabel={t(`${kind} receipt image`)} source={{ uri }} resizeMode="contain" style={[styles.receiptImage, { aspectRatio }]} />
        </Card>
      ) : null}
      {uri ? (
        <View style={styles.actions}>
          <View style={styles.action}><Button title={busy === 'download' ? 'Saving…' : 'Download Image'} icon="download-outline" variant="secondary" disabled={Boolean(busy)} onPress={() => runAction('download')} /></View>
          <View style={styles.action}><Button title={busy === 'share' ? 'Opening…' : 'Share Image'} icon="share-social-outline" disabled={Boolean(busy)} onPress={() => runAction('share')} /></View>
        </View>
      ) : null}
      <Text style={styles.hint}>The receipt is a PNG image, ready for WhatsApp, Telegram and other sharing apps.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  receiptCard: { padding: spacing.sm, overflow: 'hidden' },
  receiptImage: { width: '100%', minHeight: 360, borderRadius: radius.md, backgroundColor: colors.surface },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
