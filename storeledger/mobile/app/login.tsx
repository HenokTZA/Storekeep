import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LanguageSwitch, Text } from '@/i18n';
import { router } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { Button, Card, Icon, Input, Message, Screen } from '@/components/ui';
import { API_URL, errorMessage } from '@/lib/api';
import { colors, radius, shadow, spacing } from '@/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('ChangeMe123!');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
      router.replace('/(tabs)');
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.languageRow}><LanguageSwitch /></View>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Icon name="receipt-outline" color={colors.onPrimary} size={34} />
          <View style={styles.logoCheck}><Icon name="checkmark" color={colors.primary} size={14} /></View>
        </View>
        <Text style={styles.brandName}>StoreLedger</Text>
        <Text style={styles.brandTagline}>Simple books. Clear business.</Text>
      </View>

      <Card style={styles.formCard}>
        <View style={styles.headingBlock}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to manage your store, stock and customer balances.</Text>
        </View>
        {error ? <Message text={error} tone="error" /> : null}
        <Input label="Username" icon="person-outline" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="Enter your username" />
        <Input label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter your password" onSubmitEditing={submit} returnKeyType="done" />
        <Button title={busy ? 'Signing in…' : 'Sign In'} icon="log-in-outline" onPress={submit} disabled={busy || !username || !password} />
      </Card>

      <View style={styles.security}>
        <View style={styles.securityIcon}><Icon name="shield-checkmark-outline" color={colors.primary} size={20} /></View>
        <Text style={styles.securityText}>Your store data is protected and scoped to your account.</Text>
      </View>
      <Text style={styles.api}>Connected to {API_URL}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', flexGrow: 1, paddingHorizontal: spacing.mdLg, paddingVertical: spacing.xl },
  languageRow: { alignItems: 'flex-end', marginBottom: spacing.sm },
  brand: { alignItems: 'center', marginBottom: spacing.md, gap: spacing.xs },
  logo: { width: 72, height: 72, borderRadius: radius.xl, backgroundColor: colors.primaryButton, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, ...shadow.floating },
  logoCheck: { position: 'absolute', right: -3, bottom: -3, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primaryButton, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -0.6, color: colors.primary },
  brandTagline: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  formCard: { gap: spacing.md, padding: spacing.mdLg },
  headingBlock: { gap: spacing.xs, marginBottom: spacing.xs },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.35, color: colors.text },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  security: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  securityIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  securityText: { flex: 1, maxWidth: 270, color: colors.muted, fontSize: 12, lineHeight: 17 },
  api: { textAlign: 'center', color: colors.muted, fontSize: 10, marginTop: spacing.xs },
});
