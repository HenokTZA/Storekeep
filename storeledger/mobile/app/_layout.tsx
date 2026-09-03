import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/auth/AuthContext';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <AuthProvider><RootNavigator /></AuthProvider>
  );
}

function RootNavigator() {
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
        <Stack.Screen name="stock-new" options={{ title: 'Add Product', presentation: 'modal' }} />
        <Stack.Screen name="stock-adjust" options={{ title: 'Add Stock', presentation: 'modal' }} />
        <Stack.Screen name="stock-history" options={{ title: 'Stock History' }} />
        <Stack.Screen name="product-edit" options={{ title: 'Edit Product', presentation: 'modal' }} />
        <Stack.Screen name="customer-new" options={{ title: 'Add Customer', presentation: 'modal' }} />
        <Stack.Screen name="customer-edit" options={{ title: 'Edit Customer', presentation: 'modal' }} />
        <Stack.Screen name="customer-detail" options={{ title: 'Customer Profile' }} />
        <Stack.Screen name="payment-new" options={{ title: 'Record Payment', presentation: 'modal' }} />
        <Stack.Screen name="credit-new" options={{ title: 'Record Credit / Loan', presentation: 'modal' }} />
        <Stack.Screen name="transactions" options={{ title: 'Transactions' }} />
        <Stack.Screen name="reports" options={{ title: 'Reports' }} />
        <Stack.Screen name="report-detail" options={{ title: 'Report Details' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="dashboard-detail" options={{ title: 'Dashboard Details' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="sms-logs" options={{ title: 'SMS Logs' }} />
        <Stack.Screen name="expenses" options={{ title: 'Expenses' }} />
        <Stack.Screen name="expense-new" options={{ title: 'Add Expense', presentation: 'modal' }} />
        <Stack.Screen name="expense-reports" options={{ title: 'Expense Analytics' }} />
        <Stack.Screen name="purchases" options={{ title: 'Purchases' }} />
        <Stack.Screen name="purchase-new" options={{ title: 'Receive Purchase', presentation: 'modal' }} />
        <Stack.Screen name="outgoing-payment" options={{ title: 'Payment Sent', presentation: 'modal' }} />
        <Stack.Screen name="global-search" options={{ title: 'Search Everything' }} />
        <Stack.Screen name="data-export" options={{ title: 'Export & Backup' }} />
        <Stack.Screen name="overdue" options={{ title: 'Overdue Receivables' }} />
      </Stack>
    </>
  );
}
