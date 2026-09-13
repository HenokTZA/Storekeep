import React from 'react';
import {
  ActivityIndicator,
  ColorValue,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing } from '@/theme';
import { localizeText, Text, useI18n } from '@/i18n';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: ColorValue }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function Screen({ children, scroll = true, style, safeTop = false, safeTopColor = colors.background }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; safeTop?: boolean; safeTopColor?: ColorValue }) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollOuter}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.screenContent, style]}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, { flex: 1 }, style]}>{children}</View>
  );
  return (
    <SafeAreaView edges={safeTop ? ['top'] : []} style={[styles.safeArea, { backgroundColor: safeTopColor }]}>
      <View style={styles.screenBody}>
        <SafeAreaView edges={['bottom']} style={styles.flex}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{content}</KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}

export function Title({ children, subtitle, eyebrow, action }: { children: React.ReactNode; subtitle?: string; eyebrow?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <View style={styles.titleCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{children}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.titleAction}>{action}</View> : null}
    </View>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.titleCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ title, onPress, disabled, variant = 'primary', icon, compact = false }: { title: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; icon?: IconName; compact?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        variant === 'ghost' && styles.buttonGhost,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      {icon ? <Icon name={icon} size={compact ? 18 : 20} color={variant === 'primary' || variant === 'danger' ? colors.onPrimary : colors.primary} /> : null}
      <Text style={[
        styles.buttonText,
        variant === 'secondary' && styles.buttonSecondaryText,
        variant === 'ghost' && styles.buttonSecondaryText,
      ]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, variant = 'soft' }: { icon: IconName; onPress: () => void; label: string; variant?: 'soft' | 'plain' | 'danger' }) {
  const { language } = useI18n();
  const iconColor = variant === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={localizeText(label, language)} onPress={onPress} style={({ pressed }) => [styles.iconButton, variant === 'plain' && styles.iconButtonPlain, variant === 'danger' && styles.iconButtonDanger, pressed && styles.dimmed]}>
      <Icon name={icon} size={22} color={iconColor} />
    </Pressable>
  );
}

export function Input({ label, icon, hint, ...props }: TextInputProps & { label: string; icon?: IconName; hint?: string }) {
  const { language } = useI18n();
  const placeholder = typeof props.placeholder === 'string' ? localizeText(props.placeholder, language) : props.placeholder;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputShell, props.multiline && styles.inputShellMultiline]}>
        {icon ? <Icon name={icon} size={19} color={colors.muted} /> : null}
        <TextInput {...props} placeholder={placeholder} placeholderTextColor={colors.muted} style={[styles.input, props.multiline && styles.inputMultiline, props.style]} />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function SearchField({ value, onChangeText, placeholder, onSubmitEditing }: { value: string; onChangeText: (value: string) => void; placeholder: string; onSubmitEditing?: () => void }) {
  const { language } = useI18n();
  const localizedPlaceholder = localizeText(placeholder, language);
  return (
    <View style={styles.searchShell}>
      <Icon name="search-outline" size={21} color={colors.muted} />
      <TextInput
        accessibilityLabel={localizedPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={localizedPlaceholder}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        style={styles.searchInput}
        value={value}
      />
    </View>
  );
}

export function Chip({ label, active = false, onPress, tone = 'primary' }: { label: string; active?: boolean; onPress: () => void; tone?: 'primary' | 'danger' | 'success' }) {
  const activeBackground = tone === 'danger' ? colors.dangerButton : tone === 'success' ? colors.success : colors.primaryButton;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && { backgroundColor: activeBackground, borderColor: activeBackground }, pressed && styles.dimmed]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'danger' | 'warning' | 'success' }) {
  const palette = {
    neutral: { backgroundColor: colors.surfaceMuted, color: colors.neutral },
    primary: { backgroundColor: colors.primarySoft, color: colors.primary },
    danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
    warning: { backgroundColor: colors.warningSoft, color: colors.warning },
    success: { backgroundColor: colors.successSoft, color: colors.success },
  }[tone];
  return <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]}><Text style={[styles.badgeText, { color: palette.color }]}>{label}</Text></View>;
}

export function Loading() {
  return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.muted}>Loading…</Text></View>;
}

export function Message({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'error' | 'warning' | 'success' }) {
  const background = tone === 'error' ? colors.dangerSoft : tone === 'warning' ? colors.warningSoft : tone === 'success' ? colors.successSoft : colors.surfaceMuted;
  const color = tone === 'error' ? colors.danger : tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : colors.muted;
  const icon: IconName = tone === 'error' ? 'alert-circle-outline' : tone === 'warning' ? 'warning-outline' : tone === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline';
  return <View style={[styles.message, { backgroundColor: background }]}><Icon name={icon} size={20} color={color} /><Text style={[styles.messageText, { color }]}>{text}</Text></View>;
}

export function Money({ value, currency = 'ETB', color, size = 'medium' }: { value: string | number; currency?: string; color?: ColorValue; size?: 'small' | 'medium' | 'large' }) {
  const { locale } = useI18n();
  return <Text style={[styles.money, size === 'small' && styles.moneySmall, size === 'large' && styles.moneyLarge, color ? { color } : null]}>{Number(value).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <Text style={styles.currency}>{currency}</Text></Text>;
}

export function EmptyState({ icon = 'file-tray-outline', title, message }: { icon?: IconName; title: string; message?: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Icon name={icon} size={30} color={colors.primary} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  screenBody: { flex: 1, backgroundColor: colors.background },
  scrollOuter: { flexGrow: 1, paddingBottom: 48 },
  screenContent: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 48, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.xs },
  titleCopy: { flex: 1 },
  titleAction: { paddingTop: spacing.xs },
  eyebrow: { color: colors.primary, fontSize: 12, lineHeight: 16, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: spacing.xs },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.45, color: colors.text },
  subtitle: { color: colors.muted, marginTop: spacing.xs, lineHeight: 20, fontSize: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.xs },
  sectionTitle: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '900', letterSpacing: -0.2 },
  sectionSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  button: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.primaryButton, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  buttonCompact: { minHeight: 42, paddingHorizontal: spacing.mdSm, borderRadius: radius.md },
  buttonSecondary: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder },
  buttonDanger: { backgroundColor: colors.dangerButton },
  buttonGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primaryBorder },
  buttonText: { color: colors.onPrimary, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  buttonSecondaryText: { color: colors.primary },
  dimmed: { opacity: 0.62 },
  iconButton: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primaryBorder },
  iconButtonPlain: { backgroundColor: colors.surface, borderColor: colors.border },
  iconButtonDanger: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder },
  field: { gap: 7 },
  label: { color: colors.textSoft, fontWeight: '800', fontSize: 13, lineHeight: 18 },
  inputShell: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inputShellMultiline: { alignItems: 'flex-start', minHeight: 104, paddingTop: 14 },
  input: { flex: 1, minHeight: 50, paddingVertical: 0, color: colors.text, fontSize: 16 },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top', paddingTop: 0 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  searchShell: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.searchSurface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, minHeight: 52, color: colors.text, fontSize: 15, paddingVertical: 0 },
  chip: { minHeight: 38, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: colors.textSoft, fontSize: 13, fontWeight: '800' },
  chipTextActive: { color: colors.onPrimary },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.35 },
  center: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: colors.muted },
  message: { borderRadius: radius.md, padding: spacing.mdSm, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  messageText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  money: { fontSize: 18, lineHeight: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.2 },
  moneySmall: { fontSize: 15, lineHeight: 20 },
  moneyLarge: { fontSize: 26, lineHeight: 32, letterSpacing: -0.55 },
  currency: { fontSize: 11, fontWeight: '900', letterSpacing: 0.25 },
  emptyState: { minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyMessage: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 280 },
});

export const uiStyles = styles;
