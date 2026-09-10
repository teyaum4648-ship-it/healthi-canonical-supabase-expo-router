import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EntrySheet } from '../../components/mobile/EntrySheet';
import { ActionRow } from '../../components/mobile/ActionRow';
import { colors, type } from '../../styles/mobileTheme';
import type { NutritionTargets } from '../../engines/nutrition';
import { estimateNutritionGoals, metricGoalInputs, type GoalAnswers, type GoalSetup } from './nutritionGoalEngine';
import { readGoalSetup, saveGoalSetup, type GoalClient } from './nutritionGoalStore';

function Choices<T extends string>({ label, value, options, onChange }: { label: string; value: T | ''; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return <View style={s.group}><Text style={s.label}>{label}</Text>{options.map(([id, text]) => <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: value === id }} onPress={() => onChange(id)} style={[s.choice, value === id && s.selected]}><Text style={s.body}>{text}</Text></Pressable>)}</View>;
}
export function NutritionGoalSetup({ userId, demo, client, onTargets }: { userId: string | null; demo: boolean; client: GoalClient | null; onTargets: (targets: NutritionTargets) => void }) {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [setup, setSetup] = useState<GoalSetup | null>(null);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false), [step, setStep] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [age, setAge] = useState(''), [height, setHeight] = useState(''), [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<'metric' | 'imperial'>('imperial');
  const [equation, setEquation] = useState<GoalAnswers['equation'] | ''>('');
  const [activity, setActivity] = useState<GoalAnswers['activity'] | ''>('');
  const [goal, setGoal] = useState<GoalAnswers['goal'] | ''>('');
  const [guidance, setGuidance] = useState<GoalAnswers['needsGuidance'] | ''>('');
  const [preview, setPreview] = useState<GoalSetup | null>(null);
  useEffect(() => {
    let active = true; setLoading(true); setLoadError(''); setSetup(null); setOpen(false);
    readGoalSetup(userId, demo, client, AsyncStorage).then(saved => { if (active) { setSetup(saved); if (saved) onTargets(saved.targets); } }).catch(e => { if (active) setLoadError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, demo, client, reload, onTargets]);
  function begin() {
    const a = setup?.answers;
    setUnit('metric'); setAge(a ? String(a.age) : ''); setHeight(a ? String(a.heightCm) : ''); setWeight(a ? String(a.weightKg) : '');
    setEquation(a?.equation ?? ''); setActivity(a?.activity ?? ''); setGoal(a?.goal ?? ''); setGuidance(a?.needsGuidance ?? '');
    setStep(0); setPreview(null); setError(''); setOpen(true);
  }
  function next() {
    setError('');
    if (step === 0) { if (!age || !guidance) { setError('Enter your age and choose an answer.'); return; } setStep(1); return; }
    if (step === 1) {
      try {
        const answers = { age: Number(age), ...metricGoalInputs(height, weight, unit), equation, activity, goal, needsGuidance: guidance } as GoalAnswers;
        setPreview(estimateNutritionGoals(answers)); setStep(2);
      } catch(e) { setError(e instanceof Error ? e.message : 'Check your answers.'); }
    }
  }
  async function save() {
    if (!preview || busy) return;
    setBusy(true); setError('');
    try { const saved = await saveGoalSetup(preview.answers, userId, demo, client, AsyncStorage); if (mounted.current) { setSetup(saved); onTargets(saved.targets); setOpen(false); } }
    catch(e) { setError(e instanceof Error ? e.message : 'Could not save your goals.'); }
    finally { setBusy(false); }
  }
  return <>
    <View style={s.card}>{loading ? <ActivityIndicator accessibilityLabel="Loading nutrition goals" /> : loadError ? <ActionRow title="Goals could not load" detail={loadError} onPress={() => setReload(v => v + 1)} /> : <ActionRow title={setup ? setup.status === 'estimated' ? 'Your personalized goals' : 'Your nutrition setup' : 'Set up my goals'} detail={setup ? setup.status === 'estimated' ? 'Starting estimate · Update your answers anytime' : 'Setup saved · Guidance before numeric targets' : 'A one-time quiz for calorie and macro estimates'} icon="options-outline" onPress={begin} last />}</View>
    {open ? <EntrySheet title={step === 2 ? 'Your starting goals' : 'Make nutrition yours'} onClose={() => !busy && setOpen(false)} busy={busy} footer={<View style={s.group}>{error ? <Text accessibilityRole="alert" style={s.body}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={busy} style={s.primary} onPress={() => step === 2 ? void save() : next()}><Text style={s.primaryText}>{busy ? 'Saving…' : step === 2 ? 'Save my setup' : 'Continue'}</Text></Pressable>{step > 0 ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setStep(v => v - 1)} style={s.choice}><Text style={s.body}>Back</Text></Pressable> : null}</View>}>
      <Text style={s.muted}>Step {step + 1} of 3 · {demo ? 'Saved on this device in demo mode' : 'Saved privately to your account'}</Text>
      {step === 0 ? <>
        <Text style={s.heading}>A starting point, built around you.</Text><Text style={s.body}>Answer once. No daily quiz, and no need to guess your calories. You can keep logging without setting a target.</Text>
        <Text style={s.label}>Age in years</Text><TextInput accessibilityLabel="Age in years" keyboardType="number-pad" value={age} onChangeText={setAge} style={s.input} maxLength={3} />
        <Choices label="Would you benefit from professional help with nutrition targets? This includes pregnancy or breastfeeding, an eating-disorder history, or a condition or care plan that affects nutrition." value={guidance} options={[["no", "None of these apply"], ["yes", "Yes"], ["unsure", "Not sure / prefer guidance"]]} onChange={setGuidance} />
        <Text style={s.muted}>We do not generate automatic targets for under-18s or when these situations apply.</Text>
      </> : step === 1 ? <>
        <Choices label="Units" value={unit} options={[["metric", "Centimeters & kilograms"], ["imperial", "Total inches & pounds"]]} onChange={v => { if (v !== unit) { setHeight(''); setWeight(''); setUnit(v); } }} />
        <Text style={s.label}>Height ({unit === 'metric' ? 'cm' : 'total inches; e.g. 68 for 5′8″'})</Text><TextInput accessibilityLabel="Height" keyboardType="decimal-pad" value={height} onChangeText={setHeight} style={s.input} />
        <Text style={s.label}>Weight ({unit === 'metric' ? 'kg' : 'lb'})</Text><TextInput accessibilityLabel="Weight" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} style={s.input} />
        <Choices label="Which sex-based equation should we use? These are the two options supported by the resting-energy formula, not a question about gender identity." value={equation} options={[["female", "Female equation"], ["male", "Male equation"], ["unspecified", "Skip numerical estimate"]]} onChange={setEquation} />
        <Choices label="A usual week, including work and exercise" value={activity} options={[["seated", "Mostly seated · little exercise"], ["light", "Some walking · light exercise"], ["active", "Regular movement · moderate exercise"], ["very_active", "Physical work or frequent vigorous exercise"]]} onChange={setActivity} />
        <Choices label="Your current direction" value={goal} options={[["maintain", "Maintain and feel well-fueled"], ["lose", "Gradual weight loss"], ["gain", "Gradual weight gain"]]} onChange={setGoal} />
      </> : preview ? <>
        <Text style={s.heading}>{preview.status === 'estimated' ? `${preview.targets.calories_target?.toLocaleString()} kcal / day` : 'Get support with your targets'}</Text>
        {preview.status === 'estimated' ? <><Text style={s.body}>Protein {preview.targets.protein_g_target} g · Carbs {preview.targets.carbs_g_target} g · Fat {preview.targets.fat_g_target} g</Text><Text style={s.muted}>Illustrative estimate range: {preview.range?.[0]}–{preview.range?.[1]} kcal. This is not a measured confidence interval or an intake limit.</Text></> : null}
        <Text style={s.body}>{preview.explanation}</Text><Text style={s.muted}>General wellness guidance. Confidence: low until you have real-world context. This does not replace an existing care plan.</Text>
      </> : null}
    </EntrySheet> : null}
  </>;
}
const s = StyleSheet.create({ card: { backgroundColor: colors.surface, paddingHorizontal: 16, borderRadius: 20 }, group: { gap: 10 }, label: { ...type.label, color: colors.text }, body: { ...type.body, color: colors.text }, muted: { ...type.caption, color: colors.textMuted }, heading: { ...type.heading, color: colors.text }, choice: { minHeight: 48, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.borderStrong }, selected: { borderColor: colors.accentMid, backgroundColor: colors.surfaceInset }, input: { ...type.body, color: colors.text, backgroundColor: colors.surfaceInset, borderRadius: 12, minHeight: 52, padding: 14 }, primary: { minHeight: 52, padding: 14, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' }, primaryText: { ...type.label, color: colors.primaryText } });
