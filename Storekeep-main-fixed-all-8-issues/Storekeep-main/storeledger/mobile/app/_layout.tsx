import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/auth/AuthContext';
import { I18nProvider, useI18n } from '@/i18n';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <I18nProvider><AuthProvider><RootNavigator /></AuthProvider></I18nProvider>
  );
}

function RootNavigator() {
  const { t } = useI18n();
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleAlign: 'center',
        headerTitleStyle: { color: colors.text, fontWeight: '900', fontSize: 17 },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="stock-new" options={{ title: t('Add Product'), presentation: 'modal' }} />
        <Stack.Screen name="stock-adjust" options={{ title: t('Add Stock'), presentation: 'modal' }} />
        <Stack.Screen name="stock-history" options={{ title: t('Stock History') }} />
        <Stack.Screen name="product-edit" options={{ title: t('Edit Product'), presentation: 'modal' }} />
        <Stack.Screen name="customer-new" options={{ title: t('Add Customer'), presentation: 'modal' }} />
        <Stack.Screen name="customer-edit" options={{ title: t('Edit Customer'), presentation: 'modal' }} />
        <Stack.Screen name="customer-detail" options={{ title: t('Customer Profile') }} />
        <Stack.Screen name="payment-new" options={{ title: t('Record Payment'), presentation: 'modal' }} />
        <Stack.Screen name="credit-new" options={{ title: t('Record Credit / Loan'), presentation: 'modal' }} />
        <Stack.Screen name="transactions" options={{ title: t('Transactions') }} />
        <Stack.Screen name="receipt-view" options={{ title: t('Transaction Receipt') }} />
        <Stack.Screen name="reports" options={{ title: t('Reports') }} />
        <Stack.Screen name="report-detail" options={{ title: t('Report Details') }} />
        <Stack.Screen name="notifications" options={{ title: t('Notifications') }} />
        <Stack.Screen name="dashboard-detail" options={{ title: t('Dashboard Details') }} />
        <Stack.Screen name="settings" options={{ title: t('Settings') }} />
        <Stack.Screen name="sms-logs" options={{ title: t('SMS Logs') }} />
        <Stack.Screen name="expenses" options={{ title: t('Expenses') }} />
        <Stack.Screen name="expense-new" options={{ title: t('Add Expense'), presentation: 'modal' }} />
        <Stack.Screen name="expense-reports" options={{ title: t('Expense Analytics') }} />
        <Stack.Screen name="purchases" options={{ title: t('Purchases') }} />
        <Stack.Screen name="purchase-new" options={{ title: t('Receive Purchase'), presentation: 'modal' }} />
        <Stack.Screen name="outgoing-payment" options={{ title: t('Payment Sent'), presentation: 'modal' }} />
        <Stack.Screen name="global-search" options={{ title: t('Search Everything') }} />
        <Stack.Screen name="data-export" options={{ title: t('Export & Backup') }} />
        <Stack.Screen name="overdue" options={{ title: t('Overdue Receivables') }} />
      </Stack>
    </>
  );
}
