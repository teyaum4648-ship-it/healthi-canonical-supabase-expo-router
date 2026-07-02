import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText
} from 'react-native-svg';

const T = {
  void: '#08060D',
  nebulaTop: '#191024',
  nebulaMid: '#100A19',
  gold: '#D9A954',
  goldBright: '#F3D492',
  goldDeep: '#7E5B24',
  lavender: '#B4A3F2',
  blue: '#8FB2EE',
  text: '#F4F1EB',
  sub: '#A79FB4',
  muted: '#6B6478',
  card: 'rgba(255,255,255,0.030)',
  hairline: 'rgba(255,255,255,0.055)',
  track: 'rgba(255,255,255,0.065)'
} as const;

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }) ?? 'serif';
const sans = Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'System' }) ?? 'System';

const type = {
  hero: { fontFamily: serif, fontSize: 66, lineHeight: 72, fontWeight: '300' },
  display: { fontFamily: serif, fontSize: 21, lineHeight: 27, fontWeight: '400' },
  eyebrow: { fontFamily: sans, fontSize: 10.5, fontWeight: '600', letterSpacing: 3 },
  body: { fontFamily: sans, fontSize: 13.5, lineHeight: 20, fontWeight: '400' }
} as const satisfies Record<string, TextStyle>;

const MOCK = {
  firstName: 'Tiam',
  dateLabel: 'Wednesday, July 1',
  readiness: {
    score: 87,
    summary: 'Recovery is trending up. Today can absorb a heavy session.'
  },
  heroStats: [
    { label: 'SLEEP', value: '7h 42m' },
    { label: 'RHYTHM', value: 'Aligned' },
    { label: 'HRV', value: '58 ms' }
  ],
  week: [
    { day: 'F', score: 78 },
    { day: 'S', score: 84 },
    { day: 'S', score: 71 },
    { day: 'M', score: 88 },
    { day: 'T', score: 90 },
    { day: 'T', score: 82 },
    { day: 'W', score: 87, today: true }
  ],
  signals: [
    { label: 'Sleep', value: '84', pct: 0.84, color: T.lavender },
    { label: 'Activity', value: '62', pct: 0.62, color: T.blue },
    { label: 'Stress', value: 'Low', pct: 0.28, color: T.gold }
  ],
  contributors: [
    { label: 'Resting heart rate', value: '54 bpm', status: 'Optimal', pct: 0.92 },
    { label: 'HRV balance', value: '58 ms', status: 'Good', pct: 0.78 },
    { label: 'Body temperature', value: '+0.2°', status: 'Steady', pct: 0.7 },
    { label: 'Recovery index', value: '-', status: 'Good', pct: 0.81 }
  ],
  fuel: {
    calories: { current: 1640, target: 2300 },
    macros: [
      { label: 'Protein', current: 142, target: 200, unit: 'g' },
      { label: 'Net carbs', current: 31, target: 50, unit: 'g' },
      { label: 'Fat', current: 118, target: 160, unit: 'g' }
    ],
    lastMeal: { name: 'Ribeye & eggs', time: '1:20 PM' }
  },
  sleepWindow: {
    start: '10:40 PM',
    end: '11:20 PM',
    startT: 0.33,
    endT: 0.42,
    caption: "Falling asleep inside this window keeps tomorrow's rhythm aligned."
  },
  guidance: {
    title: 'Load the morning.',
    body:
      'Your rhythm peaks before mid-afternoon. Place the hardest work, training or deep focus, inside that window, then let the evening stay quiet.'
  }
} as const;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function bandLabel(score: number): string {
  if (score >= 85) return 'Primed';
  if (score >= 70) return 'Steady';
  if (score >= 55) return 'Guarded';
  return 'Recover';
}

function useGradientId(prefix: string): string {
  return useMemo(() => `${prefix}_${Math.random().toString(36).slice(2)}`, [prefix]);
}

function Glow({ size, color, opacity = 1, style }: { size: number; color: string; opacity?: number; style?: ViewStyle }) {
  const id = useGradientId('healthi_glow');
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg height={size} width={size}>
        <Defs>
          <RadialGradient cx="0.5" cy="0.5" id={id} r="0.5">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.75" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} fill={`url(#${id})`} r={size / 2} />
      </Svg>
    </View>
  );
}

function Stars() {
  const stars = [
    { top: 42, left: 52, size: 2, opacity: 0.4 },
    { top: 70, left: 296, size: 1.5, opacity: 0.35 },
    { top: 118, left: 30, size: 1.5, opacity: 0.3 },
    { top: 96, left: 338, size: 1, opacity: 0.3 },
    { top: 176, left: 318, size: 1.5, opacity: 0.28 },
    { top: 210, left: 46, size: 1, opacity: 0.25 }
  ];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {stars.map((star, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            borderRadius: star.size,
            backgroundColor: `rgba(244,241,235,${star.opacity})`
          }}
        />
      ))}
    </View>
  );
}

function Eyebrow({ children, color = T.muted }: { children: ReactNode; color?: string }) {
  return <Text style={[type.eyebrow, { color, textTransform: 'uppercase' }]}>{children}</Text>;
}

function ReadinessRing({ score, size = 224, delay = 250 }: { score: number; size?: number; delay?: number }) {
  const gradId = useGradientId('healthi_gold_ring');
  const bounded = Math.max(0, Math.min(100, score));
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const pct = bounded / 100;
  const progress = useSharedValue(0);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress]);

  useAnimatedReaction(
    () => progress.value,
    (value) => runOnJS(setDisplayScore)(Math.round(bounded * value)),
    [bounded]
  );

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - pct * progress.value)
  }));

  const tipProps = useAnimatedProps(() => {
    const angle = pct * 2 * Math.PI * progress.value;
    return {
      cx: 110 + radius * Math.sin(angle),
      cy: 110 - radius * Math.cos(angle),
      opacity: progress.value
    };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg height={size} viewBox="0 0 220 220" width={size}>
        <Defs>
          <SvgLinearGradient id={gradId} x1="0.15" x2="0.85" y1="0" y2="1">
            <Stop offset="0" stopColor={T.goldBright} />
            <Stop offset="0.55" stopColor={T.gold} />
            <Stop offset="1" stopColor={T.goldDeep} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={110} cy={110} fill="none" r={radius} stroke={T.track} strokeWidth={5} />
        <AnimatedCircle
          animatedProps={arcProps}
          cx={110}
          cy={110}
          fill="none"
          origin="110, 110"
          r={radius}
          rotation={-90}
          stroke={`url(#${gradId})`}
          strokeDasharray={circumference}
          strokeLinecap="round"
          strokeWidth={5}
        />
        <AnimatedCircle animatedProps={tipProps} fill={T.goldBright} opacity={0.5} r={6} />
        <AnimatedCircle animatedProps={tipProps} fill="#FFF7E3" r={2.5} />
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center' }}>
        <Eyebrow color={T.goldDeep}>Readiness</Eyebrow>
        <Text style={[type.hero, { color: T.text, marginTop: 2 }]}>{displayScore}</Text>
        <Text style={[type.display, { color: T.gold, marginTop: -4 }]}>{bandLabel(bounded)}</Text>
      </View>
    </View>
  );
}

function Hero() {
  return (
    <View style={s.hero}>
      <LinearGradient colors={[T.nebulaTop, T.nebulaMid, T.void]} style={StyleSheet.absoluteFill} />
      <Stars />
      <Glow color={T.lavender} opacity={0.13} size={320} style={{ top: -130, left: -110 }} />
      <Glow color={T.gold} opacity={0.16} size={380} style={{ bottom: -230, alignSelf: 'center' }} />

      <View style={s.heroHeader}>
        <View style={{ gap: 6 }}>
          <Eyebrow>{MOCK.dateLabel}</Eyebrow>
          <Text style={[type.display, { color: T.text, fontSize: 24 }]}>Good morning, {MOCK.firstName}</Text>
        </View>
        <Pressable accessibilityRole="button" style={({ pressed }) => [s.iconButton, pressed && { opacity: 0.6 }]}>
          <Ionicons color={T.sub} name="notifications-outline" size={18} />
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', marginTop: 18 }}>
        <ReadinessRing score={MOCK.readiness.score} />
        <Text style={[type.body, s.heroSummary]}>{MOCK.readiness.summary}</Text>
      </View>

      <View style={s.heroStats}>
        {MOCK.heroStats.map((stat, index) => (
          <View key={stat.label} style={s.heroStat}>
            {index > 0 ? <View style={s.heroStatDivider} /> : null}
            <View style={{ alignItems: 'center', gap: 5, flex: 1 }}>
              <Eyebrow>{stat.label}</Eyebrow>
              <Text style={[type.display, { color: T.text, fontSize: 17 }]}>{stat.value}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function MiniRing({ score, active }: { score: number; active?: boolean }) {
  const radius = 12.5;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, score / 100));
  const stroke = active ? T.gold : 'rgba(180,163,242,0.38)';

  return (
    <Svg height={34} viewBox="0 0 34 34" width={34}>
      <Circle cx={17} cy={17} fill="none" r={radius} stroke={T.track} strokeWidth={2.5} />
      <Circle
        cx={17}
        cy={17}
        fill="none"
        origin="17, 17"
        r={radius}
        rotation={-90}
        stroke={stroke}
        strokeDasharray={`${circumference * pct} ${circumference}`}
        strokeLinecap="round"
        strokeWidth={2.5}
      />
    </Svg>
  );
}

function WeekStrip() {
  return (
    <View style={s.weekStrip}>
      {MOCK.week.map((entry, index) => (
        <View key={index} style={{ alignItems: 'center', gap: 7 }}>
          <MiniRing active={'today' in entry && entry.today} score={entry.score} />
          <Text
            style={[
              type.eyebrow,
              { color: 'today' in entry && entry.today ? T.gold : T.muted, letterSpacing: 1 }
            ]}
          >
            {entry.day}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SignalRing({
  label,
  value,
  pct,
  color,
  delay = 0
}: {
  label: string;
  value: string;
  pct: number;
  color: string;
  delay?: number;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const target = Math.max(0, Math.min(1, pct));
  const numeric = /^\d+$/.test(value);
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(numeric ? '0' : value);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress]);

  useAnimatedReaction(
    () => progress.value,
    (animated) => {
      if (numeric) runOnJS(setDisplay)(String(Math.round(Number(value) * animated)));
    },
    [numeric, value]
  );

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - target * progress.value)
  }));

  return (
    <View style={{ alignItems: 'center', gap: 10, flex: 1 }}>
      <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
        <Svg height={64} viewBox="0 0 64 64" width={64}>
          <Circle cx={32} cy={32} fill="none" r={radius} stroke={T.track} strokeWidth={4.5} />
          <AnimatedCircle
            animatedProps={arcProps}
            cx={32}
            cy={32}
            fill="none"
            origin="32, 32"
            r={radius}
            rotation={-90}
            stroke={color}
            strokeDasharray={circumference}
            strokeLinecap="round"
            strokeWidth={4.5}
          />
        </Svg>
        <View pointerEvents="none" style={{ position: 'absolute' }}>
          <Text style={[type.display, { color: T.text, fontSize: 17 }]}>{display}</Text>
        </View>
      </View>
      <Text style={[type.body, { color: T.sub, fontSize: 12.5 }]}>{label}</Text>
    </View>
  );
}

function SignalsRow() {
  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row' }}>
        {MOCK.signals.map((signal, index) => (
          <SignalRing key={signal.label} {...signal} delay={450 + index * 140} />
        ))}
      </View>
    </View>
  );
}

function ContributorRow({ label, value, status, pct }: { label: string; value: string; status: string; pct: number }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={s.rowBetween}>
        <Text style={[type.body, { color: T.text }]}>{label}</Text>
        <Text style={[type.body, { color: T.sub, fontSize: 12.5 }]}>
          {value === '-' ? status : `${value}  ·  ${status}`}
        </Text>
      </View>
      <View style={s.barTrack}>
        <LinearGradient
          colors={[T.lavender, T.blue]}
          end={{ x: 1, y: 0 }}
          start={{ x: 0, y: 0 }}
          style={{ width: `${Math.round(pct * 100)}%`, height: '100%', borderRadius: 2 }}
        />
      </View>
    </View>
  );
}

function Contributors() {
  return (
    <View style={[s.card, { gap: 18 }]}>
      {MOCK.contributors.map((row) => (
        <ContributorRow key={row.label} {...row} />
      ))}
    </View>
  );
}

function CalorieRing({ remaining, pct, delay = 650 }: { remaining: number; pct: number; delay?: number }) {
  const gradId = useGradientId('healthi_fuel_ring');
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const target = Math.max(0, Math.min(1, pct));
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress]);

  useAnimatedReaction(
    () => progress.value,
    (value) => runOnJS(setDisplay)(Math.round(remaining * value)),
    [remaining]
  );

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - target * progress.value)
  }));

  return (
    <View style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
      <Svg height={92} viewBox="0 0 92 92" width={92}>
        <Defs>
          <SvgLinearGradient id={gradId} x1="0.15" x2="0.85" y1="0" y2="1">
            <Stop offset="0" stopColor={T.goldBright} />
            <Stop offset="0.55" stopColor={T.gold} />
            <Stop offset="1" stopColor={T.goldDeep} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={46} cy={46} fill="none" r={radius} stroke={T.track} strokeWidth={5} />
        <AnimatedCircle
          animatedProps={arcProps}
          cx={46}
          cy={46}
          fill="none"
          origin="46, 46"
          r={radius}
          rotation={-90}
          stroke={`url(#${gradId})`}
          strokeDasharray={circumference}
          strokeLinecap="round"
          strokeWidth={5}
        />
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={[type.display, { color: T.text, fontSize: 21 }]}>{display}</Text>
        <Text style={[type.eyebrow, { color: T.muted, fontSize: 8.5, letterSpacing: 1.5 }]}>KCAL LEFT</Text>
      </View>
    </View>
  );
}

function MacroBar({
  label,
  current,
  target,
  unit
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
}) {
  const pct = Math.max(0, Math.min(1, target > 0 ? current / target : 0));

  return (
    <View style={{ gap: 7 }}>
      <View style={s.rowBetween}>
        <Text style={[type.body, { color: T.text, fontSize: 12.5 }]}>{label}</Text>
        <Text style={[type.body, { color: T.sub, fontSize: 12 }]}>
          {current} / {target} {unit}
        </Text>
      </View>
      <View style={s.barTrack}>
        <LinearGradient
          colors={[T.lavender, T.blue]}
          end={{ x: 1, y: 0 }}
          start={{ x: 0, y: 0 }}
          style={{ width: `${Math.round(pct * 100)}%`, height: '100%', borderRadius: 2 }}
        />
      </View>
    </View>
  );
}

function Fuel() {
  const { calories, macros, lastMeal } = MOCK.fuel;
  const remaining = Math.max(0, calories.target - calories.current);

  return (
    <View style={[s.card, { gap: 18 }]}>
      <View style={s.rowBetween}>
        <Text style={[type.display, { color: T.text, fontSize: 19 }]}>Fuel today</Text>
        <Pressable accessibilityRole="button" style={({ pressed }) => [s.ghostButtonSm, pressed && { opacity: 0.65 }]}>
          <Ionicons color={T.gold} name="add" size={14} />
          <Text style={[type.body, { color: T.gold, fontSize: 12.5 }]}>Log meal</Text>
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 22 }}>
        <CalorieRing pct={calories.current / calories.target} remaining={remaining} />
        <View style={{ flex: 1, gap: 13 }}>
          {macros.map((macro) => (
            <MacroBar key={macro.label} {...macro} />
          ))}
        </View>
      </View>
      <View style={s.fuelFooter}>
        <Text style={[type.body, { color: T.muted, fontSize: 12.5 }]}>
          Last logged - {lastMeal.name} - {lastMeal.time}
        </Text>
      </View>
    </View>
  );
}

function nightArcPoints(width: number, baseY: number, lift: number, samples = 48) {
  const x0 = 18;
  const x1 = width - 18;
  const cx = (x0 + x1) / 2;
  const cy = baseY - lift;
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const mt = 1 - t;
    points.push({
      x: mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
      y: mt * mt * baseY + 2 * mt * t * cy + t * t * baseY
    });
  }
  return points;
}

function pathFrom(points: { x: number; y: number }[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function NightArc() {
  const gradId = useGradientId('healthi_window');
  const width = 320;
  const height = 118;
  const baseY = height - 30;
  const points = nightArcPoints(width, baseY, 62);
  const { startT, endT } = MOCK.sleepWindow;
  const from = Math.round(startT * (points.length - 1));
  const to = Math.round(endT * (points.length - 1));
  const windowPoints = points.slice(from, to + 1);
  const midPoint = windowPoints[Math.floor(windowPoints.length / 2)];
  const ticks = [
    { t: 0, label: '8 PM' },
    { t: 0.5, label: '12 AM' },
    { t: 1, label: '4 AM' }
  ];

  return (
    <Svg viewBox={`0 0 ${width} ${height}`} width="100%">
      <Defs>
        <SvgLinearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0" stopColor={T.lavender} />
          <Stop offset="1" stopColor={T.blue} />
        </SvgLinearGradient>
      </Defs>
      <Path
        d={pathFrom(points)}
        fill="none"
        stroke="rgba(180,163,242,0.20)"
        strokeDasharray="1 6"
        strokeLinecap="round"
        strokeWidth={2.5}
      />
      <Path d={pathFrom(windowPoints)} fill="none" stroke={`url(#${gradId})`} strokeLinecap="round" strokeWidth={4} />
      <Circle cx={midPoint.x} cy={midPoint.y} fill={T.lavender} opacity={0.28} r={9} />
      <Circle cx={midPoint.x} cy={midPoint.y} fill="#F1ECFF" r={3.5} />
      {ticks.map((tick) => (
        <SvgText
          fill={T.muted}
          fontFamily={sans}
          fontSize={10.5}
          key={tick.label}
          textAnchor={tick.t === 0 ? 'start' : tick.t === 1 ? 'end' : 'middle'}
          x={18 + tick.t * (width - 36)}
          y={height - 6}
        >
          {tick.label}
        </SvgText>
      ))}
    </Svg>
  );
}

function Tonight() {
  return (
    <View style={[s.card, { gap: 14 }]}>
      <View style={s.rowBetween}>
        <Text style={[type.display, { color: T.text, fontSize: 19 }]}>Sleep window</Text>
        <Text style={[type.body, { color: T.lavender, fontSize: 13 }]}>
          {MOCK.sleepWindow.start} - {MOCK.sleepWindow.end}
        </Text>
      </View>
      <NightArc />
      <Text style={[type.body, { color: T.sub }]}>{MOCK.sleepWindow.caption}</Text>
    </View>
  );
}

function Guidance() {
  return (
    <View style={s.guidance}>
      <LinearGradient colors={['#1B1128', '#0C0814']} style={StyleSheet.absoluteFill} />
      <Glow color={T.gold} opacity={0.14} size={220} style={{ top: -80, right: -70 }} />
      <View style={{ gap: 10 }}>
        <Eyebrow color={T.goldDeep}>Today's guidance</Eyebrow>
        <Text style={[type.display, { color: T.text, fontSize: 23 }]}>{MOCK.guidance.title}</Text>
        <Text style={[type.body, { color: T.sub }]}>{MOCK.guidance.body}</Text>
      </View>
      <Pressable accessibilityRole="button" style={({ pressed }) => [s.ghostButton, pressed && { opacity: 0.65 }]}>
        <Text style={[type.body, { color: T.gold, fontSize: 14 }]}>Plan the morning</Text>
        <Ionicons color={T.gold} name="arrow-forward" size={15} />
      </Pressable>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ paddingHorizontal: 4 }}>
        <Eyebrow>{title}</Eyebrow>
      </View>
      {children}
    </View>
  );
}

export default function DashboardScreen() {
  return (
    <View style={s.screen}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Hero />
          <View style={s.body}>
            <WeekStrip />
            <Section title="Signals">
              <SignalsRow />
            </Section>
            <Section title="Contributors">
              <Contributors />
            </Section>
            <Section title="Fuel">
              <Fuel />
            </Section>
            <Section title="Tonight">
              <Tonight />
            </Section>
            <Guidance />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { backgroundColor: T.void, flex: 1 },
  scroll: { paddingBottom: 110 },
  hero: {
    borderBottomColor: T.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingBottom: 26,
    paddingHorizontal: 22,
    paddingTop: 10
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  iconButton: {
    alignItems: 'center',
    borderColor: T.hairline,
    borderRadius: 20,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  heroSummary: {
    color: T.sub,
    marginTop: 14,
    maxWidth: 270,
    textAlign: 'center'
  },
  heroStats: {
    flexDirection: 'row',
    marginTop: 26
  },
  heroStat: { flex: 1, flexDirection: 'row' },
  heroStatDivider: {
    alignSelf: 'center',
    backgroundColor: T.hairline,
    height: 26,
    width: StyleSheet.hairlineWidth
  },
  body: { gap: 26, paddingHorizontal: 20, paddingTop: 22 },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8
  },
  card: {
    backgroundColor: T.card,
    borderColor: T.hairline,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  barTrack: {
    backgroundColor: T.track,
    borderRadius: 2,
    height: 3,
    overflow: 'hidden'
  },
  guidance: {
    borderColor: T.hairline,
    borderRadius: 24,
    borderWidth: 1,
    gap: 18,
    overflow: 'hidden',
    padding: 22
  },
  ghostButtonSm: {
    alignItems: 'center',
    borderColor: 'rgba(217,169,84,0.35)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  fuelFooter: {
    borderTopColor: T.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 13
  },
  ghostButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: 'rgba(217,169,84,0.35)',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10
  }
});
