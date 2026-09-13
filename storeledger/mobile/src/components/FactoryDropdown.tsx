import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useI18n } from '@/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, SearchField } from '@/components/ui';
import { colors, radius, shadow, spacing } from '@/theme';
import type { Party } from '@/types';

type Props = {
  factories: Party[];
  value: number | null;
  onChange: (factoryId: number) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function FactoryDropdown({ factories, value, onChange, label = 'Factory', placeholder = 'Select a factory', disabled = false }: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const selected = factories.find(factory => factory.id === value) || null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return factories;
    return factories.filter(factory => `${factory.name} ${factory.company}`.toLocaleLowerCase().includes(needle));
  }, [factories, query]);

  const choose = (factoryId: number) => {
    onChange(factoryId);
    setVisible(false);
    setQuery('');
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t(label)}: ${selected?.name || t('not selected')}`}
        disabled={disabled}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <View style={styles.leading}><Icon name="business-outline" size={20} color={colors.primary} /></View>
        <View style={styles.copy}>
          <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>{selected?.name || placeholder}</Text>
          {selected?.company ? <Text style={styles.company} numberOfLines={1}>{selected.company}</Text> : null}
        </View>
        <Icon name="chevron-down" size={20} color={colors.muted} />
      </Pressable>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.header}>
              <View style={styles.copy}><Text style={styles.title}>Choose Factory</Text><Text style={styles.subtitle}>Stock is kept separately for each factory.</Text></View>
              <Pressable accessibilityLabel={t('Close factory list')} onPress={() => setVisible(false)} style={styles.close}><Icon name="close" size={22} color={colors.text} /></Pressable>
            </View>
            {factories.length > 6 ? <SearchField value={query} onChangeText={setQuery} placeholder="Search factories" /> : null}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {filtered.map(factory => {
                const active = factory.id === value;
                return (
                  <Pressable key={factory.id} onPress={() => choose(factory.id)} style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}>
                    <View style={[styles.optionIcon, active && styles.optionIconActive]}><Icon name="business-outline" size={20} color={active ? colors.onPrimary : colors.primary} /></View>
                    <View style={styles.copy}><Text style={[styles.optionName, active && styles.optionNameActive]}>{factory.name}</Text>{factory.company ? <Text style={[styles.optionMeta, active && styles.optionMetaActive]}>{factory.company}</Text> : null}</View>
                    {active ? <Icon name="checkmark-circle" size={22} color={colors.onPrimary} /> : <Icon name="chevron-forward" size={20} color={colors.muted} />}
                  </Pressable>
                );
              })}
              {!filtered.length ? <Text style={styles.empty}>No factories match this search.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 7 },
  label: { color: colors.textSoft, fontSize: 12, fontWeight: '900' },
  trigger: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.mdSm },
  leading: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  value: { color: colors.text, fontSize: 14, fontWeight: '800' },
  placeholder: { color: colors.muted, fontWeight: '600' },
  company: { color: colors.muted, fontSize: 10, marginTop: 2 },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10, 24, 19, 0.48)' },
  sheet: { maxHeight: '82%', gap: spacing.md, backgroundColor: colors.background, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: spacing.md, ...shadow.card },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  title: { color: colors.text, fontSize: 21, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  list: { gap: spacing.sm, paddingBottom: spacing.md },
  option: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.mdSm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.mdSm },
  optionActive: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton },
  optionIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  optionIconActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  optionName: { color: colors.text, fontSize: 15, fontWeight: '900' },
  optionNameActive: { color: colors.onPrimary },
  optionMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  optionMetaActive: { color: colors.onPrimary },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl },
});
