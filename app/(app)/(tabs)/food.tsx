import { Ionicons } from '@expo/vector-icons';
import { useLocalToday } from '../../../src/features/navigation/useLocalToday';
import { rolloverDiaryDay } from '../../../src/utils/localDay';
import { searchFoods } from '../../../src/features/nutrition/productLookup/foodSearchClient';
import { NutritionGoalSetup } from '../../../src/features/nutrition/NutritionGoalSetup';
import { unsetNutritionTargets } from '../../../src/features/nutrition/nutritionGoalEngine';
import type { GoalClient } from '../../../src/features/nutrition/nutritionGoalStore';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { ActionRow } from '../../../src/components/mobile/ActionRow';
import { DietIntakeSummary, DietWeekSelector } from '../../../src/features/nutrition/DietDashboard';
import { HydrationCard } from '../../../src/features/nutrition/HydrationCard';
import type { HydrationClient } from '../../../src/features/nutrition/hydrationStore';
import { Disclosure } from '../../../src/components/mobile/Disclosure';
import { EntrySheet } from '../../../src/components/mobile/EntrySheet';
import { SegmentedControl } from '../../../src/components/mobile/SegmentedControl';
import { useQuickEntry } from '../../../src/features/navigation/useQuickEntry';
import { dayTitle } from '../../../src/features/navigation/navigationModel';
import { FoodEntryPicker } from '../../../src/features/nutrition/FoodEntryPicker';
import { MealDiarySections } from '../../../src/features/nutrition/MealDiarySections';
import { chooseMealDraft, diaryMealChoices, mealTypeLabel } from '../../../src/features/nutrition/mealDiaryModel';
import { foodLoggingNutrition } from '../../../src/features/nutrition/foodLoggingNutrition';
import { loggedAtForDay, mealsForDay, portionValue } from '../../../src/features/nutrition/foodDiaryPresentation';
import type { MealBuilderItem } from '../../../src/features/nutrition/mealBuilder';
import { MealEditSheet } from '../../../src/features/nutrition/MealEditSheet';
import { MealLibrarySheet, MealMacroGrid } from '../../../src/features/nutrition/MealLibrarySheet';
import { FoodQualityReviewPanel } from '../../../src/features/nutrition/FoodQualityReviewPanel';
import { buildFoodQualityReview } from '../../../src/features/nutrition/foodQualityReview';
import { buildEditedMeal, createMealCollectionEntry, mealEntryToBuilder, type MealCollectionEntry } from '../../../src/features/nutrition/mealLibrary';
import { persistMealItemEdit, type MealCollectionClient } from '../../../src/features/nutrition/mealCollectionStore';
import { applyMealEdit, createMealEditDraft, persistMealEdit, type MealEditClient, type MealEditDraft } from '../../../src/features/nutrition/mealEditing';

import {
  calculateFoodPatternProfile,
  calculateFoodQuality,
  calculateFoodResponse,
  calculateNutrientSummary,
  generateNutritionReadinessSignal,
  getFoodPatternResultCopy,
  type FoodPatternProfile,
  type FoodQualityFlag,
  type MealLog,
  type MealType,
  type NutritionTargets
} from '../../../src/engines/nutrition';
import { featureFlags } from '../../../src/config/featureFlags';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import {
  initialLabEvidenceClientState,
  labEvidenceClientStateCopy,
  labEvidenceStatusCopy,
  lookupLabEvidenceState,
  type LabEvidenceClientState
} from '../../../src/features/nutrition/labEvidence/labEvidenceClient';
import { formatLabAnalyte } from '../../../src/features/nutrition/labEvidence/labEvidenceMatcher';
import { toLabEvidenceReferenceSnapshot } from '../../../src/features/nutrition/labEvidence/resolution';
import { protocolScope, useActiveProtocol } from '../../../src/features/dailyProtocol';
import {
  getActiveFoodPatternProfile,
  getRecentPostMealResponseLogs,
  replaceActiveFoodPatternProfile,
  savePostMealResponseLog,
  type FoodPersonalizationSupabaseClient,
  type PostMealResponseLogInput,
  type PostMealResponseLogRow
} from '../../../src/features/nutrition/foodPersonalizationPersistence';
import {
  createEmptyManualMealForm,
  createEmptyResponseLogForm,
  demoModeLabel,
  foodPatternDraftToAnswers,
  foodPatternQuestions,
  manualMealFormToMealLog,
  mealTypes,
  qualityFlagOptions,
  responseLogFormToInput,
  type FoodPatternAnswerDraft,
  type ManualMealFormState,
  type ResponseLogFormState
} from '../../../src/features/nutrition/foodTabForms';
import {
  buildAdaptiveDietPresentation,
  type AdaptiveDietDestination
} from '../../../src/features/nutrition/adaptiveDietPresentation';
import {
  appendLocalDemoMealLog,
  appendLocalDemoMealLogItems,
  appendLocalDemoPostMealResponse,
  cacheLocalDemoUserFoodProduct,
  getLocalDemoNutritionState,
  saveLocalDemoFoodPatternProfile,
  saveLocalDemoMealLogs,
  replaceLocalDemoMealItems,
  updateLocalDemoUserFoodProduct
} from '../../../src/features/nutrition/localDemoNutritionStore';
import {
  addMealBuilderItem,
  calculateMealBuilderTotals,
  createEmptyManualProductForm,
  createEmptyMealBuilder,
  mealBuilderItemToPersistenceInput,
  mealBuilderToAggregateMealLog,
  removeMealBuilderItem,
  updateMealBuilderItemServings,
  userFoodProductRowToSnapshot,
  validateManualProductForm,
  type ManualProductFormState,
  type MealBuilderState
} from '../../../src/features/nutrition/mealBuilder';
import {
  saveMealLogItems,
  toMealLogItemInsert,
  getMealLogItemsForDate,
  getMealLogItemsForMealLog,
  type MealItemSupabaseClient,
  type MealLogItemRow
} from '../../../src/features/nutrition/mealItemPersistence';
import {
  getActiveNutritionTarget,
  getMealLogsForDate,
  saveMealLog,
  type MealLogRow,
  type NutritionSupabaseClient,
  type NutritionTargetRow
} from '../../../src/features/nutrition/persistence';
import {
  barcodeLookupCandidates,
  normalizeBarcode,
  shouldProcessBarcodeScan,
  type BarcodeScanStamp
} from '../../../src/features/nutrition/productLookup/barcodeUtils';
import { searchOpenFoodFactsProducts } from '../../../src/features/nutrition/productLookup/openFoodFactsClient';
import { lookupResolvedProduct } from '../../../src/features/nutrition/productLookup/productResolverClient';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import { buildProductQualityScorePresentation } from '../../../src/features/nutrition/productLookup/productQualityPresentation';
import { explainProductScore } from '../../../src/engines/nutrition/productScoring/explain';
import { ProductVerdict } from '../../../src/features/nutrition/ProductVerdict';
import { ScoreRing } from '../../../src/features/nutrition/ScoreRing';
import { mergeProductSnapshots } from '../../../src/features/nutrition/productLookup/mergeProductEvidence';
import {
  derivePrimaryScannerState,
  type PrimaryScannerState
} from '../../../src/features/nutrition/productLookup/scannerState';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';
import {
  getRecentUserFoodProducts,
  getSavedUserFoodProducts,
  markUserFoodProductSaved,
  upsertUserFoodProductFromSnapshot,
  productSnapshotValue,
  shouldRefreshCachedProduct,
  updateUserFoodProductLastUsed,
  type ProductLibrarySupabaseClient,
  type UserFoodProductRow
} from '../../../src/features/nutrition/productLibraryPersistence';
import {
  normalizeServingQuantity,
  scannedProductToMealLog
} from '../../../src/features/nutrition/scannedMealLogMapper';
import { isSupabaseConfigured, supabase } from '../../../src/lib/supabase';
import { PhotoEstimateSheet } from '../../../src/features/nutrition/photoEstimate/PhotoEstimateSheet';
import { PhotoEntrySheet } from '../../../src/features/nutrition/photoEstimate/PhotoEntrySheet';
import { capturePhotoForEstimate, type PhotoCaptureSource } from '../../../src/features/nutrition/photoEstimate/photoCapture';
import { photoEstimateItemToSnapshot } from '../../../src/features/nutrition/photoEstimate/photoEstimate';
import {
  photoEstimateRefusalTitle,
  requestPhotoEstimate,
  type PhotoEstimateInvoker
} from '../../../src/features/nutrition/photoEstimate/photoEstimateClient';
import type { PhotoEstimate } from '../../../src/features/nutrition/photoEstimate/photoEstimateTypes';
import type { AllergenGroup } from '../../../src/features/nutrition/allergens';
import { allergenProfileScope, readAllergenProfile } from '../../../src/features/nutrition/allergenProfileStore';
import {
  colors,
  colors as themeColors,
  fonts as themeFonts,
  hairlineWidth,
  palette,
  type as themeType
} from '../../../src/styles/mobileTheme';

const C = {
  bg: themeColors.background,
  card: themeColors.surface,
  hairline: themeColors.hairline,
  gold: themeColors.accent,
  goldSoft: themeColors.accentMid,
  lavender: themeColors.accentMid,
  teal: themeColors.accentSoft,
  ink: themeColors.text,
  sub: themeColors.textMuted,
  muted: themeColors.textFaint
} as const;

const serif = themeFonts.display;
const serifLight = themeFonts.displayLight;
const serifItalic = themeFonts.displayItalic;
const sans = themeFonts.body;
const sansMedium = themeFonts.bodyMedium;
/*
 * Which scoring kernel this build shipped with.
 *
 * Expo inlines the value at build time, so a bundle carries exactly one answer and the
 * losing branches are stripped. That is fine until someone is looking at a screenshot
 * and cannot tell a current build from a stale one that a browser is still caching —
 * which has now cost two rounds of "it doesn't update". So whichever experiment is
 * live says its own name on the scanner, and a build with no banner at all is the
 * shipping default rather than an unlabelled unknown.
 */
const productQualityExperiment = process.env.EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT ?? '';
const productQualityExperimentEnabled = productQualityExperiment === 'v5_two_axis';
const compositionKernelEnabled = productQualityExperiment === 'v6_composition';

const defaultTargets: NutritionTargets = unsetNutritionTargets;

const dietTabs = ['Diary', 'Nutrients', 'Quality'] as const;
type DietTab = typeof dietTabs[number];
type Segment = DietTab | 'Today' | 'Timeline' | 'Profile' | 'Build Meal' | 'Log Meal' | 'Response Log' | 'Food Pattern Test' | 'Insights';

function dateKey(value: string): string {
  return value.slice(0, 10);
}

function formatClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function confidenceLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function displayLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatProductAmount(value: number | null | undefined, suffix = ''): string {
  if (typeof value !== 'number') return '-';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}${suffix}`;
}

function confidenceText(confidence: string): string {
  return `Confidence: ${confidence}`;
}

function remoteEnabled(sessionUserId?: string | null): boolean {
  return Boolean(isSupabaseConfigured && sessionUserId && sessionUserId !== 'demo-user');
}

function mealRowToMealLog(row: MealLogRow): MealLog {
  return {
    id: row.id,
    user_id: row.user_id,
    logged_at: row.logged_at,
    meal_type: row.meal_type,
    name: row.name,
    source: row.source,
    source_confidence: row.source_confidence,
    calories: row.calories,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    fiber_g: row.fiber_g,
    sugar_g: row.sugar_g,
    sodium_mg: row.sodium_mg,
    micronutrients: row.micronutrients ?? null,
    ingredients: row.ingredients,
    quality_flags: row.quality_flags,
    user_response: row.user_response,
    corrected_by_user: row.corrected_by_user,
    confirmed_by_user: row.confirmed_by_user,
    reason_codes: row.reason_codes,
    created_at: row.created_at
  };
}

function targetRowToTarget(row: NutritionTargetRow | null): NutritionTargets {
  if (!row || row.basis.every(b => b === 'default')) return defaultTargets;

  return {
    calories_target: row.calories_target,
    protein_g_target: row.protein_g_target,
    carbs_g_target: row.carbs_g_target,
    fat_g_target: row.fat_g_target,
    fiber_g_target: row.fiber_g_target,
    sodium_mg_limit: row.sodium_mg_limit,
    confidence: row.confidence,
    basis: row.basis
  };
}

function createLocalDemoProductRow(
  snapshot: HealthiProductSnapshot,
  source: UserFoodProductRow['source'],
  isSaved = false
): UserFoodProductRow {
  const now = new Date().toISOString();
  const quality = calculateProductQuality(snapshot);

  return {
    id: `local-food-product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user_id: 'demo-user',
    barcode: snapshot.barcode.trim() || null,
    provider: snapshot.provider,
    provider_product_id: snapshot.provider_product_id ?? null,
    name: snapshot.name,
    brand: snapshot.brand ?? null,
    serving_size: snapshot.serving_size ?? null,
    serving_quantity_g: snapshot.serving_quantity_g ?? null,
    calories_per_serving: snapshot.calories_per_serving ?? null,
    protein_g: snapshot.protein_g ?? null,
    carbs_g: snapshot.carbs_g ?? null,
    fat_g: snapshot.fat_g ?? null,
    fiber_g: snapshot.fiber_g ?? null,
    sugar_g: snapshot.sugar_g ?? null,
    sodium_mg: snapshot.sodium_mg ?? null,
    saturated_fat_g: snapshot.saturated_fat_g ?? null,
    ingredients_text: snapshot.ingredients_text ?? null,
    quality_label: quality.label,
    quality_score: quality.score,
    quality_confidence: quality.confidence,
    quality_flags: [...snapshot.quality_flags],
    quality_reason_codes: [...quality.reason_codes],
    quality_snapshot: productSnapshotValue(snapshot, quality),
    lab_evidence_state: snapshot.lab_evidence_reference
      ? JSON.parse(JSON.stringify(snapshot.lab_evidence_reference))
      : null,
    is_saved: isSaved,
    last_used_at: now,
    last_scanned_at: source === 'scanner' ? now : null,
    source,
    source_confidence: snapshot.confidence,
    created_at: now,
    updated_at: now
  };
}

function profileRowToProfile(row: NonNullable<Awaited<ReturnType<typeof getActiveFoodPatternProfile>>>): FoodPatternProfile {
  return {
    id: row.id,
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    source: row.source,
    confidence: row.confidence,
    pattern_label: row.pattern_label,
    scores: row.scores,
    macro_tendency: row.macro_tendency,
    meal_timing_tendency: row.meal_timing_tendency,
    response_tendencies: row.response_tendencies,
    reason_codes: row.reason_codes
  };
}

function applyResponseToMealLogs(meals: MealLog[], response: PostMealResponseLogInput): MealLog[] {
  return meals.map((meal) =>
    meal.id === response.meal_log_id
      ? {
          ...meal,
          user_response: {
            digestion: response.digestion,
            energy: response.energy,
            appetite: response.appetite,
            cravings: response.cravings,
            notes: response.notes
          }
        }
      : meal
  );
}

function createLocalDemoResponseRow(response: PostMealResponseLogInput, userId = 'demo-user'): PostMealResponseLogRow {
  const now = new Date().toISOString();

  return {
    id: `local-response-${Date.now()}`,
    user_id: userId,
    meal_log_id: response.meal_log_id ?? null,
    responded_at: response.responded_at,
    minutes_after_meal: response.minutes_after_meal ?? null,
    overall_score: response.overall_score,
    digestion: response.digestion ?? null,
    energy: response.energy ?? null,
    appetite: response.appetite ?? null,
    focus: response.focus ?? null,
    cravings: response.cravings ?? null,
    notes: response.notes ?? null,
    confidence: response.confidence,
    reason_codes: [...response.reason_codes],
    created_at: now,
    updated_at: now
  };
}

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Chip({
  label,
  selected,
  onPress
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  /** Legacy prop - every tone now resolves to the single jade accent. */
  tone?: 'gold' | 'lavender' | 'teal';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline,
  onSubmitEditing,
  returnKeyType,
  style
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'next' | 'search';
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        returnKeyType={returnKeyType}
        style={[styles.input, multiline && styles.textarea]}
        value={value}
      />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  loading
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, (disabled || loading) && styles.disabled, pressed && styles.pressed]}
    >
      {loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

function Metric({ label, value, tone = colors.text }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={[styles.metricValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

function TrackerProgress({
  label,
  current,
  target,
  unit = 'g'
}: {
  label: string;
  current: number | null | undefined;
  target: number | null | undefined;
  unit?: string;
}) {
  const progress = typeof current === 'number' && typeof target === 'number' && target > 0
    ? Math.max(0, Math.min(current / target, 1))
    : 0;
  const value = typeof current !== 'number'
    ? 'Not reported'
    : typeof target === 'number'
      ? `${Math.round(current)} / ${Math.round(target)} ${unit}`
      : `${Math.round(current)} ${unit}`;

  return (
    <View style={styles.trackerProgress}>
      <View style={styles.adaptiveSectionHeading}>
        <Text style={styles.trackerProgressLabel}>{label}</Text>
        <Text style={styles.adaptiveMonoStrong}>{value}</Text>
      </View>
      <View style={styles.trackerRail}>
        <View style={[styles.trackerFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

export default function FoodScreen() {
  const { session, mode } = useAuth();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [activeSegment, setActiveSegment] = useState<Segment>('Diary');
  const actualToday = useLocalToday();
  const [selectedDay, setSelectedDay] = useState(actualToday);
  const previousToday = useRef(actualToday);
  useEffect(() => {
    const previous = previousToday.current;
    setSelectedDay(day => rolloverDiaryDay(day, previous, actualToday, !dietTabs.includes(activeSegment as DietTab)));
    previousToday.current = actualToday;
  }, [actualToday, activeSegment]);
  const [foodEntryOpen, setFoodEntryOpen] = useState(false);
  const [mealChooserOpen, setMealChooserOpen] = useState(false);
  const [mealStartMessage, setMealStartMessage] = useState('');
  const [manualFoodOpen, setManualFoodOpen] = useState(false);
  const [manualFoodError, setManualFoodError] = useState('');
  const [isAddingManualFood, setIsAddingManualFood] = useState(false);
  const [removedItem, setRemovedItem] = useState<MealBuilderItem | null>(null);
  const [servingDrafts, setServingDrafts] = useState<Record<string, string>>({});
  const [selectedMeal, setSelectedMeal] = useState<MealLog | null>(null);
  const [editingMeal, setEditingMeal] = useState<MealLog | null>(null);
  const [mealLibraryOpen, setMealLibraryOpen] = useState(false);
  const [libraryInitialEntry, setLibraryInitialEntry] = useState<MealCollectionEntry | null>(null);
  const [mealDetailMessage, setMealDetailMessage] = useState('');
  const [searchMessage, setSearchMessage] = useState('');
  const [mealEditDraft, setMealEditDraft] = useState<MealEditDraft | null>(null);
  const [mealEditError, setMealEditError] = useState('');
  const [savingMealEdit, setSavingMealEdit] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollPositions = useRef<Record<string, number>>({});
  useQuickEntry(() => setMealChooserOpen(true));
  const [expandedLane, setExpandedLane] = useState<string | null>(null);
  const [nutrientQuery, setNutrientQuery] = useState('');
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [responses, setResponses] = useState<PostMealResponseLogRow[]>([]);
  const [targets, setTargets] = useState<NutritionTargets>(defaultTargets);
  const [activeProfile, setActiveProfile] = useState<FoodPatternProfile | null>(null);
  const [mealForm, setMealForm] = useState<ManualMealFormState>(() => createEmptyManualMealForm());
  const [responseForm, setResponseForm] = useState<ResponseLogFormState>(() => createEmptyResponseLogForm());
  const [testAnswers, setTestAnswers] = useState<FoodPatternAnswerDraft>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [testResult, setTestResult] = useState<FoodPatternProfile | null>(null);
  const [status, setStatus] = useState('Food response is still calibrating.');
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [photoEstimate, setPhotoEstimate] = useState<PhotoEstimate | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNotice, setPhotoNotice] = useState('');
  const [photoEntryOpen, setPhotoEntryOpen] = useState(false);
  const [avoidingAllergens, setAvoidingAllergens] = useState<AllergenGroup[]>([]);
  useEffect(() => {
    const key = scannerOpen ? 'scanner' : activeSegment;
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: scrollPositions.current[key] ?? 0, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [activeSegment, scannerOpen]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannerProduct, setScannerProduct] = useState<HealthiProductSnapshot | null>(null);
  const [showBetterOptions, setShowBetterOptions] = useState(false);
  const [showProductEvidence, setShowProductEvidence] = useState(false);
  const [showLabEvidence, setShowLabEvidence] = useState(false);
  const [showCertifications, setShowCertifications] = useState(false);
  const [showRegulatoryStatus, setShowRegulatoryStatus] = useState(false);
  const [showEvidenceContext, setShowEvidenceContext] = useState(false);
  const [labEvidenceState, setLabEvidenceState] = useState<LabEvidenceClientState>(() => (
    initialLabEvidenceClientState(featureFlags.labEvidence)
  ));
  const [scannerLookupState, setScannerLookupState] = useState<PrimaryScannerState>('idle');
  const [scannerLotNumber, setScannerLotNumber] = useState('');
  const [scannerMessage, setScannerMessage] = useState('Scan a barcode or enter its numbers below.');
  const [scannerMealType, setScannerMealType] = useState<MealType>('unknown');
  const [scannerServingQuantity, setScannerServingQuantity] = useState('1');
  const [scannerMealName, setScannerMealName] = useState('');
  const [isLookingUpProduct, setIsLookingUpProduct] = useState(false);
  const [isSavingScannedMeal, setIsSavingScannedMeal] = useState(false);
  const [scannerDestination, setScannerDestination] = useState<'log' | 'builder'>('log');
  const [mealBuilder, setMealBuilder] = useState<MealBuilderState>(() => createEmptyMealBuilder());
  const [manualProductForm, setManualProductForm] = useState<ManualProductFormState>(() => createEmptyManualProductForm());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HealthiProductSnapshot[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const searchGeneration = useRef(0);
  const searchController = useRef<AbortController | null>(null);
  useEffect(() => () => { searchGeneration.current += 1; searchController.current?.abort(); }, []);
  const [builderMessage, setBuilderMessage] = useState('Add foods to build one meal with clear totals.');
  const [isSavingBuilder, setIsSavingBuilder] = useState(false);
  const [productLibrary, setProductLibrary] = useState<UserFoodProductRow[]>([]);
  const [mealLogItems, setMealLogItems] = useState<MealLogItemRow[]>([]);
  const lastBarcodeScan = useRef<BarcodeScanStamp | null>(null);
  const lookupInFlight = useRef(false);
  const lookupRequestId = useRef(0);

  const userId = session?.user.id ?? null;
  const canUseRemote = remoteEnabled(userId);
  useEffect(() => { setTargets(defaultTargets); }, [userId, mode]);
  useEffect(() => {
    setMealLibraryOpen(false); setSelectedMeal(null); setEditingMeal(null); setMealEditDraft(null);
    setMealBuilder(createEmptyMealBuilder()); setServingDrafts({}); setRemovedItem(null);
  }, [userId, mode]);
  const today = selectedDay;
  const protocolScopeValue = useMemo(() => protocolScope(userId), [userId]);
  useEffect(() => {
    let active = true;
    void readAllergenProfile(allergenProfileScope(userId)).then((groups) => {
      if (active) setAvoidingAllergens(groups);
    });
    return () => { active = false; };
  }, [userId]);
  const activeProtocol = useActiveProtocol(protocolScopeValue, today);
  const protocolNourishment = (activeProtocol?.actions ?? []).filter((action) => action.domain === 'nourishment');
  const modeLabel = demoModeLabel(isSupabaseConfigured, Boolean(userId && userId !== 'demo-user'));
  const todayMeals = useMemo(() => mealsForDay(meals, today), [meals, today]);
  /**
   * Today's logged items, graded. Every meal item already carries the score the scanner
   * gave it, so this needs no lookup; the product library is joined only to read the
   * ingredient lists behind the low grades.
   */
  const qualityReview = useMemo(() => {
    const todayIds = new Set(todayMeals.map((meal) => meal.id));
    return buildFoodQualityReview({
      items: mealLogItems
        .filter((entry) => entry.meal_log_id === null || todayIds.has(entry.meal_log_id))
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          quality_score: entry.quality_score,
          logged_at: entry.logged_at,
          barcode: entry.barcode
        })),
      products: productLibrary.map((product) => ({
        barcode: product.barcode,
        name: product.name,
        ingredients_text: product.ingredients_text
      }))
    });
  }, [mealLogItems, productLibrary, todayMeals]);

  const nutrientSummary = useMemo(
    () => calculateNutrientSummary({ date: today, meals: todayMeals, targets }),
    [today, todayMeals, targets]
  );
  const foodQuality = useMemo(
    () => calculateFoodQuality({ date: today, meals: todayMeals, nutrientSummary }),
    [today, todayMeals, nutrientSummary]
  );
  const foodResponse = useMemo(() => calculateFoodResponse({ date: today, meals: todayMeals }), [today, todayMeals]);
  const readinessSignal = useMemo(
    () => generateNutritionReadinessSignal({ date: today, nutrientSummary, foodQuality, foodResponse }),
    [today, nutrientSummary, foodQuality, foodResponse]
  );
  const profileCopy = activeProfile ? getFoodPatternResultCopy(activeProfile) : null;
  const testCopy = testResult ? getFoodPatternResultCopy(testResult) : null;
  const currentQuestion = foodPatternQuestions[questionIndex];
  const productQuality = useMemo(
    () => scannerProduct ? calculateProductQuality(scannerProduct) : null,
    [scannerProduct]
  );
  /**
   * Why the score is the score, read from the same label and the same ledger the score
   * came from. Derived rather than held, so it cannot go stale against the product.
   */
  const productExplanation = useMemo(() => {
    if (!scannerProduct || !productQuality) return null;
    const basis = productQuality.nutrient_basis ?? null;
    const perHundred = basis?.type === 'per_100g';
    return explainProductScore({
      ingredientsText: scannerProduct.ingredients_text ?? null,
      nutrients: basis?.nutrients ?? null,
      basisLabel: perHundred
        ? (scannerProduct.nutriments_per_100ml && !scannerProduct.nutriments_per_100g ? '100 ml' : '100 g')
        : scannerProduct.serving_size ?? 'serving',
      dimensions: productQuality.dimensions ?? [],
      grade: productQuality.letter_grade ?? null
    });
  }, [scannerProduct, productQuality]);
  const primaryScannerState = derivePrimaryScannerState({
    lookupState: scannerLookupState,
    hasProduct: Boolean(scannerProduct),
    qualityResultState: productQuality?.result_state
  });
  const labEvidenceResolution = labEvidenceState.resolution;
  const isLookingUpLabEvidence = labEvidenceState.state === 'checking';
  const labEvidenceLookupCompleted = Boolean(
    featureFlags.labEvidence
      && labEvidenceResolution
      && (labEvidenceState.state === 'available' || labEvidenceState.state === 'none_found')
  );
  const mealBuilderTotals = useMemo(() => calculateMealBuilderTotals(mealBuilder.items), [mealBuilder.items]);
  const savedProducts = useMemo(() => productLibrary.filter((product) => product.is_saved), [productLibrary]);
  const adaptiveDiet = useMemo(
    () => buildAdaptiveDietPresentation({
      summary: nutrientSummary,
      targets,
      quality: foodQuality,
      response: foodResponse,
      readiness: readinessSignal,
      responseCount: responses.length
    }),
    [foodQuality, foodResponse, nutrientSummary, readinessSignal, responses.length, targets]
  );
  const filteredAdaptiveNutrients = useMemo(() => {
    const query = nutrientQuery.trim().toLowerCase();
    return query
      ? adaptiveDiet.nutrients.filter((nutrient) => nutrient.name.toLowerCase().includes(query))
      : adaptiveDiet.nutrients;
  }, [adaptiveDiet.nutrients, nutrientQuery]);

  useEffect(() => {
    setShowBetterOptions(false);
    setShowProductEvidence(false);
    setShowLabEvidence(false);
    setShowCertifications(false);
    setShowRegulatoryStatus(false);
    setShowEvidenceContext(false);
  }, [scannerProduct?.barcode]);

  useEffect(() => {
    if (!canUseRemote || !userId) return;

    let isMounted = true;
    const nutritionClient = supabase as unknown as NutritionSupabaseClient;
    const foodClient = supabase as unknown as FoodPersonalizationSupabaseClient;
    const productClient = supabase as unknown as ProductLibrarySupabaseClient;
    const itemClient = supabase as unknown as MealItemSupabaseClient;

    setIsLoadingRemote(true);
    Promise.all([
      getMealLogsForDate(nutritionClient, userId, today),
      getActiveNutritionTarget(nutritionClient, userId),
      getActiveFoodPatternProfile(foodClient, userId),
      getRecentPostMealResponseLogs(foodClient, userId, 20)
    ])
      .then(([mealRows, targetRow, profileRow, responseRows]) => {
        if (!isMounted) return;
        setMeals(mealRows.map(mealRowToMealLog));
        setTargets(targetRowToTarget(targetRow));
        setActiveProfile(profileRow ? profileRowToProfile(profileRow) : null);
        setResponses(responseRows);
        setStatus('Based on available data.');
      })
      .catch(() => {
        if (isMounted) setStatus('Remote food data could not load. This preview is local for now.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingRemote(false);
      });

    // The V2 detail tables can be migrated independently from existing meal logs.
    // Keep the established Food tab usable when a local Supabase project has not applied 0007 yet.
    Promise.all([
      getRecentUserFoodProducts(productClient, userId, 18),
      getSavedUserFoodProducts(productClient, userId, 30),
      getMealLogItemsForDate(itemClient, userId, today)
    ])
      .then(([recentProducts, savedProducts, savedItems]) => {
        if (!isMounted) return;
        const mergedProducts = [...recentProducts, ...savedProducts].filter(
          (product, index, list) => list.findIndex((candidate) => candidate.id === product.id) === index
        );
        setProductLibrary(mergedProducts);
        setMealLogItems(savedItems);
      })
      .catch(() => {
        if (!isMounted) return;
        setProductLibrary([]);
        setMealLogItems([]);
      });

    return () => {
      isMounted = false;
    };
  }, [canUseRemote, today, userId]);

  useEffect(() => {
    if (canUseRemote) return;

    let isMounted = true;
    setIsLoadingRemote(true);

    getLocalDemoNutritionState()
      .then((state) => {
        if (!isMounted) return;
        setMeals(state.mealLogs);
        setResponses(state.postMealResponses);
        setActiveProfile(state.foodPatternProfile);
        setProductLibrary(state.userFoodProducts);
        setMealLogItems(state.mealLogItems);
        setStatus(state.mealLogs.length > 0 ? 'Loaded local demo food data.' : 'Food response is still calibrating.');
      })
      .catch(() => {
        if (isMounted) setStatus('Local demo food data could not load.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingRemote(false);
      });

    return () => {
      isMounted = false;
    };
  }, [canUseRemote]);

  function updateMealForm<K extends keyof ManualMealFormState>(key: K, value: ManualMealFormState[K]) {
    setMealForm((current) => ({ ...current, [key]: value }));
  }

  function updateResponseForm<K extends keyof ResponseLogFormState>(key: K, value: ResponseLogFormState[K]) {
    setResponseForm((current) => ({ ...current, [key]: value }));
  }

  function toggleQualityFlag(flag: FoodQualityFlag) {
    updateMealForm(
      'quality_flags',
      mealForm.quality_flags.includes(flag)
        ? mealForm.quality_flags.filter((current) => current !== flag)
        : [...mealForm.quality_flags, flag]
    );
  }

  async function cacheProductSnapshot(
    snapshot: HealthiProductSnapshot,
    source: UserFoodProductRow['source']
  ): Promise<UserFoodProductRow | null> {
    const now = new Date().toISOString();
    const quality = calculateProductQuality(snapshot);

    try {
      if (canUseRemote && userId) {
        const product = await upsertUserFoodProductFromSnapshot(
          supabase as unknown as ProductLibrarySupabaseClient,
          userId,
          {
            ...snapshot,
            quality,
            source,
            last_used_at: now,
            last_scanned_at: source === 'scanner' ? now : null
          }
        );
        setProductLibrary((current) => [product, ...current.filter((item) => item.id !== product.id)]);
        return product;
      }

      const product = createLocalDemoProductRow(snapshot, source);
      const nextProducts = await cacheLocalDemoUserFoodProduct(product);
      setProductLibrary(nextProducts);
      return nextProducts.find((item) => item.id === product.id) ?? product;
    } catch {
      return null;
    }
  }

  async function addSnapshotToMealBuilder(
    snapshot: HealthiProductSnapshot,
    source: 'manual' | 'scanner' | 'search' | 'saved_food' | 'photo',
    servings = 1
  ) {
    // A photo estimate describes one plate rather than a product, so it is never cached as a
    // reusable library food; it would otherwise come back later looking like label evidence.
    const product = source === 'photo' || snapshot.provider === 'photo_estimate'
      ? null
      : await cacheProductSnapshot(snapshot, source === 'scanner' ? 'scanner' : snapshot.provider);
    setMealBuilder((current) => addMealBuilderItem(current, {
      snapshot,
      productId: product?.id ?? null,
      source,
      servings
    }));
    setBuilderMessage(source === 'photo'
      ? `${snapshot.name} is in this meal as an estimate.`
      : product
        ? `${snapshot.name} is in this meal.`
        : `${snapshot.name} is in this meal, but could not be added to your recent-food library.`);
  }

  /**
   * Takes a photo and asks for an estimate.
   *
   * Failures land in an inline notice rather than an alert, and a cancelled picker says
   * nothing at all — backing out of the camera is not an error worth reporting.
   */
  async function handlePhotoEstimate(source: PhotoCaptureSource) {
    if (photoBusy || !canUseRemote) return;
    setPhotoNotice('');
    setPhotoBusy(true);
    try {
      const captured = await capturePhotoForEstimate(source);
      if (!captured.ok) {
        if (captured.reason !== 'cancelled') setPhotoNotice(captured.detail);
        return;
      }
      setPhotoUri(captured.uri);
      const result = await requestPhotoEstimate({
        // Estimates cost money per call, so they need a signed-in account; in demo mode
        // there is no client to invoke and the request refuses as not configured.
        client: canUseRemote ? (supabase as unknown as PhotoEstimateInvoker) : null,
        imageBase64: captured.base64,
        mediaType: captured.mediaType
      });
      if (!result.ok) {
        setPhotoUri(null);
        setPhotoNotice(`${photoEstimateRefusalTitle(result.refusal)} — ${result.refusal.detail}`);
        return;
      }
      setPhotoEstimate(result.estimate);
      setPhotoEntryOpen(false);
    } catch {
      setPhotoUri(null);
      setPhotoNotice('Could not prepare your estimate. Try again, or search for the foods instead.');
    } finally {
      setPhotoBusy(false);
    }
  }

  function closePhotoEstimate() {
    setPhotoEstimate(null);
    setPhotoUri(null);
    setPhotoNotice('');
  }

  /** Confirms the reviewed estimate into the meal builder, one item at a time. */
  async function confirmPhotoEstimate() {
    if (!photoEstimate || photoBusy) return;
    setPhotoBusy(true);
    try {
      for (const item of photoEstimate.items) {
        await addSnapshotToMealBuilder(photoEstimateItemToSnapshot(item), 'photo');
      }
      const count = photoEstimate.items.length;
      closePhotoEstimate();
      setActiveSegment('Build Meal');
      setBuilderMessage(`${count} estimated ${count === 1 ? 'food is' : 'foods are'} in this meal. Check the totals before saving.`);
    } finally {
      setPhotoBusy(false);
    }
  }

  function openPhotoEntry() {
    setFoodEntryOpen(false);
    setMealChooserOpen(false);
    setPhotoNotice('');
    setPhotoEntryOpen(true);
  }

  async function handleSearchProducts() {
    if (isSearchingProducts || searchQuery.trim().length < 2) return;
    const generation = ++searchGeneration.current;
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setIsSearchingProducts(true);
    setSearchMessage('');
    try {
      const result = await searchFoods(searchQuery, { signal: controller.signal });
      if (generation !== searchGeneration.current) return;
      if (result.status !== 'error') setSearchResults(result.products);
      /*
       * When the search ran on something other than what was typed, say so. Quietly
       * swapping somebody's word is worse than not guessing: they cannot tell whether
       * the app misread them or the food is genuinely not listed.
       */
      const searchedFor = result.status === 'found' && result.searchedFor
        ? `Showing results for “${result.searchedFor}”. `
        : '';
      setSearchMessage(result.status === 'found' ? `${searchedFor}${result.notice ?? 'Choose a food to confirm your portion.'}` : result.message);
    } catch {
      if (generation === searchGeneration.current) setSearchMessage('Search is unavailable right now. Try again, or use Recent, Saved, or manual entry.');
    } finally { if (generation === searchGeneration.current) setIsSearchingProducts(false); }
  }

  function beginDiaryMeal(type: MealType) {
    const choice = chooseMealDraft(mealBuilder, type);
    if (choice.status === 'blocked') {
      setMealStartMessage(`You have an unfinished ${mealTypeLabel(mealBuilder.meal_type).toLowerCase()} meal. Save it before starting another meal.`);
      setMealChooserOpen(true);
      return;
    }
    setMealBuilder(choice.draft);
    setMealStartMessage('');
    setMealChooserOpen(false);
    setActiveSegment('Build Meal');
    setFoodEntryOpen(true);
  }

  async function handleAddManualProduct() {
    if (isAddingManualFood) return;
    const validation = validateManualProductForm(manualProductForm);
    if (!validation.valid) {
      setManualFoodError(validation.message);
      return;
    }
    setManualFoodError('');
    setIsAddingManualFood(true);
    try {
      await addSnapshotToMealBuilder(validation.snapshot, 'manual');
      setManualProductForm(createEmptyManualProductForm());
      setManualFoodOpen(false);
      setActiveSegment('Build Meal');
    } catch {
      setManualFoodError('Could not add this food. Your details are still here; please try again.');
    } finally { setIsAddingManualFood(false); }
  }

  async function handleToggleSavedProduct(product: UserFoodProductRow) {
    try {
      const nextSaved = !product.is_saved;
      if (canUseRemote && userId) {
        const saved = await markUserFoodProductSaved(
          supabase as unknown as ProductLibrarySupabaseClient,
          userId,
          product.id,
          nextSaved
        );
        setProductLibrary((current) => current.map((item) => item.id === saved.id ? saved : item));
      } else {
        const nextProducts = await updateLocalDemoUserFoodProduct(product.id, { is_saved: nextSaved });
        setProductLibrary(nextProducts);
      }
    } catch {
      throw new Error('Saved foods could not be updated. Your meal is unchanged.');
    }
  }

  async function handleSaveBuiltMeal() {
    if (isSavingBuilder) return;
    if (mealBuilder.items.some((item) => portionValue(servingDrafts[item.id] ?? String(item.servings)) === null)) {
      setBuilderMessage('Check the servings for each food before saving.');
      return;
    }
    if (mealBuilder.items.length === 0) {
      setBuilderMessage('Add at least one food before saving this meal.');
      return;
    }

    setIsSavingBuilder(true);
    const loggedAt = loggedAtForDay(today, new Date().toISOString());
    const meal = mealBuilderToAggregateMealLog(mealBuilder, loggedAt, !canUseRemote);

    try {
      if (editingMeal) {
        if (mode !== 'demo' && (!canUseRemote || !userId)) throw new Error('Sign in to save changes to your meal.');
        let updated = buildEditedMeal(editingMeal, mealBuilder, !canUseRemote);
        const inputs = mealBuilder.items.map(item => toMealLogItemInsert(
          mealBuilderItemToPersistenceInput(item, editingMeal.id!, editingMeal.logged_at, mealBuilder.meal_type, !canUseRemote), userId ?? 'demo-user'));
        if (canUseRemote && userId) {
          const result = await persistMealItemEdit(supabase as unknown as MealCollectionClient, editingMeal, updated, inputs);
          updated = mealRowToMealLog(result.meal);
          setMealLogItems(current => [...current.filter(item => item.meal_log_id !== updated.id), ...result.items]);
        } else {
          const rows = inputs.map((item, index) => ({ ...item, id: `edited-${Date.now()}-${index}`, created_at: editingMeal.created_at, updated_at: new Date().toISOString() }));
          const next = await replaceLocalDemoMealItems(updated, rows);
          setMealLogItems(next.items);
        }
        setMeals(current => current.map(row => row.id === updated.id ? updated : row));
        setEditingMeal(null);
        setStatus('Meal updated. Your diary totals now reflect these foods and portions.');
      } else if (canUseRemote && userId) {
        const savedMeal = await saveMealLog(supabase as unknown as NutritionSupabaseClient, userId, meal);
        const nextMeal = mealRowToMealLog(savedMeal);
        setMeals((current) => [nextMeal, ...current.filter((item) => item.id !== nextMeal.id)]);
        setResponseForm((current) => ({ ...current, meal_log_id: savedMeal.id }));

        try {
          const savedItems = await saveMealLogItems(
            supabase as unknown as MealItemSupabaseClient,
            userId,
            mealBuilder.items.map((item) => mealBuilderItemToPersistenceInput(item, savedMeal.id, loggedAt, mealBuilder.meal_type))
          );
          setMealLogItems((current) => [...savedItems, ...current]);
          await Promise.all(
            mealBuilder.items
              .filter((item) => item.food_product_id)
              .map((item) => updateUserFoodProductLastUsed(
                supabase as unknown as ProductLibrarySupabaseClient,
                userId,
                item.food_product_id as string,
                loggedAt
              ).catch(() => null))
          );
          setStatus('Meal saved. Today’s fueling totals have been updated.');
        } catch {
          setStatus('Meal totals saved, but item details could not sync. They are not available in meal history.');
        }
      } else {
        const localMeal = { ...meal, id: `local-built-meal-${Date.now()}` };
        const localItems = mealBuilder.items.map((item, index) => ({
          ...toMealLogItemInsert(
            mealBuilderItemToPersistenceInput(item, localMeal.id ?? null, loggedAt, mealBuilder.meal_type, true),
            'demo-user'
          ),
          id: `local-built-meal-item-${Date.now()}-${index + 1}`,
          created_at: loggedAt,
          updated_at: loggedAt
        }));
        await Promise.all([
          appendLocalDemoMealLog(localMeal),
          appendLocalDemoMealLogItems(localItems)
        ]);
        setMeals((current) => [localMeal, ...current.filter((item) => item.id !== localMeal.id)]);
        setMealLogItems((current) => [...localItems, ...current]);
        setResponseForm((current) => ({ ...current, meal_log_id: localMeal.id ?? null }));
        setStatus('Meal saved locally. Today’s fueling totals have been updated.');
      }

      setMealBuilder(createEmptyMealBuilder());
      setRemovedItem(null);
      setServingDrafts({});
      setSearchResults([]);
      setSearchQuery('');
      setBuilderMessage('Meal saved. Build another meal whenever you are ready.');
      setActiveSegment('Diary');
    } catch (error) {
      setBuilderMessage(error instanceof Error ? error.message : 'This meal could not be saved. Your items are still here so you can try again.');
    } finally {
      setIsSavingBuilder(false);
    }
  }

  async function handleAddScannerProductToBuilder() {
    if (!scannerProduct) return;
    const servingQuantity = normalizeServingQuantity(scannerServingQuantity);
    if (servingQuantity === null) {
      setScannerMessage('Enter a serving quantity greater than 0 and no more than 20.');
      return;
    }

    await addSnapshotToMealBuilder({
      ...scannerProduct,
      lab_evidence_reference: labEvidenceResolution
        ? toLabEvidenceReferenceSnapshot(labEvidenceResolution)
        : scannerProduct.lab_evidence_reference
    }, 'scanner', servingQuantity);
    setScannerProduct(null);
    setBarcodeInput('');
    setScannerServingQuantity('1');
    closeScanner();
    setActiveSegment('Build Meal');
  }

  function openScanner(destination: 'log' | 'builder' = 'builder') {
    setFoodEntryOpen(false);
    setScannerDestination(destination);
    setScannerOpen(true);
    setCameraOpen(false);
    setScannerMessage('Scan a barcode or enter its numbers below.');
    setScannerLookupState('idle');
    setLabEvidenceState(initialLabEvidenceClientState(featureFlags.labEvidence));
    setScannerLotNumber('');
  }

  function closeScanner() {
    lookupRequestId.current += 1;
    lookupInFlight.current = false;
    setScannerOpen(false);
    setCameraOpen(false);
    setIsLookingUpProduct(false);
  }

  async function handleStartCamera() {
    try {
      const cameraAvailable = await CameraView.isAvailableAsync();
      if (!cameraAvailable) {
        setScannerMessage('A camera is not available here. Enter the barcode manually below.');
        setCameraOpen(false);
        return;
      }

      if (cameraPermission?.granted) {
        setScannerMessage('Starting camera...');
        setCameraOpen(true);
        return;
      }

      const nextPermission = await requestCameraPermission();
      if (nextPermission.granted) {
        setScannerMessage('Starting camera...');
        setCameraOpen(true);
      } else {
        setScannerMessage('Camera access is unavailable. Enter the barcode manually below.');
        setCameraOpen(false);
      }
    } catch {
      setScannerMessage('The camera could not start here. Enter the barcode manually below.');
      setCameraOpen(false);
    }
  }

  async function resolveEvidenceForProduct(product: HealthiProductSnapshot, requestId: number) {
    if (!featureFlags.labEvidence) return;
    const previous = labEvidenceState;
    setLabEvidenceState((current) => ({ ...current, state: 'checking' }));
    const resolution = await lookupLabEvidenceState({
      enabled: true,
      client: canUseRemote ? supabase : null,
      product,
      lotNumber: scannerLotNumber.trim() || null,
      configured: canUseRemote,
      previous
    });
    if (lookupRequestId.current === requestId) setLabEvidenceState(resolution);
  }

  async function presentScannerProduct(
    product: HealthiProductSnapshot,
    requestId: number,
    message: string
  ) {
    const currentProduct = {
      ...product,
      lab_evidence: undefined,
      lab_evidence_resolution: undefined
    };
    setBarcodeInput(currentProduct.barcode);
    setScannerProduct(currentProduct);
    setScannerMealName(currentProduct.name);
    setScannerServingQuantity('1');
    setScannerLookupState('product_available');
    setScannerMessage(message);
    void resolveEvidenceForProduct(currentProduct, requestId);
  }

  function setIdentityUnresolved(message: string) {
    setScannerLookupState('product_not_found');
    setScannerMessage(message);
  }

  function setProviderUnavailable(message: string) {
    setScannerLookupState('provider_temporarily_unavailable');
    setScannerMessage(message);
  }

  async function handleProductLookup(value = barcodeInput) {
    if (lookupInFlight.current) return;
    Keyboard.dismiss();
    lookupInFlight.current = true;
    const requestId = lookupRequestId.current + 1;
    lookupRequestId.current = requestId;
    const existingProduct = scannerProduct;
    const candidates = barcodeLookupCandidates(value);
    const existingMatches = Boolean(existingProduct?.barcode && candidates.includes(existingProduct.barcode));
    setIsLookingUpProduct(true);
    setScannerLookupState('resolving_identity');
    setCameraOpen(false);
    if (!existingMatches) {
      setScannerProduct(null);
      setLabEvidenceState(initialLabEvidenceClientState(featureFlags.labEvidence));
    }
    setScannerMessage(existingMatches ? 'Refreshing available label data…' : 'Looking up available label data…');

    try {
      const cached = productLibrary.find((product) => product.barcode && candidates.includes(product.barcode));
      if (cached && !shouldRefreshCachedProduct(cached)) {
        const snapshot = userFoodProductRowToSnapshot(cached);
        await presentScannerProduct(snapshot, requestId, 'Saved product found. Review the label data before adding it.');
        return;
      }

      setScannerLookupState('resolving_product_data');
      const result = await lookupResolvedProduct({
        barcode: value,
        client: isSupabaseConfigured ? supabase : null,
        configured: isSupabaseConfigured
      });
      if (lookupRequestId.current !== requestId) return;
      if (result.status === 'found') {
        const refreshedProduct = cached
          ? mergeProductSnapshots(userFoodProductRowToSnapshot(cached), result.product).snapshot
          : result.product;
        await presentScannerProduct(refreshedProduct, requestId, 'Product found. Review the available label data before adding it.');
      } else {
        if (cached) {
          const snapshot = userFoodProductRowToSnapshot(cached);
          await presentScannerProduct(snapshot, requestId, 'Using saved label data because refreshed provider data is unavailable.');
        } else if (existingMatches && existingProduct) {
          setScannerLookupState('product_available');
          setScannerMessage('Keeping the current Product Quality result because refreshed provider data is unavailable.');
        } else if (result.status === 'provider_unavailable') setProviderUnavailable(result.message);
        else setIdentityUnresolved(result.message);
      }
    } catch {
      if (lookupRequestId.current === requestId) {
        if (existingMatches && existingProduct) {
          setScannerLookupState('product_available');
          setScannerMessage('Keeping the current Product Quality result because refresh could not finish.');
        } else {
          setScannerLookupState('fatal_configuration_error');
          setScannerMessage('Product lookup could not finish. Try again or enter the food manually.');
        }
      }
    } finally {
      if (lookupRequestId.current === requestId) {
        lookupInFlight.current = false;
        setIsLookingUpProduct(false);
      }
    }
  }

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (lookupInFlight.current) return;
    const scannedAt = Date.now();
    const barcode = normalizeBarcode(result.data);
    if (!shouldProcessBarcodeScan(lastBarcodeScan.current, barcode, scannedAt)) return;

    lastBarcodeScan.current = { barcode, scannedAt };
    setBarcodeInput(barcode);
    void handleProductLookup(barcode);
  }

  async function handleSaveScannedMeal() {
    if (!scannerProduct) return;

    const servingQuantity = normalizeServingQuantity(scannerServingQuantity);
    if (servingQuantity === null) {
      setScannerMessage('Enter a serving quantity greater than 0 and no more than 20.');
      return;
    }

    setIsSavingScannedMeal(true);
    const now = new Date().toISOString();
    const meal = scannedProductToMealLog({
      snapshot: scannerProduct,
      servingQuantity,
      loggedAt: now,
      mealType: scannerMealType,
      mealNameOverride: scannerMealName
    });

    try {
      await cacheProductSnapshot({
        ...scannerProduct,
        lab_evidence_reference: labEvidenceResolution
          ? toLabEvidenceReferenceSnapshot(labEvidenceResolution)
          : scannerProduct.lab_evidence_reference
      }, 'scanner');
      if (canUseRemote && userId) {
        const saved = await saveMealLog(supabase as unknown as NutritionSupabaseClient, userId, meal);
        const nextMeal = mealRowToMealLog(saved);
        setMeals((current) => [nextMeal, ...current.filter((item) => item.id !== nextMeal.id)]);
        setResponseForm((current) => ({ ...current, meal_log_id: saved.id }));
        setStatus('Product added. Today’s fueling signal has been updated.');
      } else {
        const localMeal = { ...meal, id: `local-scanned-meal-${Date.now()}` };
        await appendLocalDemoMealLog(localMeal);
        setMeals((current) => [localMeal, ...current.filter((item) => item.id !== localMeal.id)]);
        setResponseForm((current) => ({ ...current, meal_log_id: localMeal.id ?? null }));
        setStatus('Product added locally. Food response is still calibrating.');
      }

      setScannerProduct(null);
      setBarcodeInput('');
      setScannerMealName('');
      setScannerServingQuantity('1');
      setScannerMealType('unknown');
      closeScanner();
      setActiveSegment('Diary');
    } catch {
      setScannerMessage('This meal could not be saved. Your product snapshot is still here so you can try again.');
    } finally {
      setIsSavingScannedMeal(false);
    }
  }

  async function handleSaveMeal() {
    setIsSaving(true);
    const now = new Date().toISOString();
    const meal = manualMealFormToMealLog(mealForm, now);

    try {
      if (canUseRemote && userId) {
        const saved = await saveMealLog(supabase as unknown as NutritionSupabaseClient, userId, meal);
        const nextMeal = mealRowToMealLog(saved);
        setMeals((current) => [nextMeal, ...current.filter((item) => item.id !== nextMeal.id)]);
        setResponseForm((current) => ({ ...current, meal_log_id: nextMeal.id ?? null }));
        setStatus('Meal logged. Today’s fueling signal has been updated.');
      } else {
        const localMeal = { ...meal, id: `local-meal-${Date.now()}` };
        await appendLocalDemoMealLog(localMeal);
        setMeals((current) => [localMeal, ...current]);
        setResponseForm((current) => ({ ...current, meal_log_id: localMeal.id ?? null }));
        setStatus('Meal logged locally. Food response is still calibrating.');
      }

      setMealForm(createEmptyManualMealForm());
      setActiveSegment('Diary');
    } catch {
      setStatus('Meal not saved. Your draft is still here. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function startEditingMeal(meal: MealLog) {
    if (mealBuilder.items.length) { setMealDetailMessage('Save or cancel your current meal draft before editing another meal.'); return; }
    try {
      const items = canUseRemote && userId && meal.id
        ? await getMealLogItemsForMealLog(supabase as unknown as MealItemSupabaseClient, userId, meal.id)
        : mealLogItems.filter(item => item.meal_log_id === meal.id);
      setSelectedMeal(null); setMealDetailMessage('');
      if (!items.length) { setMealEditDraft(createMealEditDraft(meal)); setMealEditError(''); return; }
      setMealBuilder(mealEntryToBuilder(createMealCollectionEntry(meal, items)));
      setEditingMeal(meal); setServingDrafts({}); setRemovedItem(null);
      setBuilderMessage('Edit foods or portions below. Nothing changes in your diary until you save.');
      setActiveSegment('Build Meal');
    } catch { setMealDetailMessage('Food details could not load. Try again before editing this meal.'); }
  }

  function openMealLibrary(entry: MealCollectionEntry | null = null) {
    setLibraryInitialEntry(entry); setSelectedMeal(null); setMealChooserOpen(false); setFoodEntryOpen(false); setMealLibraryOpen(true);
  }
  function usePreviousMeal(entry: MealCollectionEntry) {
    if (mealBuilder.items.length) {
      setMealLibraryOpen(false); setActiveSegment('Build Meal');
      setBuilderMessage('Save or cancel this draft before reusing another meal. Your foods have been kept.'); return;
    }
    try {
      setMealBuilder(mealEntryToBuilder(entry)); setEditingMeal(null); setServingDrafts({}); setRemovedItem(null);
      setMealLibraryOpen(false); setActiveSegment('Build Meal');
      setBuilderMessage('Review these foods and portions, choose breakfast, lunch, dinner, or snack, then save a new entry.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'This meal could not be reused.'); }
  }

  async function handleSaveMealEdit() {
    if (!mealEditDraft || savingMealEdit) return;
    setSavingMealEdit(true);
    setMealEditError('');
    try {
      let updated = applyMealEdit(mealEditDraft);
      if (canUseRemote && userId) {
        updated = mealRowToMealLog(await persistMealEdit(supabase as unknown as MealEditClient, userId, updated));
      } else {
        const current = await getLocalDemoNutritionState();
        if (!current.mealLogs.some((meal) => meal.id === updated.id)) throw new Error('This meal is no longer available. Refresh the diary.');
        await saveLocalDemoMealLogs(current.mealLogs.map((meal) => meal.id === updated.id ? updated : meal));
      }
      setMeals((current) => current.map((meal) => meal.id === updated.id ? updated : meal));
      setMealEditDraft(null);
      setStatus('Meal changes saved. Diary totals have been updated.');
    } catch (error) {
      setMealEditError(error instanceof Error ? error.message : 'Changes could not be saved. Your draft is still here.');
    } finally { setSavingMealEdit(false); }
  }

  async function handleSaveResponse() {
    setIsSaving(true);
    const response = responseLogFormToInput(responseForm);
    const nextMeals = applyResponseToMealLogs(meals, response);

    try {
      if (canUseRemote && userId) {
        const saved = await savePostMealResponseLog(supabase as unknown as FoodPersonalizationSupabaseClient, userId, response);
        setResponses((current) => [saved, ...current]);
        setStatus('Response logged. Healthi has one more food response signal.');
      } else {
        const localResponse = createLocalDemoResponseRow(response);
        await Promise.all([
          saveLocalDemoMealLogs(nextMeals),
          appendLocalDemoPostMealResponse(localResponse)
        ]);
        setResponses((current) => [localResponse, ...current]);
        setStatus('Response logged locally. Insights will sharpen as you add more.');
      }

      setMeals(nextMeals);
      setResponseForm(createEmptyResponseLogForm());
      setActiveSegment('Diary');
    } catch {
      setStatus('Response could not finish saving. Your draft is still here; check history before retrying.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleAnswer(value: string | null) {
    setTestAnswers((current) => ({ ...current, [currentQuestion.id]: value }));
    setQuestionIndex((current) => Math.min(current + 1, foodPatternQuestions.length - 1));
  }

  async function handleRunPatternTest() {
    const profile = calculateFoodPatternProfile({
      answers: foodPatternDraftToAnswers(testAnswers),
      now: new Date().toISOString()
    });
    setTestResult(profile);
    setActiveProfile(profile);
    setStatus('Your Food Pattern Profile is ready.');

    if (!canUseRemote || !userId) {
      await saveLocalDemoFoodPatternProfile(profile);
      return;
    }

    try {
      const saved = await replaceActiveFoodPatternProfile(supabase as unknown as FoodPersonalizationSupabaseClient, userId, profile);
      setActiveProfile(profileRowToProfile(saved));
      setStatus('Your Food Pattern Profile was saved.');
    } catch {
      setStatus('Food Pattern Profile saved locally. Remote sync can retry later.');
    }
  }

  function openAdaptiveDestination(destination: AdaptiveDietDestination) {
    closeScanner();
    if (destination === 'Log Meal' || destination === 'Build Meal') setFoodEntryOpen(true);
    else setActiveSegment(destination);
  }

  function renderScanner() {
    const qualityPresentation = productQuality ? buildProductQualityScorePresentation(productQuality) : null;
    return (
      <View style={styles.stack}>
        {productQualityExperimentEnabled || compositionKernelEnabled ? (
          <View style={styles.scoringLabBanner}>
            <Ionicons color={colors.accent} name="flask-outline" size={18} />
            <View style={styles.scannerHeadingCopy}>
              <Text style={styles.scoringLabBannerTitle}>
                {compositionKernelEnabled ? 'Scoring lab · V6 composition' : 'Scoring lab · V5 two axis'}
              </Text>
              <Text style={styles.scoringLabBannerText}>
                {compositionKernelEnabled
                  ? 'Products are judged by what they are made of, and a fat by its source rather than its saturation.'
                  : 'The ZIP-based V5 model is active in this preview only.'}
              </Text>
            </View>
          </View>
        ) : null}
        <View style={styles.scannerHeading}>
          <View style={styles.scannerHeadingCopy}>
            <Text style={styles.eyebrow}>Packaged food</Text>
            <Text style={styles.title}>Scan Food</Text>
          </View>
          <Pressable
            accessibilityLabel="Close scanner"
            accessibilityRole="button"
            onPress={closeScanner}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.textMuted} name="close" size={22} />
          </Pressable>
        </View>

        <Card>
          <View style={styles.scannerIntroRow}>
            <View style={styles.scannerIcon}>
              <Ionicons color={colors.accent} name="barcode-outline" size={24} />
            </View>
            <View style={styles.scannerHeadingCopy}>
              <Text style={styles.cardTitle}>Barcode scanner</Text>
              <Text style={styles.body}>
                Healthi uses the camera to scan product barcodes. You can also enter a barcode manually.
              </Text>
            </View>
          </View>

          {cameraOpen && cameraPermission?.granted ? (
            <View style={styles.cameraShell}>
              <CameraView
                active={cameraOpen}
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'itf14'] }}
                facing="back"
                onBarcodeScanned={isLookingUpProduct ? undefined : handleBarcodeScanned}
                onCameraReady={() => setScannerMessage('Center the product barcode inside the frame.')}
                onMountError={() => {
                  setCameraOpen(false);
                  setScannerMessage('The camera could not start here. Enter the barcode manually below.');
                }}
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={styles.scanFrame} />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setCameraOpen(false);
                  setScannerMessage('Camera paused. Enter a barcode or start the camera again.');
                }}
                style={({ pressed }) => [styles.cameraCancel, pressed && styles.pressed]}
              >
                <Text style={styles.cameraCancelText}>Cancel camera</Text>
              </Pressable>
            </View>
          ) : (
            <PrimaryButton label="Use camera" onPress={() => void handleStartCamera()} />
          )}

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR ENTER MANUALLY</Text>
            <View style={styles.orLine} />
          </View>
          <Field
            keyboardType="numeric"
            label="Barcode number"
            onChangeText={(value) => setBarcodeInput(normalizeBarcode(value))}
            onSubmitEditing={() => void handleProductLookup()}
            placeholder="3017620422003"
            returnKeyType="search"
            value={barcodeInput}
          />
          <PrimaryButton
            disabled={!barcodeInput.trim()}
            label="Look up product"
            loading={isLookingUpProduct}
            onPress={() => void handleProductLookup()}
          />
          <Text
            accessibilityLabel={`Scanner status: ${displayLabel(primaryScannerState)}`}
            style={styles.scannerMessage}
          >
            {scannerMessage}
          </Text>
        </Card>

        {scannerProduct && productQuality && productExplanation ? (
          <ProductVerdict
            brand={scannerProduct.brand}
            certaintyNote={productQuality.grade_certainty?.state === 'stable'
              ? null
              : qualityPresentation?.gradeCertaintyLine ?? null}
            explanation={productExplanation}
            grade={productQuality.letter_grade ?? null}
            name={scannerProduct.name}
            score={productQuality.score ?? null}
            sourceNote={`Read from the label · ${displayLabel(scannerProduct.provider)}`}
          />
        ) : null}

        {scannerProduct && productQuality ? (
          <Card style={styles.productCard}>
            <Text style={styles.eyebrow}>ON THE LABEL</Text>
            <View style={styles.productMetrics}>
              <Metric label="Calories" value={formatProductAmount(scannerProduct.calories_per_serving)} tone={colors.accent} />
              <Metric label="Protein" value={formatProductAmount(scannerProduct.protein_g, 'g')} />
              <Metric label="Carbs" value={formatProductAmount(scannerProduct.carbs_g, 'g')} />
              <Metric label="Fat" value={formatProductAmount(scannerProduct.fat_g, 'g')} />
              <Metric label="Fiber" value={formatProductAmount(scannerProduct.fiber_g, 'g')} />
              <Metric label="Sugar" value={formatProductAmount(scannerProduct.sugar_g, 'g')} />
              <Metric label="Sodium" value={formatProductAmount(scannerProduct.sodium_mg, 'mg')} />
            </View>

            {(productQuality.better_options?.length ?? 0) > 0 ? (
              <View style={styles.disclosureBlock}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showBetterOptions }}
                  onPress={() => setShowBetterOptions((current) => !current)}
                  style={({ pressed }) => [styles.disclosureHeader, pressed && styles.pressed]}
                >
                  <View style={styles.disclosureTitleRow}>
                    <Ionicons color={colors.accent} name="swap-horizontal-outline" size={18} />
                    <Text style={styles.disclosureTitle}>{productQuality.better_options?.[0]?.title ?? 'What to Compare'}</Text>
                  </View>
                  <Ionicons
                    color={C.muted}
                    name={showBetterOptions ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={18}
                  />
                </Pressable>
                {showBetterOptions ? productQuality.better_options?.map((option) => (
                  <View key={option.title} style={styles.disclosureContent}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    <Text style={styles.signalReasonText}>{option.summary}</Text>
                    {option.criteria.map((criterion) => (
                      <View key={criterion} style={styles.signalReasonRow}>
                        <Ionicons color={colors.accentMid} name="checkmark-circle-outline" size={16} />
                        <Text style={styles.signalReasonText}>{criterion}</Text>
                      </View>
                    ))}
                  </View>
                )) : null}
              </View>
            ) : null}

            {(productQuality.evidence_refs?.length ?? 0) > 0 ? (
              <View style={styles.disclosureBlock}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showProductEvidence }}
                  onPress={() => setShowProductEvidence((current) => !current)}
                  style={({ pressed }) => [styles.disclosureHeader, pressed && styles.pressed]}
                >
                  <View style={styles.disclosureTitleRow}>
                    <Ionicons color={colors.accent} name="information-circle-outline" size={19} />
                    <Text style={styles.disclosureTitle}>How this is grounded</Text>
                  </View>
                  <Ionicons
                    color={C.muted}
                    name={showProductEvidence ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={18}
                  />
                </Pressable>
                {showProductEvidence ? productQuality.evidence_refs?.map((reference) => (
                  <View key={reference.id} style={styles.evidenceItem}>
                    <Text style={styles.optionTitle}>{reference.title}</Text>
                    <Text style={styles.evidenceSource}>{reference.source}{reference.year ? ` · ${reference.year}` : ''}</Text>
                    <Text style={styles.signalReasonText}>{reference.summary}</Text>
                  </View>
                )) : null}
              </View>
            ) : null}

            {featureFlags.labEvidence ? <>
              <View style={styles.productFormDivider} />
              <Field
                label="Lot number (optional)"
                onChangeText={setScannerLotNumber}
                placeholder="Use the package lot code"
                value={scannerLotNumber}
              />
              <PrimaryButton
                disabled={isLookingUpLabEvidence}
                label={scannerLotNumber.trim() ? 'Refresh evidence for this lot' : 'Continue without lot number'}
                loading={isLookingUpLabEvidence}
                onPress={() => void resolveEvidenceForProduct(scannerProduct, lookupRequestId.current)}
              />

              <View style={styles.disclosureBlock}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showLabEvidence }}
                onPress={() => setShowLabEvidence((current) => !current)}
                style={({ pressed }) => [styles.disclosureHeader, pressed && styles.pressed]}
              >
                <View style={styles.disclosureTitleRow}>
                  <Ionicons color={colors.accent} name="flask-outline" size={19} />
                  <View style={styles.productHeaderCopy}>
                    <Text style={styles.disclosureTitle}>Lab Evidence</Text>
                    <Text style={styles.evidenceSource}>
                      {isLookingUpLabEvidence
                        ? 'Checking current evidence...'
                        : labEvidenceResolution
                          ? labEvidenceStatusCopy(labEvidenceResolution).title
                          : labEvidenceClientStateCopy(labEvidenceState).title}
                    </Text>
                  </View>
                </View>
                <Ionicons color={C.muted} name={showLabEvidence ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} />
              </Pressable>
              {showLabEvidence ? (
                <View style={styles.disclosureContent}>
                  <Text style={styles.signalReasonText}>
                    {labEvidenceResolution
                      ? labEvidenceStatusCopy(labEvidenceResolution).detail
                      : labEvidenceClientStateCopy(labEvidenceState).detail}
                  </Text>
                  {labEvidenceState.state === 'unavailable' ? (
                    <PrimaryButton
                      label="Try again"
                      loading={isLookingUpLabEvidence}
                      onPress={() => void resolveEvidenceForProduct(scannerProduct, lookupRequestId.current)}
                    />
                  ) : null}
                  {labEvidenceResolution?.labEvidence.map((record) => (
                    <View key={record.evidenceId} style={styles.evidenceItem}>
                      <Text style={styles.optionTitle}>{record.sourceName}</Text>
                      <Text style={styles.evidenceSource}>
                        {[displayLabel(record.matchLevel), displayLabel(record.provenance), record.sampleDate ? `Sampled ${record.sampleDate}` : null, record.publicationDate ? `Published ${record.publicationDate}` : null].filter(Boolean).join(' · ')}
                      </Text>
                      <Text style={styles.signalReasonText}>{record.matchReason}</Text>
                      {record.laboratory ? <Text style={styles.signalReasonText}>Laboratory: {record.laboratory}</Text> : null}
                      {record.testingMethod ? <Text style={styles.signalReasonText}>Method: {record.testingMethod}</Text> : null}
                      {record.analytes.map((analyte) => (
                        <View key={`${record.evidenceId}-${analyte.canonicalAnalyteId ?? analyte.analyte}`} style={styles.evidenceItem}>
                          <Text style={styles.optionTitle}>{analyte.analyte}</Text>
                          <Text style={styles.signalReasonText}>{formatLabAnalyte(analyte)}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                  {labEvidenceLookupCompleted && labEvidenceResolution?.labEvidence.length === 0 ? (
                    <Text style={styles.evidenceSource}>No product-specific numeric lab record is available in the current response.</Text>
                  ) : null}
                </View>
              ) : null}
              </View>

              {labEvidenceLookupCompleted ? <View style={styles.disclosureBlock}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showCertifications }}
                onPress={() => setShowCertifications((current) => !current)}
                style={({ pressed }) => [styles.disclosureHeader, pressed && styles.pressed]}
              >
                <View style={styles.disclosureTitleRow}>
                  <Ionicons color={colors.accent} name="ribbon-outline" size={19} />
                  <Text style={styles.disclosureTitle}>Certifications</Text>
                </View>
                <Ionicons color={C.muted} name={showCertifications ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} />
              </Pressable>
              {showCertifications ? (
                <View style={styles.disclosureContent}>
                  {labEvidenceResolution?.certifications.length ? labEvidenceResolution.certifications.map((certification) => (
                    <View key={certification.certificationId} style={styles.evidenceItem}>
                      <Text style={styles.optionTitle}>{certification.certificationName}</Text>
                      <Text style={styles.evidenceSource}>{certification.certifyingBody} · {displayLabel(certification.scope)}</Text>
                      <Text style={styles.signalReasonText}>{certification.matchReason}</Text>
                    </View>
                  )) : <Text style={styles.signalReasonText}>No current certification was found in the sources checked. Certification is separate from numeric lab testing.</Text>}
                </View>
              ) : null}
              </View> : null}

              {labEvidenceLookupCompleted ? <View style={styles.disclosureBlock}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showRegulatoryStatus }}
                onPress={() => setShowRegulatoryStatus((current) => !current)}
                style={({ pressed }) => [styles.disclosureHeader, pressed && styles.pressed]}
              >
                <View style={styles.disclosureTitleRow}>
                  <Ionicons color={colors.accent} name="document-text-outline" size={19} />
                  <Text style={styles.disclosureTitle}>Regulatory Status</Text>
                </View>
                <Ionicons color={C.muted} name={showRegulatoryStatus ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} />
              </Pressable>
              {showRegulatoryStatus ? (
                <View style={styles.disclosureContent}>
                  {labEvidenceResolution?.regulatoryAlerts.length ? labEvidenceResolution.regulatoryAlerts.map((alert) => (
                    <View key={alert.alertId} style={styles.evidenceItem}>
                      <Text style={styles.optionTitle}>{alert.title}</Text>
                      <Text style={styles.evidenceSource}>{alert.authority} · {displayLabel(alert.status)} · {displayLabel(alert.matchLevel)}</Text>
                      <Text style={styles.signalReasonText}>{alert.matchReason}</Text>
                    </View>
                  )) : <Text style={styles.signalReasonText}>No matching official alert was found in the sources checked. Source coverage may be incomplete.</Text>}
                </View>
              ) : null}
              </View> : null}

              {labEvidenceLookupCompleted ? <View style={styles.disclosureBlock}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showEvidenceContext }}
                onPress={() => setShowEvidenceContext((current) => !current)}
                style={({ pressed }) => [styles.disclosureHeader, pressed && styles.pressed]}
              >
                <View style={styles.disclosureTitleRow}>
                  <Ionicons color={colors.accent} name="layers-outline" size={19} />
                  <Text style={styles.disclosureTitle}>Evidence Context</Text>
                </View>
                <Ionicons color={C.muted} name={showEvidenceContext ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} />
              </Pressable>
              {showEvidenceContext ? (
                <View style={styles.disclosureContent}>
                  {[...(labEvidenceResolution?.relatedEvidence ?? []), ...(labEvidenceResolution?.categoryContext ?? [])].length
                    ? [...(labEvidenceResolution?.relatedEvidence ?? []), ...(labEvidenceResolution?.categoryContext ?? [])].map((context) => (
                      <View key={context.contextId} style={styles.evidenceItem}>
                        <Text style={styles.optionTitle}>{context.title}</Text>
                        <Text style={styles.evidenceSource}>{context.sourceName} · {displayLabel(context.scope)}</Text>
                        <Text style={styles.signalReasonText}>{context.summary}</Text>
                        <Text style={styles.evidenceSource}>{context.matchReason}</Text>
                      </View>
                    ))
                    : <Text style={styles.signalReasonText}>No related or category context was found. Category context, when available, is not testing of the scanned product.</Text>}
                </View>
              ) : null}
              </View> : null}
            </> : null}

            <View style={styles.personalResponseNote}>
              <Ionicons color={colors.accentMid} name="pulse-outline" size={18} />
              <Text style={styles.personalResponseText}>
                Food quality is only one signal. Your personal food response can change how Healthi recommends this product for you.
              </Text>
            </View>

            <View style={styles.productFormDivider} />
            <Text style={styles.cardTitle}>Add to Meal</Text>
            <View style={styles.twoCol}>
              <Field
                keyboardType="numeric"
                label="Servings"
                onChangeText={setScannerServingQuantity}
                style={styles.fieldHalf}
                value={scannerServingQuantity}
              />
              <Field
                label="Meal name"
                onChangeText={setScannerMealName}
                style={styles.fieldHalf}
                value={scannerMealName}
              />
            </View>
            <Text style={styles.fieldLabel}>Meal type</Text>
            <View style={styles.chipWrap}>
              {mealTypes.map((type) => (
                <Chip
                  key={type}
                  label={displayLabel(type)}
                  onPress={() => setScannerMealType(type)}
                  selected={scannerMealType === type}
                />
              ))}
            </View>
            <PrimaryButton
              label={scannerDestination === 'builder' ? 'Add to Meal Builder' : 'Log this food now'}
              loading={isSavingScannedMeal}
              onPress={() => void (scannerDestination === 'builder' ? handleAddScannerProductToBuilder() : handleSaveScannedMeal())}
            />
            {scannerDestination !== 'builder' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleAddScannerProductToBuilder()}
                style={({ pressed }) => [styles.inlineTextButton, pressed && styles.pressed]}
              >
                <Text style={styles.inlineTextButtonText}>Add to Meal Builder instead</Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}
      </View>
    );
  }

  function renderDiary() {
    return (
      <View style={styles.stack}>
        <DietWeekSelector date={today} today={actualToday} onChange={setSelectedDay} />
        <View style={styles.diarySection}><ActionRow title="Photo meal" detail={canUseRemote ? 'Take or choose a photo · review before saving' : 'Photo estimates · not enabled in this demo'} icon="camera-outline" onPress={openPhotoEntry} last /></View>
        <NutritionGoalSetup key={`${userId}:${mode}`} userId={userId} demo={mode === 'demo'} client={canUseRemote ? supabase as unknown as GoalClient : null} onTargets={setTargets} />
        <DietIntakeSummary summary={nutrientSummary} targets={targets} onNutrients={() => setActiveSegment('Nutrients')} />
        <HydrationCard key={`${userId}:${today}:${mode}`} userId={userId} demo={mode === 'demo'} client={canUseRemote ? supabase as unknown as HydrationClient : null} date={today} />
        {mealBuilder.items.length > 0 ? <View style={styles.diarySection}><ActionRow title="Continue your meal" detail={`${mealBuilder.items.length} foods in your unsaved draft`} icon="create-outline" onPress={() => setActiveSegment('Build Meal')} last /></View> : null}
        <View style={styles.diarySection}><ActionRow title="Your foods & meals" detail="Search history, starred meals, and saved favorites" icon="bookmark-outline" onPress={() => openMealLibrary()} last /></View>
        <MealDiarySections meals={todayMeals} date={today} loading={isLoadingRemote} onAdd={beginDiaryMeal} onSelect={meal => { setMealDetailMessage(''); setSelectedMeal(meal); }} />
        <ActionRow title="How good was what you ate" detail="Grades for everything you logged, and what earned them" icon="ribbon-outline" onPress={() => setActiveSegment('Quality')} last />
      </View>
    );
  }


  function renderTimeline() {
    const timelineMeals = todayMeals
      .slice()
      .sort((left, right) => left.logged_at.localeCompare(right.logged_at));
    const todayLabel = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    return (
      <View style={styles.adaptivePage}>
        <View style={styles.adaptiveHero}>
          <View style={styles.adaptiveSectionHeading}>
            <View>
              <Text style={styles.adaptiveSectionLabel}>Timeline</Text>
              <Text style={styles.adaptiveViewTitle}>Meals + responses</Text>
            </View>
            <Text style={styles.adaptiveMono}>{todayLabel}</Text>
          </View>
          <View style={styles.adaptiveTimeline}>
            {timelineMeals.length > 0 ? timelineMeals.map((meal) => {
              const linkedResponse = responses.find((response) => response.meal_log_id === meal.id);
              return (
                <View key={meal.id ?? `${meal.name}-${meal.logged_at}`} style={styles.adaptiveTimelineEvent}>
                  <Text style={styles.adaptiveTimelineTime}>{formatClock(meal.logged_at)}</Text>
                  <View style={styles.adaptiveTimelineMarker} />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      updateResponseForm('meal_log_id', meal.id ?? null);
                      setActiveSegment('Response Log');
                    }}
                    style={({ pressed }) => [styles.adaptiveTimelineCopy, pressed && styles.pressed]}
                  >
                    <Text style={styles.adaptiveTimelineTitle}>{meal.name}</Text>
                    <Text style={styles.adaptivePriorityReason}>
                      {displayLabel(meal.meal_type)} · {linkedResponse ? 'Response logged' : 'Add personal response'}
                    </Text>
                  </Pressable>
                </View>
              );
            }) : (
              <View style={styles.adaptiveEmpty}>
                <Text style={styles.adaptiveCoverageSuggestion}>Nothing logged yet</Text>
                <Text style={styles.adaptivePriorityReason}>Meals will appear here in time order without turning the day into a scorecard.</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setActiveSegment('Log Meal')}
                  style={({ pressed }) => [styles.adaptivePrimaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.adaptivePrimaryButtonText}>Log a meal</Text>
                </Pressable>
              </View>
            )}
          </View>
          {timelineMeals.length > 0 ? (
            <View style={styles.adaptiveTimelineNote}>
              <Text style={styles.adaptiveSectionVoice}>
                {responses.length > 0
                  ? `${responses.length} recent response${responses.length === 1 ? '' : 's'} add personal context to your meal history.`
                  : 'Add an optional response after a meal to connect food with how you felt.'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  function renderNutrients() {
    return (
      <View style={styles.adaptivePage}>
        <View style={styles.adaptiveHero}>
          <Text style={styles.adaptiveSectionLabel}>Nutrients</Text>
          <Text style={styles.adaptiveViewTitle}>Full spectrum, honestly reported</Text>
          <TextInput
            accessibilityLabel="Search nutrients"
            onChangeText={setNutrientQuery}
            placeholder="Search nutrients"
            placeholderTextColor="#8E8E93"
            style={styles.adaptiveSearch}
            value={nutrientQuery}
          />
        </View>

        <View style={styles.adaptiveSection}>
          <Text style={styles.adaptiveSectionLabel}>Nutrient data confidence</Text>
          <Text style={styles.adaptivePriorityReason}>How well today’s meal records report each available nutrient.</Text>
          <View style={styles.adaptiveConfidenceSummary}>
            <Text style={styles.adaptiveConfidenceValue}>{confidenceLabel(nutrientSummary.confidence)} confidence</Text>
            <Text style={styles.adaptivePriorityReason}>
              Missing nutrient fields lower confidence; they do not automatically lower your result.
            </Text>
          </View>
        </View>

        <View style={styles.adaptiveSection}>
          <Text style={styles.adaptiveSectionLabel}>Reported today</Text>
          {filteredAdaptiveNutrients.length > 0 ? filteredAdaptiveNutrients.map((nutrient) => (
            <View key={nutrient.id} style={styles.adaptiveNutrientRow}>
              <View style={styles.adaptiveNutrientCopy}>
                <Text style={styles.adaptiveLaneName}>{nutrient.name}</Text>
                <Text style={styles.adaptiveNutrientContext}>{nutrient.context}</Text>
              </View>
              <View style={styles.adaptiveNutrientValue}>
                <Text style={styles.adaptiveMonoStrong}>{nutrient.amount}</Text>
                <Text style={styles.adaptivePriorityConfidence}>{confidenceLabel(nutrient.confidence)}</Text>
              </View>
            </View>
          )) : <Text style={styles.adaptivePriorityReason}>No matching nutrient is available in today’s record.</Text>}
        </View>
      </View>
    );
  }

  function renderProfile() {
    const foundationState = activeProfile ? confidenceLabel(activeProfile.confidence) : 'Calibrating';
    return (
      <View style={styles.adaptivePage}>
        <View style={styles.adaptiveHero}>
          <Text style={styles.adaptiveSectionLabel}>Nutrition foundation</Text>
          <View style={styles.adaptiveFoundationMeta}>
            <View style={styles.adaptiveFoundationBadge}>
              <Text style={styles.adaptiveFoundationBadgeText}>{foundationState}</Text>
            </View>
            <Text style={styles.adaptiveSectionAside}>Long-term view</Text>
          </View>
          <Text style={styles.adaptiveProfileLead}>
            {profileCopy?.summary ?? 'Your nutrition foundation will take shape from the Food Pattern Test, meal logs, and optional responses.'}
          </Text>
          <View style={styles.adaptiveInsetCard}>
            <Text style={styles.adaptiveCoverageLabel}>Most useful adjustment</Text>
            <Text style={styles.adaptiveCoverageSuggestion}>
              {adaptiveDiet.priorities[0]?.title ?? 'Keep building consistent meal context'}
            </Text>
          </View>
          <View style={styles.adaptiveContributorList}>
            {[
              ['Meal coverage', `${nutrientSummary.meal_count} today`],
              ['Food quality', displayLabel(foodQuality.label)],
              ['Personal response', displayLabel(foodResponse.label)],
              ['Pattern profile', activeProfile ? displayLabel(activeProfile.pattern_label) : 'Not available'],
              ['Data confidence', confidenceLabel(readinessSignal.confidence)]
            ].map(([label, value]) => (
              <View key={label} style={styles.adaptiveContributorRow}>
                <Text style={styles.adaptiveContributorLabel}>{label}</Text>
                <Text style={styles.adaptiveContributorValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.adaptiveSection}>
          <Text style={styles.adaptiveSectionLabel}>Personalization</Text>
          <View style={styles.adaptiveInsetCard}>
            <Text style={styles.adaptiveCoverageLabel}>{activeProfile ? 'Refresh your context' : 'Build your starting profile'}</Text>
            <Text style={styles.adaptiveCoverageSuggestion}>
              {activeProfile ? 'Update your Food Pattern Profile when your routine changes.' : 'Answer a short set of questions to establish a conservative starting pattern.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setActiveSegment('Food Pattern Test')}
              style={({ pressed }) => [styles.adaptivePrimaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.adaptivePrimaryButtonText}>{activeProfile ? 'Review Food Pattern Test' : 'Start Food Pattern Test'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.adaptiveSection}>
          <Text style={styles.adaptiveSectionLabel}>Personal response</Text>
          <Text style={styles.adaptivePriorityReason}>Optional check-ins stay separate from Product Quality and help describe personal fit over time.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveSegment('Response Log')}
            style={({ pressed }) => [styles.adaptiveSecondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.adaptiveSecondaryButtonText}>Add a post-meal response</Text>
          </Pressable>
          <Text style={styles.adaptiveSafetyNote}>Observed patterns are general wellness context, not diagnoses.</Text>
        </View>
      </View>
    );
  }

  function renderManualFood() {
    return <EntrySheet title="Enter food" busy={isAddingManualFood} onClose={() => setManualFoodOpen(false)}><Card>
          <Text style={styles.cardTitle}>Add Manual Food</Text>
          <Text style={styles.body}>Useful when label data is missing or you are logging a simple food.</Text>
          <Field
            label="Food name"
            onChangeText={(value) => setManualProductForm((current) => ({ ...current, name: value }))}
            placeholder="Greek yogurt"
            value={manualProductForm.name}
          />
          <View style={styles.twoCol}>
            <Field label="Brand" onChangeText={(value) => setManualProductForm((current) => ({ ...current, brand: value }))} style={styles.fieldHalf} value={manualProductForm.brand} />
            <Field label="Serving size" onChangeText={(value) => setManualProductForm((current) => ({ ...current, serving_size: value }))} placeholder="170 g" style={styles.fieldHalf} value={manualProductForm.serving_size} />
            <Field keyboardType="numeric" label="Calories" onChangeText={(value) => setManualProductForm((current) => ({ ...current, calories: value }))} style={styles.fieldHalf} value={manualProductForm.calories} />
            <Field keyboardType="numeric" label="Protein g" onChangeText={(value) => setManualProductForm((current) => ({ ...current, protein_g: value }))} style={styles.fieldHalf} value={manualProductForm.protein_g} />
            <Field keyboardType="numeric" label="Carbs g" onChangeText={(value) => setManualProductForm((current) => ({ ...current, carbs_g: value }))} style={styles.fieldHalf} value={manualProductForm.carbs_g} />
            <Field keyboardType="numeric" label="Fat g" onChangeText={(value) => setManualProductForm((current) => ({ ...current, fat_g: value }))} style={styles.fieldHalf} value={manualProductForm.fat_g} />
            <Field keyboardType="numeric" label="Fiber g" onChangeText={(value) => setManualProductForm((current) => ({ ...current, fiber_g: value }))} style={styles.fieldHalf} value={manualProductForm.fiber_g} />
            <Field keyboardType="numeric" label="Sugar g" onChangeText={(value) => setManualProductForm((current) => ({ ...current, sugar_g: value }))} style={styles.fieldHalf} value={manualProductForm.sugar_g} />
            <Field keyboardType="numeric" label="Sodium mg" onChangeText={(value) => setManualProductForm((current) => ({ ...current, sodium_mg: value }))} style={styles.fieldHalf} value={manualProductForm.sodium_mg} />
          </View>
          {manualFoodError ? <Text accessibilityRole="alert" style={styles.diaryDetail}>{manualFoodError}</Text> : null}
          <PrimaryButton label="Add to Meal" loading={isAddingManualFood} onPress={() => void handleAddManualProduct()} />
        </Card></EntrySheet>;
  }

  function renderMealBuilder() {
    return (
      <View style={styles.stack}>
        <View style={styles.diarySection}>
          <Text style={styles.diaryHeading}>{editingMeal ? 'Edit meal' : 'Your meal'}</Text>
          <Text style={styles.diaryDetail}>{editingMeal ? `Updating ${new Date(editingMeal.logged_at).toLocaleDateString()} · ${formatClock(editingMeal.logged_at)}. Original date and time are kept.` : `Review portions, then save to ${dayTitle(today, actualToday).toLowerCase()}.`}</Text>
          <Field label="Meal name" onChangeText={(name) => setMealBuilder((current) => ({ ...current, name }))} placeholder="e.g. Lunch" value={mealBuilder.name} />
          <Text style={styles.fieldLabel}>Log this meal as</Text>
          <View style={styles.chipWrap}>{mealTypes.map((type) => <Chip key={type} label={displayLabel(type)} selected={mealBuilder.meal_type === type} onPress={() => setMealBuilder((current) => ({ ...current, meal_type: type }))} />)}</View>
          <ActionRow title="Add another food" detail="Search, scan, or use a saved food" icon="add-circle-outline" onPress={() => setFoodEntryOpen(true)} last />
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.diaryDetail}>{builderMessage}</Text>
        {removedItem ? <View style={styles.diaryNotice}><Text style={styles.diaryDetail}>Food removed from this draft.</Text><Pressable accessibilityRole="button" onPress={() => { setMealBuilder((current) => ({ ...current, items: [...current.items, removedItem] })); setRemovedItem(null); }} style={styles.diaryTextButton}><Text style={styles.diaryLink}>Undo</Text></Pressable></View> : null}
        <Card style={styles.mealContentsCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>This Meal</Text>
              <Text style={styles.body}>{mealBuilder.items.length === 0 ? 'No foods added yet.' : `${mealBuilder.items.length} food${mealBuilder.items.length === 1 ? '' : 's'} ready to save.`}</Text>
            </View>
            <Text style={styles.qualityLabel}>{mealBuilder.items.length} item{mealBuilder.items.length === 1 ? '' : 's'}</Text>
          </View>
          {mealBuilder.items.map((item) => (
            <View key={item.id} style={styles.builderItemRow}>
              <ScoreRing
                label={`${item.snapshot.name}: quality ${item.quality.score ?? 'not scored'}`}
                score={item.quality.score}
                size={34}
              />
              <View style={styles.builderItemCopy}>
                <Text numberOfLines={1} style={styles.libraryName}>{item.snapshot.name}</Text>
                <Text style={styles.libraryMeta}>{[item.snapshot.brand, foodLoggingNutrition(item.snapshot).label].filter(Boolean).join(' · ')}</Text>
                <Text style={styles.librarySignal}>{formatProductAmount(foodLoggingNutrition(item.snapshot).nutrients.calories, ' kcal')} {foodLoggingNutrition(item.snapshot).portionLabel}</Text>
              </View>
              <TextInput
                accessibilityLabel={`${foodLoggingNutrition(item.snapshot).label} portions of ${item.snapshot.name}`}
                keyboardType="decimal-pad"
                onChangeText={(value) => { setServingDrafts((current) => ({ ...current, [item.id]: value })); if (portionValue(value) !== null) setMealBuilder((current) => updateMealBuilderItemServings(current, item.id, value)); }}
                style={styles.servingsInput}
                value={servingDrafts[item.id] ?? String(item.servings)}
              />
              <Pressable
                accessibilityLabel={`Remove ${item.snapshot.name} from meal`}
                accessibilityRole="button"
                onPress={() => { setRemovedItem(item); setMealBuilder((current) => removeMealBuilderItem(current, item.id)); }}
                style={({ pressed }) => [styles.smallIconButton, pressed && styles.pressed]}
              >
                <Ionicons color={colors.textMuted} name="close" size={18} />
              </Pressable>
            </View>
          ))}
          <View style={styles.productFormDivider} />
          <View style={styles.metricGrid}>
            <Metric label="Calories" value={formatProductAmount(mealBuilderTotals.calories)} tone={colors.accent} />
            <Metric label="Protein" value={formatProductAmount(mealBuilderTotals.protein_g, 'g')} />
            <Metric label="Carbs" value={formatProductAmount(mealBuilderTotals.carbs_g, 'g')} />
            <Metric label="Fat" value={formatProductAmount(mealBuilderTotals.fat_g, 'g')} />
            <Metric label="Fiber" value={formatProductAmount(mealBuilderTotals.fiber_g, 'g')} />
            <Metric label="Sodium" value={formatProductAmount(mealBuilderTotals.sodium_mg, 'mg')} />
          </View>
          <Text style={styles.confidenceLine}>Totals include reported nutrients only. Missing values aren’t treated as zero. Portions are multiples of the label amount shown above.</Text>
          {mealBuilder.items.some((item) => portionValue(servingDrafts[item.id] ?? String(item.servings)) === null) ? <Text accessibilityRole="alert" style={styles.diaryDetail}>Servings must be greater than 0 and no more than 20.</Text> : null}
          <PrimaryButton label={editingMeal ? 'Save changes' : 'Log meal'} disabled={mealBuilder.items.length === 0 || mealBuilder.items.some((item) => portionValue(servingDrafts[item.id] ?? String(item.servings)) === null)} loading={isSavingBuilder} onPress={() => void handleSaveBuiltMeal()} />
          {!isSavingBuilder ? <ActionRow title={editingMeal ? 'Cancel changes' : 'Discard draft'} onPress={() => { setEditingMeal(null); setMealBuilder(createEmptyMealBuilder()); setServingDrafts({}); setRemovedItem(null); setActiveSegment('Diary'); }} last /> : null}
        </Card>

      </View>
    );
  }

  function renderLogMeal() {
    return (
      <View style={styles.stack}>
        <SectionTitle
          body="Add nutrition facts manually, or scan a packaged food."
          eyebrow="Manual"
          title="Log a meal"
        />
        <Card>
          <Pressable
            accessibilityRole="button"
            onPress={() => openScanner()}
            style={({ pressed }) => [styles.scannerShortcut, pressed && styles.pressed]}
          >
            <Ionicons color={colors.accent} name="barcode-outline" size={20} />
            <Text style={styles.scannerShortcutText}>Scan Food</Text>
            <Ionicons color={colors.textFaint} name="chevron-forward" size={18} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={photoBusy}
            onPress={openPhotoEntry}
            style={({ pressed }) => [styles.scannerShortcut, (pressed || photoBusy) && styles.pressed]}
          >
            <Ionicons color={colors.accent} name="camera-outline" size={20} />
            <Text style={styles.scannerShortcutText}>
              {photoBusy ? 'Estimating from your photo…' : 'Estimate from a photo'}
            </Text>
            {photoBusy
              ? <ActivityIndicator color={colors.accent} />
              : <Ionicons color={colors.textFaint} name="chevron-forward" size={18} />}
          </Pressable>
          {photoNotice ? <Text accessibilityRole="alert" style={styles.fieldLabel}>{photoNotice}</Text> : null}
          <Field label="Meal name" onChangeText={(value) => updateMealForm('name', value)} placeholder="Lunch bowl" value={mealForm.name} />
          <Text style={styles.fieldLabel}>Meal type</Text>
          <View style={styles.chipWrap}>
            {mealTypes.map((type) => (
              <Chip
                key={type}
                label={displayLabel(type)}
                onPress={() => updateMealForm('meal_type', type)}
                selected={mealForm.meal_type === type}
              />
            ))}
          </View>
          <View style={styles.twoCol}>
            <Field keyboardType="numeric" label="Calories" onChangeText={(value) => updateMealForm('calories', value)} style={styles.fieldHalf} value={mealForm.calories} />
            <Field keyboardType="numeric" label="Protein g" onChangeText={(value) => updateMealForm('protein_g', value)} style={styles.fieldHalf} value={mealForm.protein_g} />
            <Field keyboardType="numeric" label="Carbs g" onChangeText={(value) => updateMealForm('carbs_g', value)} style={styles.fieldHalf} value={mealForm.carbs_g} />
            <Field keyboardType="numeric" label="Fat g" onChangeText={(value) => updateMealForm('fat_g', value)} style={styles.fieldHalf} value={mealForm.fat_g} />
            <Field keyboardType="numeric" label="Fiber g" onChangeText={(value) => updateMealForm('fiber_g', value)} style={styles.fieldHalf} value={mealForm.fiber_g} />
            <Field keyboardType="numeric" label="Sugar g" onChangeText={(value) => updateMealForm('sugar_g', value)} style={styles.fieldHalf} value={mealForm.sugar_g} />
            <Field keyboardType="numeric" label="Sodium mg" onChangeText={(value) => updateMealForm('sodium_mg', value)} style={styles.fieldHalf} value={mealForm.sodium_mg} />
          </View>
          <Text style={styles.fieldLabel}>Quality flags</Text>
          <View style={styles.chipWrap}>
            {qualityFlagOptions.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                onPress={() => toggleQualityFlag(option.value)}
                selected={mealForm.quality_flags.includes(option.value)}
                tone="lavender"
              />
            ))}
          </View>
          <PrimaryButton label="Save meal" loading={isSaving} onPress={handleSaveMeal} />
        </Card>
      </View>
    );
  }

  function renderResponseLog() {
    return (
      <View style={styles.stack}>
        <SectionTitle
          body="Rate how you felt after eating. These signals stay general and improve with repetition."
          eyebrow="Post-meal"
          title="Response Log"
        />
        <Card>
          <Text style={styles.fieldLabel}>Link to meal</Text>
          <View style={styles.chipWrap}>
            {todayMeals.length > 0 ? (
              todayMeals.map((meal) => (
                <Chip
                  key={meal.id ?? meal.name}
                  label={meal.name}
                  onPress={() => updateResponseForm('meal_log_id', meal.id ?? null)}
                  selected={responseForm.meal_log_id === meal.id}
                  tone="teal"
                />
              ))
            ) : (
              <Text style={styles.body}>No meal logged yet. You can still save a response as local context.</Text>
            )}
          </View>
          <View style={styles.twoCol}>
            <Field
              keyboardType="numeric"
              label="Overall 1-10"
              onChangeText={(value) => updateResponseForm('overall_score', value)}
              style={styles.fieldHalf}
              value={responseForm.overall_score}
            />
            <Field
              keyboardType="numeric"
              label="Minutes after meal"
              onChangeText={(value) => updateResponseForm('minutes_after_meal', value)}
              style={styles.fieldHalf}
              value={responseForm.minutes_after_meal}
            />
          </View>
          <ChoiceRow
            label="Digestion"
            options={['good', 'neutral', 'heavy', 'uncomfortable']}
            selected={responseForm.digestion ?? 'neutral'}
            onSelect={(value) => updateResponseForm('digestion', value as ResponseLogFormState['digestion'])}
          />
          <ChoiceRow
            label="Energy"
            options={['better', 'steady', 'dip']}
            selected={responseForm.energy ?? 'steady'}
            onSelect={(value) => updateResponseForm('energy', value as ResponseLogFormState['energy'])}
          />
          <ChoiceRow
            label="Appetite"
            options={['stable', 'hungry_soon', 'overfull']}
            selected={responseForm.appetite ?? 'stable'}
            onSelect={(value) => updateResponseForm('appetite', value as ResponseLogFormState['appetite'])}
          />
          <ChoiceRow
            label="Focus"
            options={['clear', 'neutral', 'foggy']}
            selected={responseForm.focus ?? 'neutral'}
            onSelect={(value) => updateResponseForm('focus', value as ResponseLogFormState['focus'])}
          />
          <ChoiceRow
            label="Cravings"
            options={['none', 'mild', 'strong']}
            selected={responseForm.cravings ?? 'none'}
            onSelect={(value) => updateResponseForm('cravings', value as ResponseLogFormState['cravings'])}
          />
          <Field label="Notes" multiline onChangeText={(value) => updateResponseForm('notes', value)} value={responseForm.notes} />
          <PrimaryButton label="Save response" loading={isSaving} onPress={handleSaveResponse} />
        </Card>
      </View>
    );
  }

  function renderPatternTest() {
    return (
      <View style={styles.stack}>
        <SectionTitle
          body="Your Food Pattern Profile starts with answers, then improves with meal logs and responses."
          eyebrow="Profile"
          title="Food Pattern Test"
        />
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.progressText}>
              {questionIndex + 1} / {foodPatternQuestions.length}
            </Text>
            <Text style={styles.modeText}>{Object.values(testAnswers).filter(Boolean).length} answered</Text>
          </View>
          <Text style={styles.questionText}>{currentQuestion.prompt}</Text>
          <View style={styles.stackSmall}>
            {currentQuestion.options.map((option) => (
              <Pressable
                accessibilityRole="button"
                key={option.value}
                onPress={() => handleAnswer(option.value)}
                style={[
                  styles.answerButton,
                  testAnswers[currentQuestion.id] === option.value && styles.answerButtonSelected
                ]}
              >
                <Text
                  style={[
                    styles.answerText,
                    testAnswers[currentQuestion.id] === option.value && { color: colors.accent }
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setQuestionIndex((current) => Math.max(0, current - 1))}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => handleAnswer(null)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </Pressable>
          </View>
          <PrimaryButton label="Generate profile" loading={isSaving} onPress={handleRunPatternTest} />
        </Card>

        {testCopy ? (
          <Card>
            <Text style={styles.eyebrow}>Result</Text>
            <Text style={styles.cardTitle}>{testCopy.title}</Text>
            <Text style={styles.body}>{testCopy.summary}</Text>
            <Text style={styles.body}>{testCopy.confidence_note}</Text>
            <View style={styles.reasonList}>
              {testResult?.reason_codes.slice(0, 4).map((reason) => (
                <View key={reason} style={styles.reasonPill}>
                  <Text style={styles.reasonText}>{displayLabel(reason)}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
      </View>
    );
  }

  function renderInsights() {
    return (
      <View style={styles.stack}>
        <SectionTitle
          body="Insights will sharpen as you log meals and post-meal responses."
          eyebrow="Food intelligence"
          title="Insights"
        />
        <Card>
          <Text style={styles.cardTitle}>{profileCopy?.title ?? 'Food Pattern Profile calibrating'}</Text>
          <Text style={styles.body}>
            {profileCopy?.summary ??
              'Healthi does not have enough food pattern signal yet. Take the Food Pattern Test or log a few meals.'}
          </Text>
          <View style={styles.signalGrid}>
            <Metric label="Responses" value={`${responses.length}`} tone={colors.accent} />
            <Metric label="Readiness" value={displayLabel(readinessSignal.label)} tone={colors.accentMid} />
            <Metric label="Food quality" value={displayLabel(foodQuality.label)} tone={colors.accentMid} />
            <Metric label="Source" value={confidenceText(readinessSignal.confidence)} tone={colors.textMuted} />
          </View>
        </Card>
        <Card>
          <Text style={styles.cardTitle}>Current summary</Text>
          <Text style={styles.body}>{readinessSignal.summary}</Text>
          <Text style={styles.body}>Based on logged meals and responses. {modeLabel}.</Text>
        </Card>
      </View>
    );
  }

  const inFlow = scannerOpen || !dietTabs.includes(activeSegment as DietTab);
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.safe}>
          <ScrollView
            ref={scrollRef}
            onScroll={(event) => { scrollPositions.current[scannerOpen ? 'scanner' : activeSegment] = event.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={100}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.adaptiveTopBar}>
              <Text accessibilityRole="header" style={styles.adaptivePageLabel}>Food</Text>
              <Text style={styles.diaryDetail}>{modeLabel}</Text>
            </View>
            {!inFlow ? <View style={styles.diaryTabs}><SegmentedControl options={['Overview', 'Nutrients', 'Quality'] as const} value={activeSegment === 'Diary' ? 'Overview' : activeSegment as 'Nutrients' | 'Quality'} onChange={(segment) => { closeScanner(); setActiveSegment(segment === 'Overview' ? 'Diary' : segment); }} /></View> : (
              <Pressable accessibilityRole="button" onPress={() => { closeScanner(); setActiveSegment(mealBuilder.items.length && scannerOpen ? 'Build Meal' : 'Diary'); }} style={styles.diaryTextButton}>
                <Ionicons name="chevron-back" size={20} color={colors.accentMid} /><Text style={styles.diaryLink}>{scannerOpen && mealBuilder.items.length ? 'Back to meal' : 'Back to diary'}</Text>
              </Pressable>
            )}
            {/saved|logged|could not|unavailable|not saved/i.test(status) ? <Text accessibilityLiveRegion="polite" style={styles.diaryStatus}>{status}</Text> : null}
            {scannerOpen ? renderScanner() : null}
            {!scannerOpen && (activeSegment === 'Diary' || activeSegment === 'Today') ? renderDiary() : null}
            {!scannerOpen && activeSegment === 'Quality' ? (
              <FoodQualityReviewPanel
                onOpenPreferences={() => setActiveSegment('Profile')}
                onOpenScanner={() => openScanner('log')}
                review={qualityReview}
                windowLabel="Today"
              />
            ) : null}
            {!scannerOpen && activeSegment === 'Timeline' ? renderTimeline() : null}
            {!scannerOpen && activeSegment === 'Nutrients' ? renderNutrients() : null}
            {!scannerOpen && activeSegment === 'Profile' ? renderProfile() : null}
            {!scannerOpen && activeSegment === 'Build Meal' ? renderMealBuilder() : null}
            {!scannerOpen && activeSegment === 'Log Meal' ? renderLogMeal() : null}
            {!scannerOpen && activeSegment === 'Response Log' ? renderResponseLog() : null}
            {!scannerOpen && activeSegment === 'Food Pattern Test' ? renderPatternTest() : null}
            {!scannerOpen && activeSegment === 'Insights' ? renderInsights() : null}
          </ScrollView>
          {!inFlow ? <View style={styles.adaptiveActionDock}>
            <Pressable accessibilityRole="button" onPress={() => { setMealStartMessage(''); setMealChooserOpen(true); }} style={({ pressed }) => [styles.diaryAdd, pressed && styles.pressed]}><Ionicons name="add" color="#FFFFFF" size={22} /><Text style={styles.adaptivePrimaryButtonText}>Add meal</Text></Pressable>
            {/*
              Scanning was three taps inside the add-meal sheet, which is a long way
              round for the thing people stand in a shop holding. It gets its own key
              on the same bar — no label, because a barcode is already the word.
            */}
            <Pressable
              accessibilityLabel="Scan a product barcode"
              accessibilityRole="button"
              onPress={() => openScanner('log')}
              style={({ pressed }) => [styles.dockScan, pressed && styles.pressed]}
            >
              <Ionicons name="barcode-outline" color={colors.accent} size={24} />
            </Pressable>
          </View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
      {mealChooserOpen ? <EntrySheet title="Add meal" onClose={() => setMealChooserOpen(false)}>
        <Text style={styles.diaryDetail}>Which meal are you logging?</Text>
        {mealStartMessage ? <Text accessibilityRole="alert" style={styles.diaryDetail}>{mealStartMessage}</Text> : null}
        {mealBuilder.items.length ? <ActionRow title={`Continue your ${mealTypeLabel(mealBuilder.meal_type).toLowerCase()}`} detail={`${mealBuilder.items.length} foods in your unsaved draft`} onPress={() => { setMealChooserOpen(false); setActiveSegment('Build Meal'); }} /> : null}
        {diaryMealChoices.map(choice => <ActionRow key={choice.type} title={choice.label} icon="add-circle-outline" onPress={() => beginDiaryMeal(choice.type)} />)}
        <ActionRow title="Reuse a meal" detail="Starred, recent, and saved meals" icon="bookmark-outline" onPress={() => openMealLibrary()} last />
      </EntrySheet> : null}
      {foodEntryOpen ? <FoodEntryPicker
        mealLabel={mealTypeLabel(mealBuilder.meal_type)}
        avoidingAllergens={avoidingAllergens}
        query={searchQuery}
        onQueryChange={(value) => { searchGeneration.current += 1; searchController.current?.abort(); setIsSearchingProducts(false); setSearchQuery(value); setSearchResults([]); setSearchMessage(''); }}
        onSearch={handleSearchProducts}
        results={searchResults}
        searching={isSearchingProducts}
        message={searchMessage}
        products={productLibrary}
        onToggleSaved={handleToggleSavedProduct}
        onAdd={async (product, source, servings) => { await addSnapshotToMealBuilder(product, source, servings); setFoodEntryOpen(false); setActiveSegment('Build Meal'); }}
        onScan={() => openScanner('builder')}
        onPhoto={openPhotoEntry}
        onManual={() => { setFoodEntryOpen(false); setManualFoodOpen(true); }}
        onClose={() => setFoodEntryOpen(false)}
        onOpenLibrary={() => openMealLibrary()}
      /> : null}
      {manualFoodOpen ? renderManualFood() : null}
      {selectedMeal ? <EntrySheet title={selectedMeal.name} onClose={() => setSelectedMeal(null)}>
        <Text style={styles.diaryDetail}>{displayLabel(selectedMeal.meal_type)} · {formatClock(selectedMeal.logged_at)}</Text>
        <MealMacroGrid meal={selectedMeal} />
        {mealLogItems.filter((item) => item.meal_log_id === selectedMeal.id).map((item) => <ActionRow key={item.id} title={item.name} detail={`${item.servings} × ${item.serving_size ?? 'serving (size not reported)'}`} onPress={() => void startEditingMeal(selectedMeal)} />)}
        {mealDetailMessage ? <Text accessibilityRole="alert" style={styles.diaryDetail}>{mealDetailMessage}</Text> : null}
        <ActionRow title="Edit foods & portions" detail="Add foods, remove foods, or change amounts" icon="create-outline" onPress={() => void startEditingMeal(selectedMeal)} />
        <ActionRow title="Star or save this meal" icon="star-outline" onPress={() => openMealLibrary(createMealCollectionEntry(selectedMeal, mealLogItems))} />
        <ActionRow title="Add a personal response" detail="Optional: how did this meal feel?" icon="chatbubble-outline" onPress={() => { updateResponseForm('meal_log_id', selectedMeal.id ?? null); setSelectedMeal(null); setActiveSegment('Response Log'); }} last />
      </EntrySheet> : null}
      {mealEditDraft ? <MealEditSheet draft={mealEditDraft} onChange={setMealEditDraft} onClose={() => setMealEditDraft(null)} onSave={handleSaveMealEdit} busy={savingMealEdit} error={mealEditError} /> : null}
      {mealLibraryOpen ? <MealLibrarySheet key={`${mode}:${userId}`} userId={userId} demo={mode === 'demo'} client={supabase as unknown as MealCollectionClient} meals={meals} items={mealLogItems} foods={productLibrary} initialEntry={libraryInitialEntry} onClose={() => setMealLibraryOpen(false)} onUseMeal={usePreviousMeal} onUseFood={food => { setMealLibraryOpen(false); setSearchQuery(food.name); setSearchResults([food]); setSearchMessage('Choose this food to review your portion.'); setFoodEntryOpen(true); }} /> : null}
      {photoEntryOpen ? <PhotoEntrySheet available={canUseRemote} busy={photoBusy} notice={photoNotice} onCapture={source => void handlePhotoEstimate(source)} onClose={() => setPhotoEntryOpen(false)} onSearch={() => { setPhotoEntryOpen(false); setFoodEntryOpen(true); }} /> : null}
      {photoEstimate ? <PhotoEstimateSheet
        busy={photoBusy}
        error={photoNotice}
        estimate={photoEstimate}
        onChange={setPhotoEstimate}
        onClose={closePhotoEstimate}
        onConfirm={() => void confirmPhotoEstimate()}
        onSearchInstead={() => {
          // An estimate that named the food but got the product wrong is best fixed by
          // searching for it: that swaps a guess for a record with real label evidence.
          const first = photoEstimate.items[0]?.name ?? '';
          closePhotoEstimate();
          setSearchQuery(first);
          setSearchResults([]);
          setSearchMessage(first ? `Search for "${first}" — a search result carries label data an estimate cannot.` : '');
          setFoodEntryOpen(true);
        }}
        photoUri={photoUri}
      /> : null}
    </View>
  );
}

function ChoiceRow({
  label,
  options,
  selected,
  onSelect
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.choiceRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <Chip key={option} label={displayLabel(option)} onPress={() => onSelect(option)} selected={selected === option} tone="lavender" />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  diarySection: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, gap: 12 },
  diaryHeading: { fontFamily: sans, fontSize: 20, lineHeight: 26, fontWeight: '600', color: colors.text },
  diaryDetail: { fontFamily: sans, fontSize: 14, lineHeight: 21, color: colors.textMuted },
  diaryEnergy: { paddingVertical: 8, gap: 3 },
  diaryEnergyValue: { fontFamily: sans, fontSize: 38, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  diaryMacros: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 10 },
  diaryMacro: { flex: 1, minWidth: 70, gap: 4 },
  diaryMacroValue: { fontFamily: sans, fontSize: 17, lineHeight: 24, fontWeight: '600', color: colors.text },
  diaryNotice: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  diaryTextButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  diaryLink: { fontFamily: sans, fontSize: 16, lineHeight: 22, color: colors.accentMid, fontWeight: '500' },
  diaryStatus: { fontFamily: sans, fontSize: 14, lineHeight: 21, color: colors.textMuted, paddingVertical: 8 },
  diaryAdd: { flex: 1, backgroundColor: colors.accent, minHeight: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderRadius: 16 },
  // Fixed width rather than a flex share, so the primary action keeps the bar and this
  // stays a key beside it at roughly a fifth of the width on a phone.
  dockScan: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderWidth: hairlineWidth,
    justifyContent: 'center',
    minHeight: 52,
    width: 68
  },
  diaryTabs: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  screen: {
    flex: 1,
    backgroundColor: '#000000'
  },
  safe: {
    flex: 1
  },
  scroll: {
    paddingBottom: 28
  },
  adaptiveTopBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    gap: 12,
    flexWrap: 'wrap',
    paddingTop: 18
  },
  adaptivePageLabel: {
    color: '#F5F5F7',
    fontFamily: sansMedium,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.7,
    lineHeight: 38
  },
  trackerCard: {
    backgroundColor: '#121214',
    borderColor: 'rgba(30, 144, 255, 0.20)',
    borderRadius: 22,
    borderWidth: 1
  },
  trackerTitle: {
    color: '#F5F5F7',
    fontFamily: serif,
    fontSize: 26,
    lineHeight: 32,
    marginTop: 5
  },
  trackerEnergyRow: {
    alignItems: 'flex-end',
    borderBottomColor: 'rgba(30, 144, 255, 0.12)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16
  },
  trackerEnergyValue: {
    color: '#1E90FF',
    fontFamily: serif,
    fontSize: 42,
    lineHeight: 46
  },
  trackerEnergyLabel: {
    color: '#A1A1A6',
    fontFamily: sans,
    fontSize: 12
  },
  trackerEnergyTarget: {
    color: '#8E8E93',
    fontFamily: sansMedium,
    fontSize: 12,
    paddingBottom: 3
  },
  trackerMacroList: {
    gap: 14
  },
  trackerProgress: {
    gap: 7
  },
  trackerProgressLabel: {
    color: '#D1D1D6',
    fontFamily: sansMedium,
    fontSize: 13
  },
  trackerRail: {
    backgroundColor: 'rgba(30, 144, 255, 0.10)',
    borderRadius: 4,
    height: 6,
    overflow: 'hidden'
  },
  trackerFill: {
    backgroundColor: '#5AC8FA',
    borderRadius: 4,
    height: 6
  },
  trackerMicroBlock: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    gap: 12,
    padding: 14
  },
  trackerMicroHeading: {
    color: '#D1D1D6',
    fontFamily: sansMedium,
    fontSize: 12,
    letterSpacing: 0.3
  },
  trackerMicroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  trackerMicroItem: {
    backgroundColor: '#121214',
    borderRadius: 12,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 3,
    minHeight: 58,
    padding: 10
  },
  trackerMicroValue: {
    color: '#1E90FF',
    fontFamily: sansMedium,
    fontSize: 13
  },
  trackerMicroUnavailable: {
    color: '#8E8E93',
    fontFamily: sansMedium,
    fontSize: 10
  },
  trackerMicroLabel: {
    color: '#A1A1A6',
    fontFamily: sans,
    fontSize: 11
  },
  trackerActions: {
    flexDirection: 'row',
    gap: 10
  },
  trackerSearchButton: {
    alignItems: 'center',
    borderColor: 'rgba(30, 144, 255, 0.28)',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 48
  },
  trackerSearchText: {
    color: '#1E90FF',
    fontFamily: sansMedium,
    fontSize: 12
  },
  trackerScanButton: {
    alignItems: 'center',
    backgroundColor: '#1E90FF',
    borderRadius: 14,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 48
  },
  trackerScanText: {
    color: '#FFFFFF',
    fontFamily: sansMedium,
    fontSize: 12
  },
  adaptiveMode: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 40
  },
  adaptiveModeDot: {
    backgroundColor: '#FFD479',
    borderRadius: 3,
    height: 6,
    width: 6
  },
  adaptiveModeText: {
    color: '#A1A1A6',
    fontFamily: sansMedium,
    fontSize: 12,
    letterSpacing: 0.8,
    lineHeight: 13,
    textTransform: 'uppercase'
  },
  adaptiveTabBar: {
    marginTop: 7,
    paddingHorizontal: 22
  },
  adaptiveTab: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    marginRight: 26,
    minHeight: 44,
    paddingBottom: 9,
    paddingTop: 8
  },
  adaptiveTabActive: {
    borderBottomColor: '#1E90FF'
  },
  adaptiveTabText: {
    color: '#A1A1A6',
    fontFamily: sansMedium,
    fontSize: 15,
    letterSpacing: -0.1,
    lineHeight: 21
  },
  adaptiveTabTextActive: {
    color: '#F5F5F7'
  },
  adaptiveTabBaseline: {
    backgroundColor: 'rgba(255, 255, 255,0.10)',
    height: hairlineWidth,
    marginTop: -1
  },
  adaptiveBack: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 7,
    marginLeft: 18,
    marginTop: 14,
    minHeight: 44,
    paddingHorizontal: 4
  },
  adaptiveBackText: {
    color: '#A1A1A6',
    fontFamily: sansMedium,
    fontSize: 13,
    lineHeight: 18
  },
  adaptivePage: {
    paddingBottom: 8
  },
  adaptiveHero: {
    paddingBottom: 24,
    paddingHorizontal: 22,
    paddingTop: 26
  },
  adaptiveSection: {
    borderTopColor: 'rgba(255, 255, 255,0.10)',
    borderTopWidth: hairlineWidth,
    paddingBottom: 24,
    paddingHorizontal: 22,
    paddingTop: 22
  },
  adaptiveSectionLabel: {
    color: '#A1A1A6',
    fontFamily: sansMedium,
    fontSize: 12,
    letterSpacing: 1.5,
    lineHeight: 15,
    textTransform: 'uppercase'
  },
  adaptiveConfidenceValue: {
    color: '#F5F5F7',
    fontFamily: sansMedium,
    fontSize: 12,
    lineHeight: 16
  },
  adaptivePrimaryButton: {
    alignItems: 'center',
    backgroundColor: '#1E90FF',
    borderRadius: 13,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 52,
    paddingHorizontal: 18
  },
  adaptivePrimaryButtonText: {
    color: '#FFFFFF',
    fontFamily: sansMedium,
    fontSize: 15,
    lineHeight: 20
  },
  adaptiveSectionHeading: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between'
  },
  adaptiveSectionAside: {
    color: '#A1A1A6',
    fontFamily: sans,
    fontSize: 12,
    lineHeight: 15
  },
  adaptivePriorityList: {
    marginTop: 16
  },
  adaptivePriority: {
    borderBottomColor: 'rgba(255, 255, 255,0.07)',
    borderBottomWidth: hairlineWidth,
    marginBottom: 18,
    paddingBottom: 18
  },
  adaptivePriorityTag: {
    color: '#F5F5F7',
    fontFamily: sansMedium,
    fontSize: 12,
    letterSpacing: 1.75,
    lineHeight: 15,
    textTransform: 'uppercase'
  },
  adaptivePriorityTagUrgent: {
    color: '#FFD479'
  },
  adaptiveMono: {
    color: '#A1A1A6',
    fontFamily: sans,
    fontSize: 12,
    lineHeight: 15,
    fontVariant: ['tabular-nums']
  },
  adaptiveMonoStrong: {
    color: '#F5F5F7',
    fontFamily: sansMedium,
    fontSize: 14,
    lineHeight: 19,
    fontVariant: ['tabular-nums']
  },
  adaptivePriorityTitle: {
    color: '#F5F5F7',
    fontFamily: sansMedium,
    fontSize: 16.5,
    letterSpacing: -0.1,
    lineHeight: 22,
    marginTop: 7
  },
  adaptivePriorityReason: {
    color: '#A1A1A6',
    fontFamily: sans,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 5
  },
  adaptivePriorityActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginTop: 10
  },
  adaptiveInlineAction: {
    borderBottomColor: 'rgba(30, 144, 255,0.35)',
    borderBottomWidth: 1,
    justifyContent: 'center',
    minHeight: 44
  },
  adaptiveInlineActionText: {
    color: '#1E90FF',
    fontFamily: sansMedium,
    fontSize: 13.5,
    lineHeight: 18
  },
  adaptivePriorityConfidence: {
    color: '#A1A1A6',
    fontFamily: sansMedium,
    fontSize: 12,
    letterSpacing: 0.6,
    lineHeight: 14,
    marginLeft: 'auto',
    textTransform: 'uppercase'
  },
  adaptiveSectionVoice: {
    color: '#A1A1A6',
    fontFamily: serifItalic,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 8
  },
  adaptiveLaneList: {
    marginTop: 17
  },
  adaptiveLane: {
    borderBottomColor: 'rgba(255, 255, 255,0.07)',
    borderBottomWidth: hairlineWidth
  },
  adaptiveLaneButton: {
    justifyContent: 'center',
    minHeight: 66,
    paddingVertical: 13
  },
  adaptiveLaneName: {
    color: '#F5F5F7',
    flex: 1,
    fontFamily: sansMedium,
    fontSize: 15,
    lineHeight: 20
  },
  adaptiveLaneState: {
    color: '#5AC8FA',
    fontFamily: sansMedium,
    fontSize: 12,
    lineHeight: 16
  },
  adaptiveLaneStateWarm: {
    color: '#FFD479'
  },
  adaptiveLaneTrackRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 9
  },
  adaptiveLaneTrack: {
    backgroundColor: 'rgba(255, 255, 255,0.10)',
    borderRadius: 2,
    flex: 1,
    height: 4,
    overflow: 'hidden'
  },
  adaptiveLaneTrackLimited: {
    borderColor: 'rgba(255, 255, 255,0.25)',
    borderWidth: 1
  },
  adaptiveLaneFill: {
    backgroundColor: '#5AC8FA',
    borderRadius: 2,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0
  },
  adaptiveLaneMeta: {
    color: '#A1A1A6',
    fontFamily: sansMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    lineHeight: 13,
    textTransform: 'uppercase'
  },
  adaptiveLaneDetail: {
    color: '#A1A1A6',
    fontFamily: sans,
    fontSize: 13,
    lineHeight: 19,
    paddingBottom: 15
  },
  adaptiveCoverageLabel: {
    color: '#A1A1A6',
    fontFamily: sansMedium,
    fontSize: 12,
    letterSpacing: 0.9,
    lineHeight: 14,
    marginTop: 16,
    textTransform: 'uppercase'
  },
  adaptiveCoverageNeed: {
    color: '#F5F5F7',
    fontFamily: serif,
    fontSize: 18,
    lineHeight: 24,
    marginTop: 6
  },
  adaptiveInsetCard: {
    backgroundColor: '#121214',
    borderColor: 'rgba(255, 255, 255,0.10)',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
    padding: 18
  },
  adaptiveCoverageSuggestion: {
    color: '#F5F5F7',
    fontFamily: serif,
    fontSize: 20,
    lineHeight: 27,
    marginTop: 6
  },
  adaptiveRecent: {
    alignItems: 'center',
    backgroundColor: '#121214',
    borderColor: 'rgba(255, 255, 255,0.10)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 66,
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  adaptiveRecentCopy: {
    flex: 1,
    minWidth: 0
  },
  adaptiveRecentTitle: {
    color: '#F5F5F7',
    fontFamily: sansMedium,
    fontSize: 14.5,
    lineHeight: 20
  },
  adaptiveViewTitle: {
    color: '#F5F5F7',
    fontFamily: serifLight,
    fontSize: 23,
    lineHeight: 30,
    marginTop: 8
  },
  adaptiveTimeline: {
    marginTop: 26
  },
  adaptiveTimelineEvent: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    minHeight: 74,
    position: 'relative'
  },
  adaptiveTimelineTime: {
    color: '#A1A1A6',
    fontFamily: sans,
    fontSize: 12,
    lineHeight: 17,
    paddingTop: 1,
    textAlign: 'right',
    width: 54
  },
  adaptiveTimelineMarker: {
    backgroundColor: '#5AC8FA',
    borderColor: '#000000',
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    marginHorizontal: 13,
    marginTop: 3,
    width: 12
  },
  adaptiveTimelineCopy: {
    borderBottomColor: 'rgba(255, 255, 255,0.07)',
    borderBottomWidth: hairlineWidth,
    flex: 1,
    minHeight: 64,
    paddingBottom: 14
  },
  adaptiveTimelineTitle: {
    color: '#F5F5F7',
    fontFamily: sansMedium,
    fontSize: 15,
    lineHeight: 20
  },
  adaptiveTimelineNote: {
    backgroundColor: '#121214',
    borderColor: 'rgba(255, 255, 255,0.10)',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    padding: 16
  },
  adaptiveEmpty: {
    backgroundColor: '#121214',
    borderColor: 'rgba(255, 255, 255,0.10)',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20
  },
  adaptiveSearch: {
    backgroundColor: '#121214',
    borderColor: 'rgba(255, 255, 255,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    color: '#F5F5F7',
    fontFamily: sansMedium,
    fontSize: 15,
    height: 46,
    marginTop: 18,
    paddingHorizontal: 16
  },
  adaptiveConfidenceSummary: {
    borderTopColor: 'rgba(255, 255, 255,0.08)',
    borderTopWidth: hairlineWidth,
    marginTop: 16,
    paddingTop: 15
  },
  adaptiveNutrientRow: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255, 255, 255,0.07)',
    borderBottomWidth: hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 74,
    paddingVertical: 12
  },
  adaptiveNutrientCopy: {
    flex: 1,
    minWidth: 0
  },
  adaptiveNutrientContext: {
    color: '#A1A1A6',
    fontFamily: sans,
    fontSize: 13,
    lineHeight: 16,
    marginTop: 3
  },
  adaptiveNutrientValue: {
    alignItems: 'flex-end'
  },
  adaptiveFoundationMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 14
  },
  adaptiveFoundationBadge: {
    borderColor: 'rgba(30, 144, 255,0.40)',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  adaptiveFoundationBadgeText: {
    color: '#1E90FF',
    fontFamily: sansMedium,
    fontSize: 12,
    letterSpacing: 0.8,
    lineHeight: 14,
    textTransform: 'uppercase'
  },
  adaptiveProfileLead: {
    color: '#F5F5F7',
    fontFamily: serifLight,
    fontSize: 19,
    lineHeight: 29,
    marginTop: 14
  },
  adaptiveContributorList: {
    backgroundColor: 'rgba(255, 255, 255,0.08)',
    borderRadius: 12,
    gap: 1,
    marginTop: 18,
    overflow: 'hidden'
  },
  adaptiveContributorRow: {
    alignItems: 'center',
    backgroundColor: '#000000',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12
  },
  adaptiveContributorLabel: {
    color: '#F5F5F7',
    fontFamily: sansMedium,
    fontSize: 13.5,
    lineHeight: 18
  },
  adaptiveContributorValue: {
    color: '#A1A1A6',
    fontFamily: sansMedium,
    fontSize: 12,
    lineHeight: 16
  },
  adaptiveSecondaryButton: {
    alignItems: 'center',
    backgroundColor: '#121214',
    borderColor: 'rgba(255, 255, 255,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 48,
    paddingHorizontal: 16
  },
  adaptiveSecondaryButtonText: {
    color: '#F5F5F7',
    fontFamily: sansMedium,
    fontSize: 14,
    lineHeight: 19
  },
  adaptiveSafetyNote: {
    color: '#A1A1A6',
    fontFamily: sans,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center'
  },
  adaptiveActionDock: {
    backgroundColor: '#000000',
    borderTopColor: 'rgba(255, 255, 255,0.10)',
    borderTopWidth: hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 6,
    paddingHorizontal: 22,
    paddingTop: 9
  },
  adaptiveDockButton: {
    alignItems: 'center',
    backgroundColor: '#121214',
    borderColor: 'rgba(255, 255, 255,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48
  },
  adaptiveDockAdd: {
    alignItems: 'center',
    backgroundColor: '#121214',
    borderColor: 'rgba(255, 255, 255,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18
  },
  adaptiveDockText: {
    color: '#F5F5F7',
    fontFamily: sansMedium,
    fontSize: 14,
    lineHeight: 19
  },
  topBar: {
    paddingHorizontal: 26,
    paddingTop: 22
  },
  pageEyebrow: {
    ...themeType.eyebrow,
    color: colors.textFaint
  },
  pageTitle: {
    ...themeType.title,
    color: colors.text,
    marginTop: 7
  },
  wordmark: {
    color: C.goldSoft,
    fontFamily: serif,
    fontSize: 28,
    lineHeight: 34
  },
  topSub: {
    color: C.sub,
    fontFamily: sans,
    fontSize: themeType.caption.fontSize,
    lineHeight: themeType.caption.lineHeight,
    marginTop: 2
  },
  iconBubble: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 144, 255,0.08)',
    borderColor: 'rgba(30, 144, 255,0.24)',
    borderRadius: 18,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  segmentBar: {
    marginTop: 22
  },
  segmentBaseline: {
    backgroundColor: colors.hairlineSoft,
    height: hairlineWidth
  },
  segment: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    marginLeft: 26,
    paddingBottom: 12
  },
  segmentActive: {
    borderBottomColor: colors.accent
  },
  segmentText: {
    color: C.sub,
    fontFamily: sansMedium,
    fontSize: themeType.caption.fontSize,
    lineHeight: themeType.caption.lineHeight
  },
  segmentTextActive: {
    color: colors.text
  },
  statusLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 26,
    paddingTop: 16
  },
  statusDot: {
    backgroundColor: colors.accent,
    borderRadius: 3,
    height: 5,
    width: 5
  },
  statusText: {
    color: C.sub,
    fontFamily: sans,
    fontSize: themeType.caption.fontSize,
    lineHeight: themeType.caption.lineHeight
  },
  stack: {
    gap: 14,
    marginTop: 14,
    paddingHorizontal: 20
  },
  stackSmall: {
    gap: 8
  },
  card: {
    backgroundColor: C.card,
    borderColor: C.hairline,
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 18
  },
  heroCard: {
    borderColor: palette.forestPale,
    padding: 20
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  sectionTitle: {
    gap: 6,
    paddingHorizontal: 2
  },
  eyebrow: {
    ...themeType.eyebrow,
    color: C.gold,
    textTransform: 'uppercase'
  },
  title: {
    ...themeType.title,
    color: C.ink,
    fontFamily: serif
  },
  heroTitle: {
    ...themeType.title,
    color: C.ink,
    fontFamily: serifLight,
    fontSize: 38,
    lineHeight: 44,
    marginTop: 4
  },
  cardTitle: {
    ...themeType.heading,
    color: C.ink,
    fontFamily: serif,
    marginBottom: 8
  },
  body: {
    ...themeType.body,
    color: C.sub
  },
  modePill: {
    backgroundColor: palette.forestWash,
    borderColor: palette.forestPale,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  modeText: {
    color: C.lavender,
    fontFamily: sansMedium,
    fontSize: themeType.eyebrow.fontSize,
    lineHeight: themeType.eyebrow.lineHeight
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18
  },
  signalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
    marginTop: 10
  },
  metric: {
    backgroundColor: '#1C1C1E',
    borderColor: C.hairline,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: '30%',
    padding: 12
  },
  metricLabel: {
    color: C.muted,
    fontFamily: sansMedium,
    fontSize: themeType.eyebrow.fontSize,
    lineHeight: themeType.eyebrow.lineHeight,
    letterSpacing: 1.3,
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  metricValue: {
    ...themeType.number,
    color: C.ink,
    fontFamily: sansMedium
  },
  field: {
    marginBottom: 12
  },
  fieldHalf: {
    flexBasis: '47%',
    flexGrow: 1
  },
  fieldLabel: {
    color: C.sub,
    fontFamily: sansMedium,
    fontSize: themeType.eyebrow.fontSize,
    lineHeight: themeType.eyebrow.lineHeight,
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  input: {
    backgroundColor: palette.paper,
    borderColor: C.hairline,
    borderRadius: 16,
    borderWidth: 1,
    color: C.ink,
    fontFamily: sans,
    fontSize: themeType.body.fontSize,
    lineHeight: themeType.body.lineHeight,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  textarea: {
    minHeight: 92,
    textAlignVertical: 'top'
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14
  },
  chip: {
    borderColor: C.hairline,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  chipSelected: {
    backgroundColor: colors.accentWash,
    borderColor: colors.accent
  },
  chipText: {
    color: C.sub,
    fontFamily: sansMedium,
    fontSize: themeType.caption.fontSize,
    lineHeight: themeType.caption.lineHeight
  },
  chipTextSelected: {
    color: colors.accent
  },
  twoCol: {
    columnGap: 10,
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: C.gold,
    borderRadius: 18,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
    paddingHorizontal: 18
  },
  pressed: {
    opacity: 0.75
  },
  disabled: {
    opacity: 0.55
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: sansMedium,
    fontSize: themeType.label.fontSize,
    lineHeight: themeType.label.lineHeight
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: C.hairline,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center'
  },
  secondaryButtonText: {
    color: C.sub,
    fontFamily: sansMedium,
    fontSize: themeType.label.fontSize,
    lineHeight: themeType.label.lineHeight
  },
  choiceRow: {
    marginBottom: 8
  },
  progressText: {
    color: C.goldSoft,
    fontFamily: sansMedium,
    fontSize: themeType.caption.fontSize,
    lineHeight: themeType.caption.lineHeight,
    letterSpacing: 1.2
  },
  questionText: {
    ...themeType.heading,
    color: C.ink,
    fontFamily: serifItalic,
    fontSize: 24,
    lineHeight: 31,
    marginBottom: 16,
    marginTop: 18
  },
  answerButton: {
    backgroundColor: palette.paper,
    borderColor: C.hairline,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 15
  },
  answerButtonSelected: {
    backgroundColor: palette.forestWash,
    borderColor: palette.forestPale
  },
  answerText: {
    color: C.sub,
    fontFamily: sansMedium,
    fontSize: themeType.label.fontSize,
    lineHeight: themeType.label.lineHeight
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14
  },
  reasonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14
  },
  reasonPill: {
    backgroundColor: palette.forestWash,
    borderColor: palette.forestPale,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  reasonText: {
    color: C.teal,
    fontFamily: sansMedium,
    fontSize: themeType.eyebrow.fontSize,
    lineHeight: themeType.eyebrow.lineHeight
  },
  scannerHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2
  },
  scannerHeadingCopy: {
    flex: 1
  },
  iconButton: {
    alignItems: 'center',
    borderColor: C.hairline,
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  scannerIntroRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12
  },
  scannerIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentWash,
    borderColor: palette.forestPale,
    borderRadius: 16,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  cameraShell: {
    backgroundColor: '#000000',
    borderRadius: 20,
    height: 320,
    marginTop: 16,
    overflow: 'hidden'
  },
  scanFrame: {
    borderColor: palette.paper,
    borderRadius: 16,
    borderWidth: 2,
    height: 112,
    left: '12%',
    opacity: 0.88,
    position: 'absolute',
    right: '12%',
    top: 84
  },
  cameraCancel: {
    alignItems: 'center',
    backgroundColor: 'rgba(26,33,29,0.78)',
    borderColor: 'rgba(253,252,249,0.38)',
    borderRadius: 16,
    borderWidth: 1,
    bottom: 18,
    left: 48,
    minHeight: 44,
    position: 'absolute',
    right: 48,
    justifyContent: 'center'
  },
  cameraCancelText: {
    color: '#FFFFFF',
    fontFamily: sansMedium,
    fontSize: themeType.label.fontSize,
    lineHeight: themeType.label.lineHeight
  },
  orRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    marginTop: 20
  },
  orLine: {
    backgroundColor: C.hairline,
    flex: 1,
    height: hairlineWidth
  },
  orText: {
    color: C.muted,
    fontFamily: sansMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    lineHeight: 13
  },
  scannerMessage: {
    ...themeType.caption,
    color: C.sub,
    marginTop: 12,
    textAlign: 'center'
  },
  productCard: {
    borderColor: palette.forestPale,
    padding: 20
  },
  productHeaderCopy: {
    flex: 1,
    minWidth: 0
  },
  productMeta: {
    ...themeType.caption,
    color: C.sub,
    marginTop: 5
  },
  productMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20
  },
  scoringLabBanner: {
    alignItems: 'center',
    backgroundColor: colors.accentWash,
    borderColor: palette.forestPale,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  scoringLabBannerTitle: {
    ...themeType.label,
    color: C.ink
  },
  scoringLabBannerText: {
    ...themeType.caption,
    color: C.sub,
    marginTop: 2
  },
  qualityLabel: {
    color: colors.accent,
    fontFamily: sansMedium,
    fontSize: themeType.caption.fontSize,
    lineHeight: themeType.caption.lineHeight,
    marginLeft: 12,
    textAlign: 'right'
  },
  signalReasonRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 9,
    marginTop: 10
  },
  signalReasonText: {
    ...themeType.caption,
    color: C.sub,
    flex: 1
  },
  confidenceLine: {
    ...themeType.caption,
    color: C.muted,
    marginTop: 13
  },
  disclosureBlock: {
    borderBottomColor: C.hairline,
    borderBottomWidth: hairlineWidth
  },
  disclosureHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: 9
  },
  disclosureTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9
  },
  disclosureTitle: {
    ...themeType.label,
    color: C.ink
  },
  disclosureContent: {
    paddingBottom: 16,
    paddingLeft: 27
  },
  optionTitle: {
    ...themeType.label,
    color: C.ink,
    marginBottom: 4
  },
  evidenceItem: {
    borderTopColor: C.hairline,
    borderTopWidth: hairlineWidth,
    paddingVertical: 13,
    paddingLeft: 27
  },
  evidenceSource: {
    ...themeType.caption,
    color: colors.accent,
    marginBottom: 5
  },
  personalResponseNote: {
    alignItems: 'flex-start',
    backgroundColor: colors.accentWash,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    padding: 13
  },
  personalResponseText: {
    ...themeType.caption,
    color: C.sub,
    flex: 1
  },
  productFormDivider: {
    backgroundColor: C.hairline,
    height: hairlineWidth,
    marginBottom: 18,
    marginTop: 6
  },
  scanActionCard: {
    borderColor: palette.forestPale
  },
  inlineTextButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingTop: 8
  },
  inlineTextButtonText: {
    color: colors.accent,
    fontFamily: sansMedium,
    fontSize: themeType.label.fontSize,
    lineHeight: themeType.label.lineHeight
  },
  builderCard: {
    borderColor: palette.forestPale
  },
  builderMessage: {
    ...themeType.caption,
    color: C.sub,
    marginTop: 2
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 16
  },
  searchInput: {
    flex: 1,
    marginBottom: 0
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  libraryList: {
    marginTop: 12
  },
  libraryRow: {
    alignItems: 'center',
    borderTopColor: C.hairline,
    borderTopWidth: hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 72,
    paddingVertical: 12
  },
  libraryCopy: {
    flex: 1,
    minWidth: 0
  },
  libraryName: {
    color: C.ink,
    fontFamily: sansMedium,
    fontSize: themeType.label.fontSize,
    lineHeight: themeType.label.lineHeight
  },
  libraryMeta: {
    ...themeType.caption,
    color: C.sub,
    marginTop: 3
  },
  librarySignal: {
    color: colors.accent,
    fontFamily: sansMedium,
    fontSize: themeType.caption.fontSize,
    lineHeight: themeType.caption.lineHeight,
    marginTop: 3
  },
  addIconButton: {
    alignItems: 'center',
    backgroundColor: colors.accentWash,
    borderColor: palette.forestPale,
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  smallIconButton: {
    alignItems: 'center',
    borderColor: C.hairline,
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  mealContentsCard: {
    borderColor: palette.forestPale
  },
  builderItemRow: {
    alignItems: 'center',
    borderTopColor: C.hairline,
    borderTopWidth: hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 74,
    paddingVertical: 12
  },
  builderItemCopy: {
    flex: 1,
    minWidth: 0
  },
  servingsInput: {
    backgroundColor: palette.paper,
    borderColor: C.hairline,
    borderRadius: 14,
    borderWidth: 1,
    color: C.ink,
    fontFamily: sansMedium,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 10,
    textAlign: 'center',
    width: 52
  },
  scannerShortcut: {
    alignItems: 'center',
    backgroundColor: colors.accentWash,
    borderColor: palette.forestPale,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    minHeight: 50,
    paddingHorizontal: 14
  },
  scannerShortcutText: {
    color: colors.accent,
    flex: 1,
    fontFamily: sansMedium,
    fontSize: themeType.label.fontSize,
    lineHeight: themeType.label.lineHeight
  }
});
