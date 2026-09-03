import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { ColorValue, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { Icon, IconName } from '@/components/ui';
import { colors, shadow } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TabIcon = ({ name, color }: { name: IconName; color: ColorValue }) => <Icon name={name} color={color} size={23} />;
const SaleIcon = ({ color }: { color: ColorValue }) => <View style={styles.saleIcon}><Icon name="add" color={colors.onPrimary} size={30} /></View>;

export default function TabLayout() {
  const { loading, authenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  if (!loading && !authenticated) return <Redirect href="/login" />;
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '800', marginTop: 1 },
      tabBarHideOnKeyboard: true,
      tabBarStyle: { height: 64 + bottomPadding, paddingBottom: bottomPadding, paddingTop: 7, backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon name="home-outline" color={color} /> }} />
      <Tabs.Screen name="stock" options={{ title: 'Stock', tabBarIcon: ({ color }) => <TabIcon name="cube-outline" color={color} /> }} />
      <Tabs.Screen name="sale" options={{ title: 'Sale', tabBarIcon: ({ color }) => <SaleIcon color={color} />, tabBarItemStyle: styles.saleItem }} />
      <Tabs.Screen name="customers" options={{ title: 'People', tabBarIcon: ({ color }) => <TabIcon name="people-outline" color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon name="ellipsis-horizontal" color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  saleItem: { marginTop: -12 },
  saleIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryButton, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.surface, ...shadow.floating },
});
