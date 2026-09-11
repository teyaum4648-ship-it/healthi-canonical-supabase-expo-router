import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EntrySheet } from '../../components/mobile/EntrySheet';
import { ActionRow } from '../../components/mobile/ActionRow';
import { SegmentedControl } from '../../components/mobile/SegmentedControl';
import { colors, type } from '../../styles/mobileTheme';
import type { MealLog } from '../../engines/nutrition';
import type { MealLogItemRow } from './mealItemPersistence';
import type { UserFoodProductRow } from './productLibraryPersistence';
import { userFoodProductRowToSnapshot } from './mealBuilder';
import type { HealthiProductSnapshot } from './productLookup/productLookupTypes';
import { ProductThumbnail } from './ProductThumbnail';
import { collectMealHistory, matchesHistory, type MealCollectionEntry } from './mealLibrary';
import { readMealCollection, readMealHistory, saveMealCollectionEntry, type MealCollectionClient } from './mealCollectionStore';

export function MealLibrarySheet({ userId, demo, client, meals, items, foods, onUseMeal, onUseFood, onClose, initialEntry }: {
  userId: string | null; demo: boolean; client: MealCollectionClient;
  meals: MealLog[]; items: MealLogItemRow[]; foods: UserFoodProductRow[];
  onUseMeal: (entry: MealCollectionEntry) => void; onUseFood: (food: HealthiProductSnapshot) => void;
  onClose: () => void; initialEntry?: MealCollectionEntry | null;
}) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'All' | 'Foods' | 'Meals'>('All');
  const [list, setList] = useState<'Recent' | 'Saved'>('Recent');
  const [collection, setCollection] = useState<MealCollectionEntry[]>([]);
  const [history, setHistory] = useState({ meals, items, foods });
  const [selected, setSelected] = useState<MealCollectionEntry | null>(initialEntry ?? null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current += 1; }; }, []);
  useEffect(() => {
    let current = true;
    readMealCollection(userId, demo, client, AsyncStorage).then(rows => {
      if (current) { setCollection(rows); setReady(true); }
    }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [userId, demo, client, retry]);
  async function load(nextOffset = 0, request = ++generation.current) {
    if (demo) return;
    setLoading(true); setError('');
    try {
      const page = await readMealHistory(client, query, nextOffset);
      if (!alive.current || request !== generation.current) return;
      setHistory(previous => nextOffset ? {
        meals: [...previous.meals, ...page.meals], items: [...previous.items, ...page.items], foods: [...previous.foods, ...page.foods]
      } : page);
      setHasMore(page.has_more); setOffset(nextOffset);
    } catch (e) { if (alive.current && request === generation.current) setError(e instanceof Error ? e.message : 'History could not load.'); }
    finally { if (alive.current && request === generation.current) setLoading(false); }
  }
  useEffect(() => {
    if (demo) return;
    const request = ++generation.current;
    setLoading(true); setHistory({ meals: [], items: [], foods: [] }); setHasMore(false);
    const timer = setTimeout(() => void load(0, request), 250);
    return () => { clearTimeout(timer); generation.current += 1; };
  }, [query, demo, userId, retry]);
  const entries = collectMealHistory(history.meals, history.items, collection, query, list === 'Saved');
  const personal = history.foods.filter(food => (list !== 'Saved' || food.is_saved) && matchesHistory(query, `${food.name} ${food.brand ?? ''}`));
  const currentSelection = selected ? collection.find(entry => entry.library_key === selected.library_key) ?? selected : null;
  async function toggle(entry: MealCollectionEntry, key: 'is_saved' | 'is_starred') {
    if (busy || !ready) return;
    setBusy(true); setError('');
    const current = collection.find(row => row.library_key === entry.library_key) ?? entry;
    try {
      const saved = await saveMealCollectionEntry({ ...current, [key]: !current[key] }, userId, demo, client, AsyncStorage);
      if (alive.current) setCollection(rows => [saved, ...rows.filter(row => row.library_key !== saved.library_key)]);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Your meal could not be saved.'); }
    finally { if (alive.current) setBusy(false); }
  }
  return <EntrySheet title={currentSelection?.meal.name ?? 'Your foods & meals'} onClose={onClose} busy={busy} footer={currentSelection ?
    <Pressable accessibilityRole="button" disabled={busy || !currentSelection.items.length} onPress={() => onUseMeal(currentSelection)} style={[styles.primary, !currentSelection.items.length && styles.dim]}><Text style={styles.primaryText}>Use meal</Text></Pressable> : undefined}>
    {demo ? <Text style={styles.caption}>Demo library · saved on this device</Text> : null}
    {currentSelection ? <>
      <ActionRow title="Back to your library" icon="chevron-back" onPress={() => setSelected(null)} last />
      <Text style={styles.detail}>{currentSelection.is_saved ? 'Saved meal template' : 'Previous meal'} · {new Date(currentSelection.meal.logged_at).toLocaleDateString()}</Text>
      <MealMacroGrid meal={currentSelection.meal} />
      {currentSelection.items.map(item => <View key={item.id} style={styles.row}><ProductThumbnail url={typeof item.metadata === 'object' && item.metadata && !Array.isArray(item.metadata) && typeof item.metadata.image_url === 'string' ? item.metadata.image_url : null} name={item.name} /><View style={styles.copy}><Text style={styles.name}>{item.name}</Text><Text style={styles.detail}>{item.servings} × {item.serving_size ?? 'serving (size not reported)'}</Text></View></View>)}
      {!currentSelection.items.length ? <Text style={styles.detail}>This older meal has totals only; its individual foods weren’t saved. You can still star it for reference.</Text> : <Text style={styles.detail}>Review portions and choose the meal time before logging a new copy. Earlier entries stay unchanged.</Text>}
      <ActionRow title={currentSelection.is_starred ? 'Unstar meal' : 'Star meal'} detail="Keep it at the top of Recent" icon={currentSelection.is_starred ? 'star' : 'star-outline'} onPress={() => void toggle(currentSelection, 'is_starred')} />
      {currentSelection.items.length ? <ActionRow title={currentSelection.is_saved ? 'Remove from saved meals' : 'Save meal for later'} detail="Keep these foods and portions as a reusable template" icon={currentSelection.is_saved ? 'bookmark' : 'bookmark-outline'} onPress={() => void toggle(currentSelection, 'is_saved')} /> : null}
    </> : <>
      <TextInput accessibilityLabel="Search past foods or meals" placeholder="Food, brand, or meal name" placeholderTextColor={colors.textMuted} value={query} maxLength={120} onChangeText={setQuery} style={styles.input} autoCapitalize="none" />
      <SegmentedControl options={['All', 'Foods', 'Meals'] as const} value={kind} onChange={setKind} />
      <View style={styles.filters}>{(['Recent', 'Saved'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: list === value }} onPress={() => setList(value)} style={styles.filter}><Text style={[styles.detail, list === value && styles.active]}>{value}</Text></Pressable>)}</View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading history" color={colors.accent} /> : null}
      {kind !== 'Foods' && entries.length ? <View><Text style={styles.name}>Meals</Text>{entries.map(entry => <View style={styles.row} key={entry.library_key}><View style={styles.copy}><ActionRow title={entry.meal.name} detail={`${entry.items.length} foods${typeof entry.meal.calories === 'number' ? ` · ${Math.round(entry.meal.calories)} kcal` : ''}${entry.is_saved ? ' · Saved meal' : ''}`} onPress={() => { setSelected(entry); setError(''); }} /></View><Pressable accessibilityRole="button" accessibilityLabel={`${entry.is_starred ? 'Unstar' : 'Star'} ${entry.meal.name}`} disabled={busy || !ready} onPress={() => void toggle(entry, 'is_starred')} style={styles.star}><Ionicons name={entry.is_starred ? 'star' : 'star-outline'} color={entry.is_starred ? colors.accentMid : colors.textMuted} size={21} /></Pressable></View>)}</View> : null}
      {kind !== 'Meals' && personal.length ? <View><Text style={styles.name}>Foods</Text>{personal.map(food => <View key={food.id} style={styles.row}><ProductThumbnail url={userFoodProductRowToSnapshot(food).image_url} name={food.name} /><View style={styles.copy}><ActionRow title={food.name} detail={food.brand ?? food.serving_size ?? 'Size not reported'} onPress={() => onUseFood(userFoodProductRowToSnapshot(food))} /></View></View>)}</View> : null}
      {!loading && !(kind !== 'Foods' && entries.length) && !(kind !== 'Meals' && personal.length) ? <Text style={styles.detail}>{query ? 'No matches in your history. Try a food inside the meal or a shorter name.' : list === 'Saved' ? 'Save a meal from its details to keep it here.' : 'Your meals and foods will appear here after you log them.'}</Text> : null}
      {hasMore && !demo ? <ActionRow title="Load more history" onPress={() => { if (!loading) void load(offset + 50); }} /> : null}
    </>}
    {error ? <><Text accessibilityRole="alert" style={styles.detail}>{error}</Text><ActionRow title="Try again" onPress={() => { setError(''); setRetry(value => value + 1); }} last /></> : null}
  </EntrySheet>;
}
export function MealMacroGrid({ meal }: { meal: Partial<MealLog> }) {
  return <View style={styles.grid}>{([['Calories', meal.calories, 'kcal'], ['Protein', meal.protein_g, 'g'], ['Carbs', meal.carbs_g, 'g'], ['Fat', meal.fat_g, 'g']] as const).map(([label, value, unit]) => <View key={label} style={styles.metric}><Text style={styles.caption}>{label}</Text><Text style={styles.value}>{typeof value === 'number' ? `${Math.round(value * 10) / 10} ${unit}` : 'Not reported'}</Text></View>)}</View>;
}
const styles = StyleSheet.create({
  detail: { ...type.body, color: colors.textMuted }, caption: { ...type.caption, fontSize: 14, color: colors.textMuted },
  name: { ...type.label, color: colors.text }, value: { ...type.number, color: colors.text },
  input: { ...type.body, color: colors.text, backgroundColor: colors.surfaceInset, minHeight: 50, borderRadius: 14, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, copy: { flex: 1, minWidth: 0 }, star: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  filters: { flexDirection: 'row', gap: 20 }, filter: { minHeight: 44, justifyContent: 'center' }, active: { color: colors.accentMid, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, metric: { flexGrow: 1, flexBasis: '44%', backgroundColor: colors.surfaceInset, borderRadius: 18, padding: 14, gap: 6 },
  primary: { minHeight: 52, backgroundColor: colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, primaryText: { ...type.body, fontWeight: '600', color: colors.primaryText }, dim: { opacity: 0.5 }
});
