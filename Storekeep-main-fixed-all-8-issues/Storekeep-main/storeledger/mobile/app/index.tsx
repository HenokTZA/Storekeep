import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { Loading, Screen } from '@/components/ui';

export default function Index() {
  const { loading, authenticated } = useAuth();
  if (loading) return <Screen scroll={false}><Loading /></Screen>;
  return <Redirect href={authenticated ? '/(tabs)' : '/login'} />;
}

