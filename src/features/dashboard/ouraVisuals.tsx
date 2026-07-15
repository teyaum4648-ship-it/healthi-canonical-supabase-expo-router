import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  RadialGradient,
  Stop,
  Text as SvgText
} from 'react-native-svg';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withTiming
} from 'react-native-reanimated';

export const ouraColors = {
  bg: '#06080C',
  ink: '#06080C',
  card: 'rgba(255,255,255,0.025)',
  cardBorder: 'rgba(255,255,255,0.06)',
  hairline: 'rgba(255,255,255,0.08)',
  track: 'rgba(255,255,255,0.08)',
  teal: '#5FD3C9',
  tealBright: '#7FE6DC',
  tealDim: '#3E9A93',
  blue: '#86B2FF',
  green: '#9CD485',
  warm: '#E8A47C',
  rose: '#E88AA6',
  violet: '#9A8CFF',
  text: '#F3F4F6',
  sub: '#A8AEB8',
  muted: '#6E747E',
  faint: '#565C66'
} as const;

export const ouraGradients = {
  nebula: ['#16243A', '#0E2230', '#06080C'] as const,
  check: ['#14202E', '#0A1018'] as const,
  clock: ['#0E2236', '#070D16'] as const,
  ring: ['#7FE6DC', '#5FD3C9', '#2E827C'] as const
};

export const ouraFonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  body: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'System' })
} as const;

export const ouraType = {
  hero: { fontFamily: ouraFonts.serif, fontSize: 64, lineHeight: 68 },
  display: { fontFamily: ouraFonts.serif, fontSize: 20, lineHeight: 25 },
  serifSm: { fontFamily: ouraFonts.serif, fontSize: 17, lineHeight: 21 },
  eyebrow: { fontFamily: ouraFonts.body, fontSize: 11, fontWeight: '600', letterSpacing: 2.5 },
  body: { fontFamily: ouraFonts.body, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: ouraFonts.body, fontSize: 12, lineHeight: 16 }
} as const satisfies Record<string, TextStyle>;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

let orbId = 0;

function readinessBand(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Optimal', color: ouraColors.teal };
  if (score >= 70) return { label: 'Good', color: ouraColors.teal };
  if (score >= 55) return { label: 'Fair', color: ouraColors.warm };
  return { label: 'Pay attention', color: ouraColors.warm };
}

export function OrbGlow({
  size,
  color,
  opacity = 1,
  style
}: {
  size: number;
  color: string;
  opacity?: number;
  style?: ViewStyle;
}) {
  const id = `healthi_orb_${orbId++}`;

  return (
    <View pointerEvents="none" style={[{ height: size, position: 'absolute', width: size }, style]}>
      <Svg height={size} width={size}>
        <Defs>
          <RadialGradient id={id} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.7" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} fill={`url(#${id})`} r={size / 2} />
      </Svg>
    </View>
  );
}

const stars = [
  { top: 36, left: 70, size: 2, opacity: 0.5 },
  { top: 54, left: 300, size: 1.5, opacity: 0.45 },
  { top: 92, left: 40, size: 2, opacity: 0.4 },
  { top: 120, left: 250, size: 1.5, opacity: 0.4 },
  { top: 150, left: 150, size: 1, opacity: 0.3 },
  { top: 80, left: 330, size: 1, opacity: 0.35 },
  { top: 200, left: 60, size: 1.5, opacity: 0.3 },
  { top: 170, left: 320, size: 1, opacity: 0.3 }
];

export function Starfield() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {stars.map((star, index) => (
        <View
          key={`${star.top}-${index}`}
          style={{
            backgroundColor: `rgba(255,255,255,${star.opacity})`,
            borderRadius: star.size,
            height: star.size,
            left: star.left,
            position: 'absolute',
            top: star.top,
            width: star.size
          }}
        />
      ))}
    </View>
  );
}

export function AnimatedReadinessRing({
  score,
  size = 212,
  delay = 200
}: {
  score: number;
  size?: number;
  delay?: number;
}) {
  const boundedScore = Math.max(0, Math.min(100, score));
  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  const pct = boundedScore / 100;
  const band = readinessBand(boundedScore);
  const progress = useSharedValue(0);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress]);

  useAnimatedReaction(
    () => progress.value,
    (value) => runOnJS(setDisplayScore)(Math.round(boundedScore * value)),
    [boundedScore]
  );

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - pct * progress.value)
  }));
  const tipProps = useAnimatedProps(() => {
    const angle = pct * 2 * Math.PI * progress.value;
    return {
      cx: 100 + radius * Math.sin(angle),
      cy: 100 - radius * Math.cos(angle),
      opacity: progress.value
    };
  });

  return (
    <View style={{ alignItems: 'center', height: size, justifyContent: 'center', width: size }}>
      <Svg height={size} viewBox="0 0 200 200" width={size}>
        <Defs>
          <SvgLinearGradient id="healthi_readiness" x1="0.1" x2="0.9" y1="0" y2="1">
            <Stop offset="0" stopColor={ouraGradients.ring[0]} />
            <Stop offset="0.55" stopColor={ouraGradients.ring[1]} />
            <Stop offset="1" stopColor={ouraGradients.ring[2]} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={100} cy={100} fill="none" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
        <AnimatedCircle
          animatedProps={arcProps}
          cx={100}
          cy={100}
          fill="none"
          r={radius}
          stroke="url(#healthi_readiness)"
          strokeDasharray={circumference}
          strokeLinecap="round"
          strokeWidth={6}
          transform="rotate(-90 100 100)"
        />
        <AnimatedCircle animatedProps={tipProps} fill="#CFF6F1" r={5} />
        <AnimatedCircle animatedProps={tipProps} fill="#FFFFFF" r={2} />
      </Svg>
      <View pointerEvents="none" style={{ alignItems: 'center', position: 'absolute' }}>
        <Text style={[ouraType.eyebrow, { color: ouraColors.tealDim, letterSpacing: 3 }]}>READINESS</Text>
        <Text style={[ouraType.hero, { color: ouraColors.text, marginTop: 2 }]}>{displayScore}</Text>
        <Text style={[ouraType.display, { color: band.color, marginTop: -2 }]}>{band.label}</Text>
      </View>
    </View>
  );
}

export function BodyClockArc({
  mid = 0.5,
  height = 120
}: {
  mid?: number;
  height?: number;
}) {
  const width = 320;
  const x0 = 16;
  const x1 = width - 16;
  const span = x1 - x0;
  const baseY = height - 34;
  const amp = 30;
  const bowY = (pos: number) => baseY - 4 * amp * pos * (1 - pos);
  const midX = x0 + mid * span;
  const midY = bowY(mid);
  const ticks = [
    { pos: 0, label: 'AM' },
    { pos: 0.25, label: '3 AM' },
    { pos: 0.5, label: '6 AM' },
    { pos: 0.75, label: '9 AM' },
    { pos: 1, label: '12 PM' }
  ];

  return (
    <Svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <SvgLinearGradient id="healthi_body_clock" x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0" stopColor={ouraColors.blue} />
          <Stop offset="1" stopColor="#5F7FD0" />
        </SvgLinearGradient>
      </Defs>
      <Path
        d={`M${x0} ${baseY} Q${(x0 + x1) / 2} ${baseY - amp - 14} ${x1} ${baseY}`}
        fill="none"
        stroke="rgba(134,178,255,0.18)"
        strokeWidth={2}
      />
      <Path
        d={`M${x0} ${baseY + 8} Q${(x0 + x1) / 2} ${baseY - amp - 2} ${x1} ${baseY + 8}`}
        fill="none"
        stroke="url(#healthi_body_clock)"
        strokeDasharray="2 7"
        strokeLinecap="round"
        strokeWidth={3}
      />
      <G>
        <Circle cx={midX} cy={midY - 11} fill={ouraColors.blue} r={3.5} />
        <Circle cx={midX} cy={midY + 2} fill="#FFFFFF" r={5} />
      </G>
      {ticks.map((tick) => (
        <SvgText
          fill={ouraColors.muted}
          fontFamily={ouraFonts.body}
          fontSize={10.5}
          key={tick.label}
          textAnchor={tick.pos < 0.12 ? 'start' : tick.pos > 0.88 ? 'end' : 'middle'}
          x={x0 + tick.pos * span}
          y={height - 6}
        >
          {tick.label}
        </SvgText>
      ))}
    </Svg>
  );
}

export function ScoreRing({
  value,
  label,
  pct,
  color,
  delay = 0
}: {
  value: string;
  label: string;
  pct: number;
  color: string;
  delay?: number;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const target = Math.max(0, Math.min(1, pct));
  const numeric = /^\d+$/.test(value);
  const progress = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(numeric ? '0' : value);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress]);

  useAnimatedReaction(
    () => progress.value,
    (animatedValue) => {
      if (numeric) {
        runOnJS(setDisplayValue)(String(Math.round(Number(value) * animatedValue)));
      }
    },
    [value]
  );

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - target * progress.value)
  }));

  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <View style={{ alignItems: 'center', height: 62, justifyContent: 'center', width: 62 }}>
        <Svg height={62} viewBox="0 0 60 60" width={62}>
          <Circle cx={30} cy={30} fill="none" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
          <AnimatedCircle
            animatedProps={arcProps}
            cx={30}
            cy={30}
            fill="none"
            r={radius}
            stroke={color}
            strokeDasharray={circumference}
            strokeLinecap="round"
            strokeWidth={5}
            transform="rotate(-90 30 30)"
          />
        </Svg>
        <View pointerEvents="none" style={{ position: 'absolute' }}>
          <Text style={[ouraType.serifSm, { color: ouraColors.text, fontSize: displayValue.length > 3 ? 14 : 17 }]}>
            {displayValue}
          </Text>
        </View>
      </View>
      <Text style={[ouraType.caption, { color: ouraColors.sub }]}>{label}</Text>
    </View>
  );
}

function smoothPath(points: { x: number; y: number }[], k = 0.2) {
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] ?? next;
    path += ` C ${(current.x + (next.x - previous.x) * k).toFixed(1)} ${(current.y + (next.y - previous.y) * k).toFixed(1)}, ${(next.x - (afterNext.x - current.x) * k).toFixed(1)} ${(next.y - (afterNext.y - current.y) * k).toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }

  return path;
}

export function StressSpark({
  values = [0.55, 0.5, 0.62, 0.58, 0.45, 0.5, 0.3, 0.18],
  height = 64,
  delay = 400
}: {
  values?: number[];
  height?: number;
  delay?: number;
}) {
  const width = 320;
  const padX = 4;
  const span = width - padX * 2;
  const points = values.map((value, index) => ({
    x: padX + (index / (values.length - 1)) * span,
    y: 8 + Math.max(0, Math.min(1, value)) * (height - 16)
  }));
  const end = points[points.length - 1];
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress]);

  const clipProps = useAnimatedProps(() => ({
    width: width * progress.value
  }));

  return (
    <Svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <SvgLinearGradient id="healthi_stress" x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0" stopColor={ouraColors.warm} />
          <Stop offset="0.5" stopColor="#D9C27A" />
          <Stop offset="1" stopColor={ouraColors.teal} />
        </SvgLinearGradient>
        <ClipPath id="healthi_stress_wipe">
          <AnimatedRect animatedProps={clipProps} height={height} width={0} x={0} y={0} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#healthi_stress_wipe)">
        <Path d={smoothPath(points)} fill="none" stroke="url(#healthi_stress)" strokeLinecap="round" strokeWidth={3} />
        <Circle cx={end.x} cy={end.y} fill={ouraColors.ink} r={4} stroke={ouraColors.teal} strokeWidth={2.5} />
      </G>
    </Svg>
  );
}
