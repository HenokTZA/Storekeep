import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button, Icon, Input, Message } from './ui';
import { apiFetch, errorMessage } from '@/lib/api';
import { colors, radius, spacing } from '@/theme';
import type { Category, Paginated } from '@/types';

export function CategoryPicker({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { const result = await apiFetch<Paginated<Category>>('/categories/?page_size=100'); setCategories(result.results); }
    catch (nextError) { setError(errorMessage(nextError)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const add = async () => {
    if (!newName.trim()) return;
    try {
      const created = await apiFetch<Category>('/categories/', { method: 'POST', body: JSON.stringify({ name: newName.trim() }) });
      setCategories(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(created.id); setNewName('');
    } catch (nextError) { setError(errorMessage(nextError)); }
  };
  return <View style={styles.wrapper}><View style={styles.labelRow}><Icon name="pricetag-outline" size={18} color={colors.primary} /><Text style={styles.label}>Category</Text></View>{error ? <Message text={error} tone="error" /> : null}<View style={styles.chips}><Choice label="Uncategorized" active={value === null} onPress={() => onChange(null)} />{categories.map(item => <Choice key={item.id} label={item.name} active={value === item.id} onPress={() => onChange(item.id)} />)}</View><View style={styles.addRow}><View style={styles.flex}><Input label="New category" value={newName} onChangeText={setNewName} placeholder="Category name" /></View><View style={styles.addButton}><Button title="Add" icon="add" compact variant="secondary" onPress={add} disabled={!newName.trim()} /></View></View></View>;
}
function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.active]}><Text style={[styles.text, active && styles.activeText]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ wrapper: { gap: spacing.sm }, flex: { flex: 1 }, labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, label: { color: colors.textSoft, fontWeight: '800', fontSize: 13 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { minHeight: 38, justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 13 }, active: { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton }, text: { color: colors.textSoft, fontSize: 12, fontWeight: '800' }, activeText: { color: colors.onPrimary }, addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }, addButton: { width: 96, paddingBottom: 1 } });
