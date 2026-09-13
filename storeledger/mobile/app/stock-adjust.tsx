import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Icon, Input, Message, Screen, SectionHeader, Title } from '@/components/ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';

export default function StockAdjustScreen() {
  const { productId, name, factoryName = '', piecesPerUnit = '1', unit = 'unit', mode = 'received' } = useLocalSearchParams<{ productId: string; name: string; factoryName?: string; piecesPerUnit?: string; unit?: string; mode?: string }>();
  const adjusting = mode === 'adjust';
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState(adjusting ? '' : 'Stock received');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const amount = Number(quantity);
      const path = adjusting ? `/products/${productId}/adjust_stock/` : `/products/${productId}/add_stock/`;
      const payload = adjusting ? { quantity_delta: direction === 'increase' ? amount : -amount, note } : { quantity: amount, note };
      await apiFetch(path, { method: 'POST', body: JSON.stringify(payload) });
      router.back();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Title eyebrow="Inventory movement" subtitle="Every change is saved in the permanent stock history">{adjusting ? 'Adjust Stock' : 'Receive Stock'}</Title>
      {error ? <Message text={error} tone="error" /> : null}
      <Card style={styles.productCard}>
        <View style={styles.productIcon}><Icon name="cube-outline" size={25} color={colors.primary} /></View>
        <View style={styles.flex}><Text style={styles.productName}>{name}</Text>{factoryName ? <Text style={styles.factory}>Factory {factoryName}</Text> : null}<Text style={styles.small}>{adjusting ? 'Manual stock correction' : 'Stock receipt'} · ×{piecesPerUnit} pieces per {unit}</Text></View>
      </Card>

      {adjusting ? (
        <View style={styles.group}>
          <SectionHeader title="Adjustment type" />
          <View style={styles.row}>
            <Choice icon="arrow-up-outline" label="Increase" active={direction === 'increase'} tone="success" onPress={() => setDirection('increase')} />
            <Choice icon="arrow-down-outline" label="Decrease" active={direction === 'decrease'} tone="danger" onPress={() => setDirection('decrease')} />
          </View>
        </View>
      ) : null}

      <Card style={styles.formCard}>
        <Input label={adjusting ? 'Units to Adjust' : 'Units Received'} icon={direction === 'decrease' ? 'remove-circle-outline' : 'add-circle-outline'} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" autoFocus placeholder="0" hint={`One ${unit} contains ${piecesPerUnit} individual pieces.`} />
        <Input label="Reason / Note" icon="document-text-outline" value={note} onChangeText={setNote} multiline placeholder="Why is this stock changing?" />
        {Number(quantity) > 0 ? <View style={[styles.preview, { backgroundColor: direction === 'decrease' ? colors.dangerSoft : colors.successSoft }]}><Icon name={direction === 'decrease' ? 'trending-down-outline' : 'trending-up-outline'} size={23} color={direction === 'decrease' ? colors.danger : colors.success} /><Text style={[styles.previewText, { color: direction === 'decrease' ? colors.danger : colors.success }]}>{direction === 'decrease' ? 'Decrease' : 'Increase'} by {Number(quantity).toLocaleString()} units ({(Number(quantity) * Number(piecesPerUnit)).toLocaleString()} pieces)</Text></View> : null}
      </Card>
      <Button title={busy ? 'Saving…' : adjusting ? 'Save Adjustment' : 'Receive Stock'} icon="checkmark-circle-outline" onPress={save} disabled={busy || Number(quantity) <= 0 || !note.trim()} />
      <Message text="This movement will be recorded with its note, user and timestamp." />
    </Screen>
  );
}

function Choice({ icon, label, active, tone, onPress }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; active: boolean; tone: 'success' | 'danger'; onPress: () => void }) {
  const color = tone === 'success' ? colors.success : colors.danger;
  const background = tone === 'success' ? colors.successSoft : colors.dangerSoft;
  return <Pressable onPress={onPress} style={[styles.choice, active && { backgroundColor: background, borderColor: color }]}><Icon name={icon} size={21} color={active ? color : colors.muted} /><Text style={[styles.choiceText, active && { color }]}>{label}</Text>{active ? <Icon name="checkmark-circle" size={18} color={color} /> : null}</Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  productCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm },
  productIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  productName: { color: colors.text, fontSize: 17, fontWeight: '900' },
  factory: { color: colors.primary, fontSize: 11, fontWeight: '900', marginTop: 3 },
  small: { color: colors.muted, fontSize: 12, marginTop: 2 },
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  choice: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.surface },
  choiceText: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  formCard: { gap: spacing.md },
  preview: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.mdSm, borderRadius: radius.md },
  previewText: { fontSize: 13, fontWeight: '900' },
});
