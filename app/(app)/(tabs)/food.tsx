import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
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
  type NutritionTargets
} from '../../../src/engines/nutrition';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import {
  getActiveFoodPatternProfile,
  getRecentPostMealResponseLogs,
  replaceActiveFoodPatternProfile,
  savePostMealResponseLog,
  type FoodPersonalizationSupabaseClient,
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
  getActiveNutritionTarget,
  getMealLogsForDate,
  saveMealLog,
  type MealLogRow,
  type NutritionSupabaseClient,
  type NutritionTargetRow
} from '../../../src/features/nutrition/persistence';
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
        setMeals((current) => [localMeal, ...current]);
        setResponseForm((current) => ({ ...current, meal_log_id: localMeal.id ?? null }));
        setStatus('Meal logged locally. Food response is still calibrating.');
      }

      setMealForm(createEmptyManualMealForm());
      setActiveSegment('Today');
    } catch {
      const localMeal = { ...meal, id: `local-meal-${Date.now()}` };
      setMeals((current) => [localMeal, ...current]);
      setStatus('Meal saved locally. Remote sync can retry later.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveResponse() {
    setIsSaving(true);
    const response = responseLogFormToInput(responseForm);

    setMeals((current) =>
      current.map((meal) =>
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
      )
    );

    try {
      if (canUseRemote && userId) {
        const saved = await savePostMealResponseLog(supabase as unknown as FoodPersonalizationSupabaseClient, userId, response);
        setResponses((current) => [saved, ...current]);
        setStatus('Response logged. Healthi has one more food response signal.');
      } else {
        setStatus('Response logged locally. Insights will sharpen as you add more.');
      }

      setResponseForm(createEmptyResponseLogForm());
      setActiveSegment('Today');
    } catch {
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

    if (!canUseRemote || !userId) return;

    try {
      const saved = await replaceActiveFoodPatternProfile(supabase as unknown as FoodPersonalizationSupabaseClient, userId, profile);
      setActiveProfile(profileRowToProfile(saved));
      setStatus('Your Food Pattern Profile was saved.');
    } catch {
      setStatus('Food Pattern Profile saved locally. Remote sync can retry later.');
    }
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
          body="Manual entry keeps the first version simple. Scanner and photo input can come later."
          eyebrow="Manual"
          title="Log a meal"
        />
        <Card>
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
                    onPress={() => setActiveSegment(segment)}
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

            {activeSegment === 'Today' ? renderToday() : null}
            {activeSegment === 'Log Meal' ? renderLogMeal() : null}
            {activeSegment === 'Response Log' ? renderResponseLog() : null}
            {activeSegment === 'Food Pattern Test' ? renderPatternTest() : null}
            {activeSegment === 'Insights' ? renderInsights() : null}
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
  }
});
