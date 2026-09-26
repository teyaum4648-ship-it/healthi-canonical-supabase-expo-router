import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EntrySheet } from '../../components/mobile/EntrySheet';
import { ActionRow } from '../../components/mobile/ActionRow';
import { SegmentedControl } from '../../components/mobile/SegmentedControl';
import { colors, type } from '../../styles/mobileTheme';
import { tabAccent } from '../../styles/pillarColors';
import type { HealthiProductSnapshot } from './productLookup/productLookupTypes';
import type { UserFoodProductRow } from './productLibraryPersistence';
import { userFoodProductRowToSnapshot } from './mealBuilder';
import { findPersonalFoods, portionValue } from './foodDiaryPresentation';
import { foodLoggingNutrition, foodSearchPortionDetail, initialFoodLoggingAmount, partitionFoodSearchResults, withFoodPortion } from './foodLoggingNutrition';
import { ProductThumbnail } from './ProductThumbnail';
import { ScoreRing } from './NutritionScoreRing';
import { calculateProductQuality } from './productLookup/productQuality';
import { AllergenNotice } from './AllergenNotice';
import type { AllergenGroup } from './allergens';

type PickerTab = 'Search' | 'Recent' | 'Saved';
export function FoodEntryPicker({ query, onQueryChange, onSearch, results, searching, message, products, onToggleSaved, onAdd, onScan, onPhoto, onManual, onClose, mealLabel, onOpenLibrary, avoidingAllergens }: {
  onPhoto?: () => void;
  onOpenLibrary?: () => void;
  mealLabel?: string;
  /** Groups from the person's allergen profile. Empty means the notice stays hidden. */
  avoidingAllergens?: AllergenGroup[];
  query: string; onQueryChange: (value: string) => void; onSearch: () => Promise<void>;
  results: HealthiProductSnapshot[]; searching: boolean; message: string;
  products: UserFoodProductRow[]; onToggleSaved: (product: UserFoodProductRow) => Promise<void>;
  onAdd: (product: HealthiProductSnapshot, source: 'search' | 'saved_food', servings: number) => Promise<void>;
  onScan: () => void; onManual: () => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<PickerTab>('Search');
  const [selected, setSelected] = useState<{ product: HealthiProductSnapshot; source: 'search' | 'saved_food' } | null>(null);
  const [servings, setServings] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showIncomplete, setShowIncomplete] = useState(false);
  const catalog = partitionFoodSearchResults(results);
  const personal = findPersonalFoods(products, query, tab === 'Saved');
  /**
   * Scores for the search results, computed once per result set.
   *
   * Scanning a barcode is usually a question about quality; searching a name is usually
   * about tracking. The ring means the second case answers the first one anyway, and
   * every food added from here already carries its score into the meal — so the ring is
   * showing what the diary was going to record either way rather than adding a new
   * number to the product.
   */
  const searchScores = useMemo(
    () => new Map(results.map((product) => [
      `${product.provider}-${product.barcode}-${product.name}`,
      calculateProductQuality(product).score
    ])),
    [results]
  );
  const logging = selected ? foodLoggingNutrition(selected.product) : null;
  const multiplier = logging?.amountPerPortion ?? 1;
  const amountStep = multiplier === 100 ? 1 : 0.25;
  const amount = Number(servings) || 0;
  const portion = portionValue(String(Number(servings) / multiplier));
  const choose = (product: HealthiProductSnapshot, source: 'search' | 'saved_food') => { setSelected({ product, source }); setServings(initialFoodLoggingAmount(product)); setError(''); };
  async function add() {
    if (!selected || portion === null || busy) return;
    setBusy(true);
    try { await onAdd(selected.product, selected.source, portion); }
    catch { setError('Could not add this food. Your selection is still here.'); }
    finally { setBusy(false); }
  }
  async function toggleSaved(product: UserFoodProductRow) {
    if (busy) return;
    setBusy(true); setError('');
    try { await onToggleSaved(product); }
    catch { setError('Saved foods could not be updated. Please try again; your meal is unchanged.'); }
    finally { setBusy(false); }
  }
  return (
    <EntrySheet title={selected ? 'Choose your portion' : mealLabel ? `Add to ${mealLabel.toLowerCase()}` : 'Add food'} onClose={onClose} busy={busy} footer={selected ? (
      <Pressable accessibilityRole="button" disabled={portion === null || busy} onPress={() => void add()} style={({ pressed }) => [styles.primary, (portion === null || busy || pressed) && styles.dim]}>
        {busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.primaryText}>{mealLabel ? `Add to ${mealLabel.toLowerCase()}` : 'Add to meal'}</Text>}
      </Pressable>
    ) : undefined}>
      {selected ? <>
        <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={styles.back}><Ionicons name="chevron-back" size={18} color={tabAccent.food} /><Text style={styles.link}>Choose another food</Text></Pressable>
        <View style={styles.productRow}><ProductThumbnail url={selected.product.image_url} name={selected.product.name} size={76} /><View style={styles.libraryCopy}><Text style={styles.title}>{selected.product.name}</Text><Text style={styles.detail}>{selected.product.brand}</Text></View></View>
        <Text style={styles.detail}>Check the name, variety, and pack size—packaging photos may be older.</Text>
        {/* Placed above the portion controls: an avoid-list declaration should be read
            before someone starts dialling in how much of it they ate. */}
        <AllergenNotice avoiding={avoidingAllergens ?? []} product={selected.product} />
        <Text style={styles.detail}>{[selected.product.quantity, logging?.label].filter(Boolean).join(' · ')}</Text>
        {(selected.product.food_portions?.length ?? 0) > 1 ? <View style={styles.portionChoices}>
          <Text style={styles.label}>Portion size</Text>
          {selected.product.food_portions!.map(p => <Pressable key={`${p.label}-${p.quantity}`} accessibilityRole="button" accessibilityState={{ selected: selected.product.serving_size === p.label }} onPress={() => { setSelected({ ...selected, product: withFoodPortion(selected.product, p) }); setServings('1'); }} style={[styles.portionChoice, selected.product.serving_size === p.label && styles.portionChoiceSelected]}><Text style={styles.detail}>{p.label}</Text></Pressable>)}
        </View> : null}
        <Text style={styles.label}>{multiplier === 100 ? 'Amount eaten' : 'Number of servings'}</Text>
        {multiplier === 1 ? <View style={styles.portionRow}>{[0.5, 1, 2].map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value} servings`} accessibilityState={{ selected: portion === value }} onPress={() => setServings(String(value))} style={styles.step}><Text style={styles.link}>{value === 0.5 ? '½' : value}×</Text></Pressable>)}</View> : null}
        <View style={styles.portionRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Decrease portion" disabled={amount <= amountStep} onPress={() => setServings(String(Math.max(amountStep, amount - amountStep)))} style={styles.step}><Ionicons name="remove" size={22} color={colors.text} /></Pressable>
          <TextInput accessibilityLabel={`Amount in ${logging?.amountUnit}`} placeholder={multiplier === 100 ? 'Enter amount' : undefined} placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" selectTextOnFocus value={servings} onChangeText={setServings} style={styles.portion} />
          <Text style={styles.label}>{logging?.amountUnit}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Increase portion" disabled={amount >= 20 * multiplier} onPress={() => setServings(String(Math.min(20 * multiplier, amount + amountStep)))} style={styles.step}><Ionicons name="add" size={22} color={colors.text} /></Pressable>
        </View>
        {portion === null ? <Text accessibilityRole="alert" style={styles.detail}>Enter more than 0 and no more than {20 * multiplier} {logging?.amountUnit}.</Text> : null}
        {multiplier === 100 ? <Text style={styles.detail}>The database has no label serving size. Enter the {logging?.amountUnit === 'g' ? 'weight' : 'volume'} you ate from the package or your measurement. {logging?.label} is only the nutrition reference, not one portion.</Text> : null}
        <View style={styles.nutrients}>{[
          ['Calories', logging?.nutrients.calories, 'kcal'], ['Protein', logging?.nutrients.protein_g, 'g'], ['Carbs', logging?.nutrients.carbs_g, 'g'], ['Fat', logging?.nutrients.fat_g, 'g']
        ].map(([label, amount, unit]) => <View key={String(label)} style={styles.nutrient}><Text style={styles.detail}>{label}</Text><Text style={styles.label}>{typeof amount === 'number' && portion !== null ? `${Math.round(amount * portion * 10) / 10} ${unit}` : 'Not reported'}</Text></View>)}</View>
        <Text style={styles.detail}>You’ll review the meal before saving. Missing label values stay unreported.</Text>
        {error ? <Text accessibilityRole="alert" style={styles.detail}>{error}</Text> : null}
      </> : <>
        <View style={styles.searchRow}>
          <TextInput accessibilityLabel="Search foods by name or brand" maxLength={120} autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => { if (tab === 'Search' && query.trim().length >= 2 && !searching) void onSearch(); }} value={query} onChangeText={onQueryChange} placeholder="Food or brand" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
          {tab === 'Search' ? <Pressable accessibilityRole="button" accessibilityLabel="Search food database" disabled={searching || query.trim().length < 2} onPress={() => void onSearch()} style={[styles.search, (searching || query.trim().length < 2) && styles.dim]}>{searching ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.primaryText}>Search</Text>}</Pressable> : null}
        </View>
        <SegmentedControl options={['Search', 'Recent', 'Saved'] as const} value={tab} onChange={setTab} />
        {onPhoto ? <ActionRow title="Photo meal" detail="Take or choose a photo" icon="camera-outline" onPress={onPhoto} last /> : null}
        {onOpenLibrary ? <ActionRow title="Your foods & meals" detail="Search all history and reuse a starred meal" icon="bookmark-outline" onPress={onOpenLibrary} last /> : null}
        {tab === 'Search' ? <>
          {results.length ? <Text style={styles.label}>{catalog.ready.length} foods ready to log</Text> : null}
          {catalog.ready.map((product) => {
            const key = `${product.provider}-${product.barcode}-${product.name}`;
            return <View key={key} style={styles.productRow}><ProductThumbnail url={product.image_url} name={product.name} onPress={() => choose(product, 'search')} /><View style={styles.libraryCopy}><ActionRow title={product.name} detail={foodSearchPortionDetail(product)} onPress={() => choose(product, 'search')} /></View><ScoreRing score={searchScores.get(key) ?? null} label={`${product.name}: quality ${searchScores.get(key) ?? 'not scored'}`} /></View>;
          })}
          {catalog.incomplete.length ? <>
            {!catalog.ready.length ? <Text style={styles.detail}>These matches still need label details. Scan the package or enter its nutrition to log it accurately.</Text> : null}
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showIncomplete }} onPress={() => setShowIncomplete(!showIncomplete)} style={styles.back}><Text style={styles.link}>{showIncomplete ? 'Hide' : 'Show'} {catalog.incomplete.length} matches needing label details</Text><Ionicons name={showIncomplete ? 'chevron-up' : 'chevron-down'} size={18} color={tabAccent.food} /></Pressable>
            {showIncomplete ? catalog.incomplete.map(product => <View key={`${product.provider}-${product.barcode}-${product.name}`} style={styles.productRow}><ProductThumbnail url={product.image_url} name={product.name} /><View style={styles.libraryCopy}><Text style={styles.label}>{product.name}</Text><Text style={styles.detail}>{foodSearchPortionDetail(product)}</Text><ActionRow title="Enter this food’s label" onPress={onManual} /></View></View>) : null}
          </> : null}
          <Text accessibilityLiveRegion="polite" style={styles.detail}>{searching ? 'Searching the food database…' : message || 'Enter a food or brand, then tap Search. For example: Greek yogurt or whole grain bread.'}</Text>
          <Text style={styles.source}>Food data: Open Food Facts{results.some(p => p.provider === 'usda_food_data_central') ? ' · USDA FoodData Central' : ''}. Check the variety and package label; catalog records may be incomplete.</Text>
        </> : <>
          {personal.map((product) => <View key={product.id} style={styles.libraryRow}><ProductThumbnail url={userFoodProductRowToSnapshot(product).image_url} name={product.name} onPress={() => choose(userFoodProductRowToSnapshot(product), 'saved_food')} /><View style={styles.libraryCopy}><ActionRow title={product.name} detail={[product.brand, product.serving_size].filter(Boolean).join(' · ')} onPress={() => choose(userFoodProductRowToSnapshot(product), 'saved_food')} /></View><ScoreRing score={product.quality_score} size={34} label={`${product.name}: quality ${product.quality_score ?? 'not scored'}`} /><Pressable accessibilityRole="button" disabled={busy} accessibilityLabel={product.is_saved ? `Unsave ${product.name}` : `Save ${product.name} for later`} onPress={() => void toggleSaved(product)} style={[styles.step, busy && styles.dim]}><Ionicons name={product.is_saved ? 'bookmark' : 'bookmark-outline'} size={21} color={tabAccent.food} /></Pressable></View>)}
          {!personal.length ? <Text style={styles.detail}>{query ? 'No matching foods in this list. Try Search for more options.' : tab === 'Saved' ? 'Bookmark foods in Recent to keep them here for next time.' : 'Foods you use will appear here. Search or scan to begin.'}</Text> : null}
        </>}
        {error ? <Text accessibilityRole="alert" style={styles.detail}>{error}</Text> : null}
        <View><ActionRow title="Scan a barcode" detail="Use the camera or type the numbers" icon="barcode-outline" onPress={onScan} /><ActionRow title="Enter nutrition manually" detail="For a label or food you can’t find" icon="create-outline" onPress={onManual} last /></View>
      </>}
    </EntrySheet>
  );
}
const styles = StyleSheet.create({
  portionChoices: { gap: 8 }, portionChoice: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.surfaceInset, minHeight: 44 }, portionChoiceSelected: { borderColor: tabAccent.food, backgroundColor: colors.surfaceInset },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { ...type.heading, color: colors.text }, detail: { ...type.body, color: colors.textMuted }, label: { ...type.label, color: colors.text },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }, link: { ...type.label, color: tabAccent.food },
  searchRow: { flexDirection: 'row', gap: 8 }, searchInput: { ...type.body, color: colors.text, minWidth: 0, flex: 1, backgroundColor: colors.surfaceInset, minHeight: 50, paddingHorizontal: 14, borderRadius: 14 },
  search: { backgroundColor: tabAccent.food, minWidth: 70, paddingHorizontal: 12, minHeight: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 14 }, source: { ...type.caption, color: colors.textMuted },
  primary: { backgroundColor: tabAccent.food, alignItems: 'center', justifyContent: 'center', borderRadius: 14, minHeight: 52, padding: 12 }, primaryText: { ...type.body, fontWeight: '600', color: colors.primaryText }, dim: { opacity: 0.5 },
  portionRow: { flexDirection: 'row', gap: 12, alignItems: 'center' }, step: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.surfaceInset }, portion: { ...type.numberLg, color: colors.text, flex: 1, minHeight: 54, textAlign: 'center', backgroundColor: colors.surfaceInset, borderRadius: 14 },
  nutrients: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, nutrient: { minWidth: '40%', flex: 1, gap: 4 }, libraryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, libraryCopy: { flex: 1 }
});
