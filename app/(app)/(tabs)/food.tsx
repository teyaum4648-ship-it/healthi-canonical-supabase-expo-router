import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { useAuth } from '../../../src/features/auth/AuthProvider';
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
  appendLocalDemoMealLog,
  appendLocalDemoPostMealResponse,
  getLocalDemoNutritionState,
  saveLocalDemoFoodPatternProfile,
  saveLocalDemoMealLogs
} from '../../../src/features/nutrition/localDemoNutritionStore';
import {
  getActiveNutritionTarget,
  getMealLogsForDate,
  saveMealLog,
  type MealLogRow,
  type NutritionSupabaseClient,
  type NutritionTargetRow
} from '../../../src/features/nutrition/persistence';
import {
  normalizeBarcode,
  shouldProcessBarcodeScan,
  type BarcodeScanStamp
} from '../../../src/features/nutrition/productLookup/barcodeUtils';
import { lookupOpenFoodFactsProduct } from '../../../src/features/nutrition/productLookup/openFoodFactsClient';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';
import {
  normalizeServingQuantity,
  scannedProductToMealLog
} from '../../../src/features/nutrition/scannedMealLogMapper';
import { isSupabaseConfigured, supabase } from '../../../src/lib/supabase';
import {
  colors,
  colors as themeColors,
  fonts as themeFonts,
  hairlineWidth,
  palette,
  type as themeType
} from '../../../src/styles/theme';

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

const defaultTargets: NutritionTargets = {
  calories_target: 2300,
  protein_g_target: 160,
  carbs_g_target: 240,
  fat_g_target: 80,
  fiber_g_target: 30,
  sodium_mg_limit: 2300,
  confidence: 'low',
  basis: ['default']
};

const segments = ['Today', 'Log Meal', 'Response Log', 'Food Pattern Test', 'Insights'] as const;
type Segment = typeof segments[number];

function dateKey(value: string): string {
  return value.slice(0, 10);
}

function displayLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatAmount(value: number | null | undefined, suffix = ''): string {
  if (typeof value !== 'number') return '-';
  return `${Math.round(value)}${suffix}`;
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
  if (!row) return defaultTargets;

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
  style
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
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

export default function FoodScreen() {
  const { session } = useAuth();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [activeSegment, setActiveSegment] = useState<Segment>('Today');
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannerProduct, setScannerProduct] = useState<HealthiProductSnapshot | null>(null);
  const [scannerMessage, setScannerMessage] = useState('Scan a barcode or enter its numbers below.');
  const [scannerMealType, setScannerMealType] = useState<MealType>('unknown');
  const [scannerServingQuantity, setScannerServingQuantity] = useState('1');
  const [scannerMealName, setScannerMealName] = useState('');
  const [isLookingUpProduct, setIsLookingUpProduct] = useState(false);
  const [isSavingScannedMeal, setIsSavingScannedMeal] = useState(false);
  const lastBarcodeScan = useRef<BarcodeScanStamp | null>(null);

  const userId = session?.user.id ?? null;
  const canUseRemote = remoteEnabled(userId);
  const today = dateKey(new Date().toISOString());
  const modeLabel = demoModeLabel(isSupabaseConfigured, Boolean(userId && userId !== 'demo-user'));
  const todayMeals = useMemo(() => meals.filter((meal) => dateKey(meal.logged_at) === today), [meals, today]);

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

  useEffect(() => {
    if (!canUseRemote || !userId) return;

    let isMounted = true;
    const nutritionClient = supabase as unknown as NutritionSupabaseClient;
    const foodClient = supabase as unknown as FoodPersonalizationSupabaseClient;

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

  function openScanner() {
    setScannerOpen(true);
    setCameraOpen(false);
    setScannerMessage('Scan a barcode or enter its numbers below.');
  }

  function closeScanner() {
    setScannerOpen(false);
    setCameraOpen(false);
    setIsLookingUpProduct(false);
  }

  async function handleStartCamera() {
    if (cameraPermission?.granted) {
      setScannerMessage('Center the product barcode inside the frame.');
      setCameraOpen(true);
      return;
    }

    const nextPermission = await requestCameraPermission();
    if (nextPermission.granted) {
      setScannerMessage('Center the product barcode inside the frame.');
      setCameraOpen(true);
    } else {
      setScannerMessage('Camera access is unavailable. Enter the barcode manually below.');
      setCameraOpen(false);
    }
  }

  async function handleProductLookup(value = barcodeInput) {
    setIsLookingUpProduct(true);
    setCameraOpen(false);
    setScannerProduct(null);
    setScannerMessage('Looking up available label data...');

    const result = await lookupOpenFoodFactsProduct(value);
    if (result.status === 'found') {
      setBarcodeInput(result.product.barcode);
      setScannerProduct(result.product);
      setScannerMealName(result.product.name);
      setScannerServingQuantity('1');
      setScannerMessage('Product found. Review the available label data before adding it.');
    } else {
      setScannerMessage(result.message);
    }

    setIsLookingUpProduct(false);
  }

  function handleBarcodeScanned(result: BarcodeScanningResult) {
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
      setActiveSegment('Today');
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
      setActiveSegment('Today');
    } catch {
      const localMeal = { ...meal, id: `local-meal-${Date.now()}` };
      if (!canUseRemote) {
        await appendLocalDemoMealLog(localMeal);
      }
      setMeals((current) => [localMeal, ...current]);
      setStatus('Meal saved locally. Remote sync can retry later.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveResponse() {
    setIsSaving(true);
    const response = responseLogFormToInput(responseForm);
    const nextMeals = applyResponseToMealLogs(meals, response);

    setMeals(nextMeals);

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

      setResponseForm(createEmptyResponseLogForm());
      setActiveSegment('Today');
    } catch {
      if (!canUseRemote) {
        await saveLocalDemoMealLogs(nextMeals);
      }
      setStatus('Response saved locally. Remote sync can retry later.');
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

  function renderScanner() {
    return (
      <View style={styles.stack}>
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
            onChangeText={setBarcodeInput}
            placeholder="012345678905"
            value={barcodeInput}
          />
          <PrimaryButton
            disabled={!barcodeInput.trim()}
            label="Look up product"
            loading={isLookingUpProduct}
            onPress={() => void handleProductLookup()}
          />
          <Text style={styles.scannerMessage}>{scannerMessage}</Text>
        </Card>

        {scannerProduct && productQuality ? (
          <Card style={styles.productCard}>
            <View style={styles.productHeader}>
              <View style={styles.productHeaderCopy}>
                <Text style={styles.eyebrow}>Product Snapshot</Text>
                <Text style={styles.productName}>{scannerProduct.name}</Text>
                <Text style={styles.productMeta}>
                  {[scannerProduct.brand, scannerProduct.serving_size ?? 'Serving size unavailable'].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.qualityScore}>
                <Text style={styles.qualityScoreValue}>{productQuality.score ?? '-'}</Text>
                <Text style={styles.qualityScoreLabel}>QUALITY</Text>
              </View>
            </View>

            <View style={styles.productMetrics}>
              <Metric label="Calories" value={formatProductAmount(scannerProduct.calories_per_serving)} tone={colors.accent} />
              <Metric label="Protein" value={formatProductAmount(scannerProduct.protein_g, 'g')} />
              <Metric label="Carbs" value={formatProductAmount(scannerProduct.carbs_g, 'g')} />
              <Metric label="Fat" value={formatProductAmount(scannerProduct.fat_g, 'g')} />
              <Metric label="Fiber" value={formatProductAmount(scannerProduct.fiber_g, 'g')} />
              <Metric label="Sugar" value={formatProductAmount(scannerProduct.sugar_g, 'g')} />
              <Metric label="Sodium" value={formatProductAmount(scannerProduct.sodium_mg, 'mg')} />
            </View>

            <View style={styles.qualityPanel}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Food Quality Signal</Text>
                <Text style={styles.qualityLabel}>{displayLabel(productQuality.label)}</Text>
              </View>
              <Text style={styles.body}>{productQuality.summary}</Text>
              {[...productQuality.positives, ...productQuality.considerations].slice(0, 5).map((item) => (
                <View key={item} style={styles.signalReasonRow}>
                  <View style={styles.signalReasonDot} />
                  <Text style={styles.signalReasonText}>{item}</Text>
                </View>
              ))}
              <Text style={styles.confidenceLine}>
                Based on available label data · {displayLabel(scannerProduct.provider)} · Confidence: {productQuality.confidence}
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Why this signal</Text>
            <View style={styles.reasonList}>
              {productQuality.reason_codes.slice(0, 5).map((reason) => (
                <View key={reason} style={styles.reasonPill}>
                  <Text style={styles.reasonText}>{displayLabel(reason)}</Text>
                </View>
              ))}
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
              label="Add to Meal"
              loading={isSavingScannedMeal}
              onPress={() => void handleSaveScannedMeal()}
            />
          </Card>
        ) : null}
      </View>
    );
  }

  function renderToday() {
    return (
      <View style={styles.stack}>
        <Card style={styles.heroCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.eyebrow}>Today</Text>
              <Text style={styles.heroTitle}>Today’s Fueling</Text>
            </View>
            <View style={styles.modePill}>
              <Text style={styles.modeText}>{modeLabel}</Text>
            </View>
          </View>
          <Text style={styles.body}>
            Healthi uses logged meals and responses to estimate how food is supporting your day.
          </Text>
          <View style={styles.metricGrid}>
            <Metric label="Meals" value={`${nutrientSummary.meal_count}`} tone={colors.accent} />
            <Metric label="Calories" value={formatAmount(nutrientSummary.calories)} />
            <Metric label="Protein" value={formatAmount(nutrientSummary.protein_g, 'g')} />
            <Metric label="Carbs" value={formatAmount(nutrientSummary.carbs_g, 'g')} />
            <Metric label="Fat" value={formatAmount(nutrientSummary.fat_g, 'g')} />
            <Metric label="Fiber" value={formatAmount(nutrientSummary.fiber_g, 'g')} />
          </View>
        </Card>

        <Card style={styles.scanActionCard}>
          <View style={styles.scannerIntroRow}>
            <View style={styles.scannerIcon}>
              <Ionicons color={colors.accent} name="barcode-outline" size={23} />
            </View>
            <View style={styles.scannerHeadingCopy}>
              <Text style={styles.cardTitle}>Scan packaged food</Text>
              <Text style={styles.body}>Pull available label data into today’s meal log.</Text>
            </View>
          </View>
          <PrimaryButton label="Scan Food" onPress={openScanner} />
          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveSegment('Log Meal')}
            style={({ pressed }) => [styles.inlineTextButton, pressed && styles.pressed]}
          >
            <Text style={styles.inlineTextButtonText}>Enter meal manually</Text>
          </Pressable>
        </Card>

        {nutrientSummary.meal_count === 0 ? (
          <Card>
            <Text style={styles.cardTitle}>Food response is still calibrating.</Text>
            <Text style={styles.body}>Log a meal to improve today’s fueling signal.</Text>
            <PrimaryButton label="Log a meal" onPress={() => setActiveSegment('Log Meal')} />
          </Card>
        ) : null}

        <Card>
          <Text style={styles.cardTitle}>Current signal</Text>
          <View style={styles.signalGrid}>
            <Metric label="Food quality" value={displayLabel(foodQuality.label)} tone={colors.accent} />
            <Metric label="Food response" value={displayLabel(foodResponse.label)} tone={colors.accentMid} />
            <Metric label="Readiness support" value={displayLabel(readinessSignal.label)} tone={colors.accentMid} />
            <Metric label="Source" value={confidenceText(readinessSignal.confidence)} tone={colors.textMuted} />
          </View>
          <Text style={styles.body}>{readinessSignal.summary}</Text>
        </Card>

        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Next action</Text>
            <Ionicons color={colors.accent} name="sparkles-outline" size={16} />
          </View>
          <Text style={styles.body}>
            {nutrientSummary.meal_count === 0
              ? 'Add one manual meal to begin today’s food response signal.'
              : foodResponse.label === 'unknown'
                ? 'Rate how you felt after eating to improve today’s estimate.'
                : 'Keep the next meal simple and steady based on available data.'}
          </Text>
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
            onPress={openScanner}
            style={({ pressed }) => [styles.scannerShortcut, pressed && styles.pressed]}
          >
            <Ionicons color={colors.accent} name="barcode-outline" size={20} />
            <Text style={styles.scannerShortcutText}>Scan Food</Text>
            <Ionicons color={colors.textFaint} name="chevron-forward" size={18} />
          </Pressable>
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

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView behavior={undefined} style={styles.safe}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.topBar}>
              <Text style={styles.pageEyebrow}>Food</Text>
              <Text style={styles.pageTitle}>Fueling</Text>
            </View>

            <View style={styles.segmentBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {segments.map((segment) => (
                  <Pressable
                    accessibilityRole="button"
                    key={segment}
                    onPress={() => {
                      closeScanner();
                      setActiveSegment(segment);
                    }}
                    style={[styles.segment, activeSegment === segment && styles.segmentActive]}
                  >
                    <Text style={[styles.segmentText, activeSegment === segment && styles.segmentTextActive]}>{segment}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.segmentBaseline} />
            </View>

            <View style={styles.statusLine}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{isLoadingRemote ? 'Loading available food data...' : status}</Text>
            </View>

            {scannerOpen ? renderScanner() : null}
            {!scannerOpen && activeSegment === 'Today' ? renderToday() : null}
            {!scannerOpen && activeSegment === 'Log Meal' ? renderLogMeal() : null}
            {!scannerOpen && activeSegment === 'Response Log' ? renderResponseLog() : null}
            {!scannerOpen && activeSegment === 'Food Pattern Test' ? renderPatternTest() : null}
            {!scannerOpen && activeSegment === 'Insights' ? renderInsights() : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  screen: {
    flex: 1,
    backgroundColor: C.bg
  },
  safe: {
    flex: 1
  },
  scroll: {
    paddingBottom: 118
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
    backgroundColor: 'rgba(28,84,67,0.08)',
    borderColor: 'rgba(28,84,67,0.24)',
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
    paddingHorizontal: 16
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
    backgroundColor: 'rgba(246,244,238,0.72)',
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
    color: palette.paper,
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
    backgroundColor: C.ink,
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
    color: palette.paper,
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
    fontSize: 10,
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
  productHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between'
  },
  productHeaderCopy: {
    flex: 1,
    minWidth: 0
  },
  productName: {
    ...themeType.heading,
    color: C.ink,
    fontFamily: serif,
    fontSize: 24,
    lineHeight: 30,
    marginTop: 7
  },
  productMeta: {
    ...themeType.caption,
    color: C.sub,
    marginTop: 5
  },
  qualityScore: {
    alignItems: 'center',
    backgroundColor: colors.accentWash,
    borderColor: palette.forestPale,
    borderRadius: 36,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    width: 72
  },
  qualityScoreValue: {
    color: colors.accent,
    fontFamily: sansMedium,
    fontSize: 23,
    lineHeight: 27
  },
  qualityScoreLabel: {
    color: C.muted,
    fontFamily: sansMedium,
    fontSize: 8,
    letterSpacing: 1,
    lineHeight: 10
  },
  productMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20
  },
  qualityPanel: {
    backgroundColor: palette.ivory,
    borderColor: C.hairline,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 18,
    marginTop: 18,
    padding: 15
  },
  qualityLabel: {
    color: colors.accent,
    fontFamily: sansMedium,
    fontSize: themeType.caption.fontSize,
    lineHeight: themeType.caption.lineHeight
  },
  signalReasonRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 9,
    marginTop: 10
  },
  signalReasonDot: {
    backgroundColor: colors.accentMid,
    borderRadius: 3,
    height: 5,
    marginTop: 8,
    width: 5
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
