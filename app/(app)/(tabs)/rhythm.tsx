import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  calculateSleepDuration,
  generateCircadianBriefing,
  type CircadianBriefing,
  type CircadianEnergyPoint,
  type SleepNeedEstimate,
  type SleepSession,
  type TimeWindow
} from '../../../src/engines/circadian';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import {
  getActiveSleepNeedEstimate,
  getRecentSleepSessions,
  saveSleepSession,
  type SleepRhythmSupabaseClient
} from '../../../src/features/sleepRhythm/persistence';
import {
  createDefaultSleepNeedEstimate,
  createDemoSleepSessions,
  createManualSleepSession,
  getConfidenceLabel,
  getSleepSourceLabel
} from '../../../src/features/sleepRhythm/rhythmInputs';
import { supabase } from '../../../src/lib/supabase';
import { fonts } from '../../../src/styles/theme';

const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

type RhythmDataMode = 'manual' | 'persisted' | 'demo';

const winnerPalette = {
  blue: '#5B7FFF',
  green: '#4FC98A',
  gold: '#F0B429',
  violet: '#8BA5FF',
  silver: '#D8DEE8',
  text: '#E8EAF2'
};

interface SkyConfig {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  horizon: string;
  bodyColor: string;
  bodyX: number;
  bodyY: number;
  isMoon: boolean;
  starOpacity: number;
  accentColor: string;
  periodLabel: string;
  glowColor: string;
  cloudColor: string;
  cloudShadow: string;
  hazeColor: string;
}

const stars = [
  { cx: 108, cy: 64, r: 1.8, opacity: 0.75 },
  { cx: 174, cy: 108, r: 1.2, opacity: 0.62 },
  { cx: 246, cy: 50, r: 1.4, opacity: 0.72 },
  { cx: 330, cy: 86, r: 1.8, opacity: 0.58 },
  { cx: 450, cy: 42, r: 1.2, opacity: 0.65 },
  { cx: 566, cy: 94, r: 1.5, opacity: 0.68 },
  { cx: 672, cy: 58, r: 1.1, opacity: 0.58 },
  { cx: 766, cy: 118, r: 1.6, opacity: 0.72 },
  { cx: 822, cy: 48, r: 1.1, opacity: 0.54 },
  { cx: 62, cy: 142, r: 1.1, opacity: 0.52 },
  { cx: 268, cy: 150, r: 1.1, opacity: 0.55 },
  { cx: 610, cy: 146, r: 1.2, opacity: 0.56 },
  { cx: 720, cy: 184, r: 1.2, opacity: 0.5 },
  { cx: 402, cy: 190, r: 1.1, opacity: 0.48 },
  { cx: 822, cy: 212, r: 1.4, opacity: 0.54 },
  { cx: 138, cy: 204, r: 1.1, opacity: 0.5 },
  { cx: 520, cy: 222, r: 1.2, opacity: 0.46 }
] as const;

function getDayOrbit(hour: number): { bodyX: number; bodyY: number } {
  const t = Math.max(0, Math.min(1, (hour - 5) / 16));
  return {
    bodyX: lerp(92, 808, t),
    bodyY: 0.78 - Math.sin(Math.PI * t) * 0.66
  };
}

function getNightOrbit(hour: number): { bodyX: number; bodyY: number } {
  const nightHour = hour >= 21 ? hour - 21 : hour + 3;
  const t = Math.max(0, Math.min(1, nightHour / 8));
  return {
    bodyX: lerp(98, 808, t),
    bodyY: 0.52 - Math.sin(Math.PI * t) * 0.34
  };
}

function getSkyConfig(hour: number): SkyConfig {
  if (hour >= 5 && hour < 7) {
    const t = (hour - 5) / 2;
    return {
      skyTop: lerpHex('#141031', '#24385C', t),
      skyMid: lerpHex('#392357', '#7F6A9E', t),
      skyBottom: lerpHex('#B66A45', '#E3A55D', t),
      horizon: lerpHex('#2B173D', '#9C7EB2', t),
      bodyColor: lerpHex('#F6C35E', '#FFE88C', t),
      ...getDayOrbit(hour),
      isMoon: false,
      starOpacity: lerp(0.5, 0.02, t),
      accentColor: winnerPalette.gold,
      periodLabel: 'Dawn',
      glowColor: `rgba(255, 202, 116, ${0.24 + 0.16 * t})`,
      cloudColor: 'rgba(255, 224, 179, 0.36)',
      cloudShadow: 'rgba(97, 60, 97, 0.24)',
      hazeColor: 'rgba(255, 166, 102, 0.28)'
    };
  }

  if (hour >= 7 && hour < 11) {
    const t = (hour - 7) / 4;
    return {
      skyTop: lerpHex('#1A1040', '#08224F', t),
      skyMid: lerpHex('#4F4E94', '#2D72B8', t),
      skyBottom: lerpHex('#C26B2A', '#74B8DF', t),
      horizon: lerpHex('#594D96', '#9DDBF4', t),
      bodyColor: lerpHex('#FFE066', '#FFFDE8', t),
      ...getDayOrbit(hour),
      isMoon: false,
      starOpacity: 0,
      accentColor: winnerPalette.green,
      periodLabel: 'Morning',
      glowColor: 'rgba(255, 240, 180, 0.34)',
      cloudColor: 'rgba(255, 255, 255, 0.36)',
      cloudShadow: 'rgba(59, 102, 159, 0.22)',
      hazeColor: 'rgba(105, 192, 227, 0.2)'
    };
  }

  if (hour >= 11 && hour < 15) {
    return {
      skyTop: '#071220',
      skyMid: '#0E3B68',
      skyBottom: '#48A8D8',
      horizon: '#ACE4F8',
      bodyColor: '#FFFDE8',
      ...getDayOrbit(hour),
      isMoon: false,
      starOpacity: 0,
      accentColor: '#79C6F2',
      periodLabel: 'Midday',
      glowColor: 'rgba(255, 248, 200, 0.44)',
      cloudColor: 'rgba(255, 255, 255, 0.34)',
      cloudShadow: 'rgba(38, 91, 135, 0.24)',
      hazeColor: 'rgba(104, 190, 230, 0.18)'
    };
  }

  if (hour >= 15 && hour < 19) {
    const t = (hour - 15) / 4;
    return {
      skyTop: lerpHex('#071220', '#160923', t),
      skyMid: lerpHex('#174579', '#54305A', t),
      skyBottom: lerpHex('#2E83BA', '#A35028', t),
      horizon: lerpHex('#7BCDEB', '#E28B4F', t),
      bodyColor: lerpHex('#FFFDE8', '#FFB052', t),
      ...getDayOrbit(hour),
      isMoon: false,
      starOpacity: lerp(0, 0.32, t),
      accentColor: winnerPalette.gold,
      periodLabel: 'Afternoon',
      glowColor: `rgba(255, 160, 82, ${0.28 + 0.18 * t})`,
      cloudColor: `rgba(255, 231, 199, ${0.3 + 0.1 * t})`,
      cloudShadow: 'rgba(73, 46, 83, 0.26)',
      hazeColor: `rgba(255, 133, 78, ${0.12 + 0.16 * t})`
    };
  }

  if (hour >= 19 && hour < 21) {
    const t = (hour - 19) / 2;
    return {
      skyTop: lerpHex('#160923', '#050716', t),
      skyMid: lerpHex('#54305A', '#151B42', t),
      skyBottom: lerpHex('#A35028', '#15102B', t),
      horizon: lerpHex('#E28B4F', '#40325E', t),
      bodyColor: lerpHex('#FFB052', '#D0D8FF', t),
      ...(t > 0.5 ? getNightOrbit(hour) : getDayOrbit(hour)),
      isMoon: t > 0.5,
      starOpacity: lerp(0.36, 0.92, t),
      accentColor: winnerPalette.violet,
      periodLabel: 'Dusk',
      glowColor: `rgba(180, 180, 255, ${0.12 + 0.14 * t})`,
      cloudColor: 'rgba(206, 216, 255, 0.22)',
      cloudShadow: 'rgba(9, 11, 27, 0.4)',
      hazeColor: 'rgba(160, 88, 134, 0.2)'
    };
  }

  return {
    skyTop: '#04060E',
    skyMid: '#07112E',
    skyBottom: '#090B1E',
    horizon: '#192454',
    bodyColor: '#D0D8FF',
    ...getNightOrbit(hour),
    isMoon: true,
    starOpacity: 1,
    accentColor: winnerPalette.violet,
    periodLabel: 'Night',
    glowColor: 'rgba(160, 175, 255, 0.2)',
    cloudColor: 'rgba(170, 188, 255, 0.13)',
    cloudShadow: 'rgba(0, 0, 0, 0.28)',
    hazeColor: 'rgba(88, 112, 210, 0.12)'
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function lerpHex(c1: string, c2: string, t: number): string {
  const p1 = parseHex(c1);
  const p2 = parseHex(c2);
  const r = Math.round(lerp(p1[0], p2[0], t));
  const g = Math.round(lerp(p1[1], p2[1], t));
  const b = Math.round(lerp(p1[2], p2[2], t));
  return `rgb(${r}, ${g}, ${b})`;
}

function parseHex(h: string): [number, number, number] {
  const hex = h.replace('#', '');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function formatTime(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const hour12 = hours % 12 || 12;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'N/A';
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatDebt(minutes: number | null): string {
  if (minutes === null) return 'Calibrating';
  if (minutes === 0) return 'No debt';
  return formatDuration(minutes);
}

function formatWindow(window: TimeWindow | undefined): string {
  if (!window) return 'N/A';
  return `${formatTime(window.start_at)} - ${formatTime(window.end_at)}`;
}

function phaseLabel(label: string): string {
  const labels: Record<string, string> = {
    wake_grogginess: 'Wake Ramp',
    rising: 'Rising Energy',
    morning_peak: 'Morning Peak',
    afternoon_dip: 'Recovery Dip',
    second_peak: 'Second Peak',
    wind_down: 'Wind-Down',
    sleep_window: 'Sleep Window',
    unknown: 'Calibrating'
  };
  return labels[label] ?? label.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function getRhythmLead(briefing: CircadianBriefing): string {
  const window = briefing.rhythm_plan.deep_work_windows[0];
  if (!window) return 'Rhythm estimate is still calibrating.';
  return `Deep focus peaks around ${formatWindow(window)}.`;
}

function getLatestSleepDuration(session: SleepSession | undefined): number | null {
  if (!session) return null;
  if (typeof session.duration_minutes === 'number') return session.duration_minutes;
  return calculateSleepDuration(session.sleep_start_at, session.sleep_end_at);
}

function skyImageUri(skyConfig: SkyConfig): string {
  const bodyCx = skyConfig.bodyX;
  const bodyCy = 52 + skyConfig.bodyY * 280;
  const bodyR = skyConfig.isMoon ? 27 : 34;
  const starMarkup = stars
    .map((star) => (
      `<circle cx="${star.cx}" cy="${star.cy}" r="${star.r}" fill="#F7FAFF" opacity="${(star.opacity * skyConfig.starOpacity).toFixed(2)}" />`
    ))
    .join('');
  const moonCut = skyConfig.isMoon
    ? `<circle cx="${bodyCx + 13}" cy="${bodyCy - 7}" r="${bodyR * 0.96}" fill="${skyConfig.skyTop}" opacity="0.92" />`
    : '';
  const sunFlare = skyConfig.isMoon
    ? ''
    : `<circle cx="${bodyCx - 18}" cy="${bodyCy - 12}" r="${bodyR * 0.28}" fill="#FFFFFF" opacity="0.45" />`;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="420" viewBox="0 0 900 420">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${skyConfig.skyTop}" />
          <stop offset="48%" stop-color="${skyConfig.skyMid}" />
          <stop offset="82%" stop-color="${skyConfig.horizon}" />
          <stop offset="100%" stop-color="${skyConfig.skyBottom}" />
        </linearGradient>
        <radialGradient id="bodyGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${skyConfig.glowColor}" />
          <stop offset="58%" stop-color="${skyConfig.glowColor}" stop-opacity="0.38" />
          <stop offset="100%" stop-color="${skyConfig.glowColor}" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="haze" cx="50%" cy="100%" r="74%">
          <stop offset="0%" stop-color="${skyConfig.hazeColor}" />
          <stop offset="100%" stop-color="${skyConfig.hazeColor}" stop-opacity="0" />
        </radialGradient>
        <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id="wideSoft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="30" />
        </filter>
      </defs>
      <rect width="900" height="420" fill="url(#sky)" />
      <ellipse cx="450" cy="392" rx="510" ry="160" fill="url(#haze)" />
      <path d="M54 306 C220 152 432 94 846 246" fill="none" stroke="#FFFFFF" stroke-width="1.2" opacity="0.18" />
      <path d="M84 326 C260 190 498 132 832 284" fill="none" stroke="#FFFFFF" stroke-width="0.8" stroke-dasharray="8 16" opacity="0.15" />
      <path d="M36 348 C244 290 616 270 884 354" fill="none" stroke="#FFFFFF" stroke-width="0.7" opacity="0.1" />
      <g opacity="0.98">${starMarkup}</g>
      <g opacity="0.22">
        <circle cx="778" cy="84" r="24" fill="none" stroke="#FFFFFF" stroke-width="0.7" />
        <circle cx="778" cy="84" r="42" fill="none" stroke="#FFFFFF" stroke-width="0.45" />
        <path d="M740 84 H816 M778 46 V122" stroke="#FFFFFF" stroke-width="0.4" />
      </g>
      <circle cx="${bodyCx}" cy="${bodyCy}" r="${bodyR * 3.4}" fill="url(#bodyGlow)" filter="url(#soft)" />
      <circle cx="${bodyCx}" cy="${bodyCy}" r="${bodyR * 6.2}" fill="url(#bodyGlow)" filter="url(#wideSoft)" opacity="0.42" />
      <circle cx="${bodyCx}" cy="${bodyCy}" r="${bodyR}" fill="${skyConfig.bodyColor}" />
      ${moonCut}
      ${sunFlare}
      <g filter="url(#soft)" opacity="0.86">
        <ellipse cx="172" cy="326" rx="170" ry="44" fill="${skyConfig.cloudShadow}" />
        <ellipse cx="432" cy="344" rx="230" ry="58" fill="${skyConfig.cloudShadow}" />
        <ellipse cx="722" cy="320" rx="210" ry="52" fill="${skyConfig.cloudShadow}" />
      </g>
      <g opacity="0.72">
        <ellipse cx="118" cy="324" rx="108" ry="28" fill="${skyConfig.cloudColor}" />
        <ellipse cx="270" cy="316" rx="156" ry="34" fill="${skyConfig.cloudColor}" />
        <ellipse cx="458" cy="348" rx="194" ry="42" fill="${skyConfig.cloudColor}" />
        <ellipse cx="680" cy="318" rx="162" ry="38" fill="${skyConfig.cloudColor}" />
        <ellipse cx="822" cy="336" rx="118" ry="30" fill="${skyConfig.cloudColor}" />
      </g>
      <ellipse cx="450" cy="474" rx="610" ry="146" fill="${skyConfig.horizon}" opacity="0.42" />
      <ellipse cx="450" cy="438" rx="590" ry="112" fill="none" stroke="${skyConfig.accentColor}" stroke-width="1" opacity="0.18" />
      <rect width="900" height="420" fill="#000000" opacity="0.12" />
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

function CelestialHeader({
  skyConfig,
  localTime
}: {
  skyConfig: SkyConfig;
  localTime: string;
}) {
  const imageUri = useMemo(() => skyImageUri(skyConfig), [skyConfig]);
  const orbit = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;
  const bodyOverlayLeft = `${Math.max(2, Math.min(88, (skyConfig.bodyX / 900) * 100 - 7))}%` as `${number}%`;
  const bodyOverlayTop = Math.max(2, Math.min(130, ((52 + skyConfig.bodyY * 280) / 420) * 200 - 42));

  useEffect(() => {
    const orbitLoop = Animated.loop(
      Animated.timing(orbit, {
        duration: 11000,
        easing: Easing.inOut(Easing.sin),
        toValue: 1,
        useNativeDriver: true
      })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true
        })
      ])
    );
    const twinkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true
        }),
        Animated.timing(twinkle, {
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true
        })
      ])
    );

    orbitLoop.start();
    pulseLoop.start();
    twinkleLoop.start();

    return () => {
      orbitLoop.stop();
      pulseLoop.stop();
      twinkleLoop.stop();
    };
  }, [orbit, pulse, twinkle]);

  return (
    <ImageBackground
      imageStyle={cel.image}
      resizeMode="cover"
      source={{ uri: imageUri }}
      style={[cel.root, { backgroundColor: skyConfig.skyTop }]}
    >
      <View style={cel.glassShade} />
      <Animated.View
        style={[
          cel.bodyPulse,
          {
            backgroundColor: skyConfig.glowColor,
            left: bodyOverlayLeft,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.34] }),
            top: bodyOverlayTop,
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.14] }) }]
          }
        ]}
      />
      <Animated.View
        style={[
          cel.orbitSweep,
          {
            opacity: orbit.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.24, 0.08] }),
            transform: [
              { translateX: orbit.interpolate({ inputRange: [0, 1], outputRange: [-105, 120] }) },
              { translateY: orbit.interpolate({ inputRange: [0, 0.5, 1], outputRange: [18, -8, 14] }) },
              { rotate: '-13deg' }
            ]
          }
        ]}
      />
      <Animated.View
        style={[
          cel.twinkleWash,
          {
            opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] })
          }
        ]}
      />
      <View style={cel.content}>
        <View style={cel.liveBadge}>
          <View style={[cel.liveDot, { backgroundColor: skyConfig.accentColor }]} />
          <Text style={cel.liveText}>{localTime} LOCAL</Text>
        </View>
        <Text style={[cel.eyebrow, { color: skyConfig.accentColor }]}>
          {skyConfig.isMoon ? 'Lunar Rhythm' : 'Solar Rhythm'}
        </Text>
        <Text style={cel.title}>Today's Rhythm</Text>
        <Text style={cel.subtitle}>{skyConfig.periodLabel} rhythm estimate from your sleep pattern.</Text>
        <View style={cel.telemetryRow}>
          <Text style={cel.telemetryText}>{skyConfig.periodLabel.toUpperCase()}</Text>
          <Text style={cel.telemetryText}>{skyConfig.isMoon ? 'MOON PATH' : 'SUN PATH'}</Text>
          <Text style={cel.telemetryText}>LOCAL LIGHT</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const cel = StyleSheet.create({
  root: {
    height: 200,
    overflow: 'hidden',
    position: 'relative',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22
  },
  image: {
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22
  },
  glassShade: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  bodyPulse: {
    borderRadius: 56,
    height: 112,
    position: 'absolute',
    width: 112
  },
  orbitSweep: {
    borderColor: 'rgba(255,255,255,0.72)',
    borderRadius: 220,
    borderTopWidth: 1,
    height: 150,
    left: -44,
    position: 'absolute',
    right: -44,
    top: 34
  },
  twinkleWash: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 120,
    height: 70,
    position: 'absolute',
    right: 50,
    top: 22,
    width: 150
  },
  content: {
    bottom: 0,
    gap: 3,
    left: 0,
    padding: 18,
    position: 'absolute',
    right: 0
  },
  liveBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 100,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  liveDot: { borderRadius: 3, height: 6, width: 6 },
  liveText: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase'
  },
  title: {
    color: '#E8EAF2',
    fontFamily: fonts.display,
    fontSize: 29,
    fontWeight: '300',
    letterSpacing: 0,
    lineHeight: 34
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: fonts.body,
    fontSize: 12
  },
  telemetryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 7
  },
  telemetryText: {
    color: 'rgba(255,255,255,0.46)',
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.1
  }
});

function DataCard({
  children,
  delay = 0,
  style
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      delay,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true
    }).start();
  }, [anim, delay]);

  return (
    <Animated.View
      style={[
        dc.card,
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }]
        }
      ]}
    >
      {children}
    </Animated.View>
  );
}

const dc = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 13,
    overflow: 'hidden',
    padding: 16
  }
});

function SectionHeader({ label, tag }: { label: string; tag?: string }) {
  return (
    <View style={sh.row}>
      <Text style={sh.label}>{label}</Text>
      {tag ? <View style={sh.tagWrap}><Text style={sh.tag}>{tag}</Text></View> : null}
    </View>
  );
}

const sh = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: '#E8EAF2', fontFamily: fonts.body, fontSize: 13, fontWeight: '600' },
  tagWrap: {
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  tag: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase'
  }
});

function StatPill({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={sp.root}>
      <Text style={sp.label}>{label}</Text>
      <Text style={[sp.value, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

const sp = StyleSheet.create({
  root: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minWidth: 130,
    padding: 11
  },
  label: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase'
  },
  value: {
    color: '#E8EAF2',
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600'
  }
});

function EnergyCurve({ points }: { points: CircadianEnergyPoint[] }) {
  const sampled = points.filter((_point, index) => index % 3 === 0).slice(0, 6);
  const visible = sampled.length > 0 ? sampled : points.slice(0, 5);
  const max = Math.max(...visible.map((point) => point.estimated_energy), 1);
  const barAnims = useRef(visible.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      80,
      barAnims.map((anim) =>
        Animated.timing(anim, {
          duration: 700,
          easing: Easing.out(Easing.back(1.2)),
          toValue: 1,
          useNativeDriver: false
        })
      )
    ).start();
  }, [barAnims]);

  function barColor(energy: number): string {
    if (energy >= 70) return winnerPalette.green;
    if (energy >= 40) return winnerPalette.blue;
    return 'rgba(255,255,255,0.24)';
  }

  return (
    <View style={ec.root}>
      {visible.map((point, index) => {
        const pct = Math.max((point.estimated_energy / max) * 100, 6);
        return (
          <View key={point.time} style={ec.col}>
            <View style={ec.track}>
              <Animated.View
                style={[
                  ec.fill,
                  {
                    backgroundColor: barColor(point.estimated_energy),
                    height: barAnims[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['4%', `${pct}%`]
                    })
                  }
                ]}
              />
            </View>
            <Text style={ec.time}>{formatTime(point.time)}</Text>
            <Text style={ec.lbl}>{phaseLabel(point.label).split(' ')[0]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const ec = StyleSheet.create({
  root: { alignItems: 'flex-end', flexDirection: 'row', gap: 6, height: 120 },
  col: { alignItems: 'center', flex: 1, gap: 4, height: '100%', justifyContent: 'flex-end' },
  track: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    flex: 1,
    justifyContent: 'flex-end',
    maxHeight: 80,
    overflow: 'hidden',
    width: '100%'
  },
  fill: { borderTopLeftRadius: 3, borderTopRightRadius: 3, width: '100%' },
  time: {
    color: '#E8EAF2',
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '600',
    opacity: 0.6
  },
  lbl: {
    color: 'rgba(255,255,255,0.3)',
    fontFamily: fonts.body,
    fontSize: 8,
    lineHeight: 12,
    textAlign: 'center'
  }
});

function TimingRow({
  iconName,
  iconColor,
  iconBg,
  isLast,
  sub,
  title,
  value,
  valueColor
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  sub: string;
  value: string;
  valueColor?: string;
  isLast?: boolean;
}) {
  return (
    <View style={[tr.root, !isLast && tr.bordered]}>
      <View style={[tr.icon, { backgroundColor: iconBg }]}>
        <Ionicons color={iconColor} name={iconName} size={14} />
      </View>
      <View style={tr.body}>
        <Text style={tr.title}>{title}</Text>
        <Text style={tr.sub}>{sub}</Text>
      </View>
      <Text style={[tr.val, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const tr = StyleSheet.create({
  root: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingVertical: 10 },
  bordered: { borderBottomColor: 'rgba(255,255,255,0.06)', borderBottomWidth: 1 },
  icon: { alignItems: 'center', borderRadius: 8, flexShrink: 0, height: 30, justifyContent: 'center', width: 30 },
  body: { flex: 1, gap: 1 },
  title: { color: '#E8EAF2', fontFamily: fonts.body, fontSize: 13, fontWeight: '500' },
  sub: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: fonts.body,
    fontSize: 9,
    letterSpacing: 0.3
  },
  val: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '600',
    maxWidth: 110,
    textAlign: 'right'
  }
});

export default function RhythmScreen() {
  const { user } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const now = useMemo(() => new Date().toISOString(), []);
  const [sleepSessions, setSleepSessions] = useState<SleepSession[]>(() => createDemoSleepSessions(today));
  const [sleepNeed, setSleepNeed] = useState<SleepNeedEstimate>(() => createDefaultSleepNeedEstimate(now));
  const [dataMode, setDataMode] = useState<RhythmDataMode>('demo');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sleepStartTime, setSleepStartTime] = useState('22:45');
  const [wakeTime, setWakeTime] = useState('06:45');
  const [sleepQuality, setSleepQuality] = useState('4');
  const [localTime, setLocalTime] = useState('');
  const [skyConfig, setSkyConfig] = useState(() => getSkyConfig(new Date().getHours() + new Date().getMinutes() / 60));
  const skyMinuteRef = useRef('');

  useEffect(() => {
    function tick() {
      const date = new Date();
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      const sec = String(date.getSeconds()).padStart(2, '0');
      setLocalTime(`${h}:${m}:${sec}`);
      const skyMinute = `${h}:${m}`;
      if (skyMinuteRef.current !== skyMinute) {
        skyMinuteRef.current = skyMinute;
        setSkyConfig(getSkyConfig(date.getHours() + date.getMinutes() / 60));
      }
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSleepRhythmData() {
      const userId = user?.id;

      if (!isUuid(userId)) {
        if (mounted) {
          setSleepSessions(createDemoSleepSessions(today));
          setSleepNeed(createDefaultSleepNeedEstimate(now));
          setDataMode('demo');
          setIsLoading(false);
        }
        return;
      }

      try {
        const client = supabase as unknown as SleepRhythmSupabaseClient;
        const [recentSessions, activeNeed] = await Promise.all([
          getRecentSleepSessions(client, userId, 14),
          getActiveSleepNeedEstimate(client, userId)
        ]);

        if (!mounted) return;

        setSleepSessions(recentSessions.length > 0 ? recentSessions : createDemoSleepSessions(today));
        setSleepNeed(
          activeNeed
            ? { minutes: activeNeed.minutes, confidence: activeNeed.confidence, basis: activeNeed.basis, updated_at: activeNeed.updated_at }
            : createDefaultSleepNeedEstimate(now)
        );
        setDataMode(recentSessions.length > 0 ? 'persisted' : 'demo');
      } catch {
        if (mounted) {
          setSleepSessions(createDemoSleepSessions(today));
          setSleepNeed(createDefaultSleepNeedEstimate(now));
          setDataMode('demo');
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadSleepRhythmData();
    return () => { mounted = false; };
  }, [now, today, user?.id]);

  const briefing: CircadianBriefing = useMemo(
    () => generateCircadianBriefing({
      date: today,
      now,
      preferredBedtime: '22:30',
      recentSleepSessions: sleepSessions,
      sleepNeed,
      timezone: 'UTC'
    }),
    [now, sleepNeed, sleepSessions, today]
  );

  const latestSession = sleepSessions[0];
  const sleepDuration = getLatestSleepDuration(latestSession);
  const sourceLabel = getSleepSourceLabel(briefing.source_summary.sleep_source);
  const confidenceLabel = getConfidenceLabel(briefing.confidence);
  const rhythmLead = getRhythmLead(briefing);
  const accent = skyConfig.accentColor;

  const dataModeNote =
    dataMode === 'demo'
      ? 'Running on demo data. Log last night to personalize.'
      : dataMode === 'manual'
        ? 'Showing manually logged sleep.'
        : 'Synced from saved sleep data.';

  async function handleManualSubmit() {
    const qualityNumber = sleepQuality ? Number(sleepQuality) : null;
    const boundedQuality =
      qualityNumber !== null && Number.isFinite(qualityNumber)
        ? Math.max(1, Math.min(5, Math.round(qualityNumber)))
        : null;
    const manualSession = createManualSleepSession({
      createdAt: new Date().toISOString(),
      date: today,
      sleepQuality: boundedQuality,
      sleepStartTime,
      wakeTime
    });

    setIsSaving(true);

    try {
      const userId = user?.id;
      if (isUuid(userId)) {
        await saveSleepSession(supabase as unknown as SleepRhythmSupabaseClient, userId, manualSession);
      }
      setSleepSessions((curr) => [manualSession, ...curr.filter((session) => session.date !== today)]);
      setDataMode('manual');
    } catch (error) {
      Alert.alert('Sleep window not saved', error instanceof Error ? error.message : 'Try again later.');
      setSleepSessions((curr) => [manualSession, ...curr.filter((session) => session.date !== today)]);
      setDataMode('manual');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <CelestialHeader localTime={localTime} skyConfig={skyConfig} />

        <DataCard delay={0}>
          <View style={s.phaseRow}>
            <View>
              <Text style={s.phaseEyebrow}>Current phase</Text>
              <Text style={s.phaseName}>{phaseLabel(briefing.current_phase)}</Text>
            </View>
            <View style={[s.sourceBadge, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
              <View style={[s.sourceDot, { backgroundColor: accent }]} />
              <Text style={[s.sourceTxt, { color: accent }]}>{sourceLabel}</Text>
              {isLoading ? <ActivityIndicator color={accent} size="small" style={s.sourceLoader} /> : null}
            </View>
          </View>

          <View style={s.leadBox}>
            <Text style={[s.leadEyebrow, { color: accent }]}>Strongest signal today</Text>
            <Text style={s.leadText}>{rhythmLead}</Text>
            <Text style={s.leadSub}>{confidenceLabel} - {dataModeNote}</Text>
          </View>

          <View style={s.statsGrid}>
            <StatPill label="Sleep" value={`${formatTime(latestSession?.sleep_start_at)} - ${formatTime(latestSession?.sleep_end_at)}`} />
            <StatPill label="Duration" value={formatDuration(sleepDuration)} />
            <StatPill label="7-day debt" value={formatDebt(briefing.sleep_debt_7_day.total_sleep_debt_minutes)} accent={winnerPalette.gold} />
            <StatPill label="Target bedtime" value={formatTime(briefing.target_bedtime)} accent={winnerPalette.violet} />
          </View>
        </DataCard>

        <DataCard delay={100}>
          <SectionHeader label="Energy curve" tag="Estimated" />
          <EnergyCurve points={briefing.energy_curve} />
        </DataCard>

        <DataCard delay={200}>
          <SectionHeader label="Organize your day" tag="Timing only" />
          <View>
            <TimingRow
              iconBg="rgba(91,127,255,0.15)"
              iconColor={winnerPalette.blue}
              iconName="sparkles-outline"
              sub="Best window"
              title="Deep focus"
              value={formatWindow(briefing.rhythm_plan.deep_work_windows[0])}
              valueColor={winnerPalette.blue}
            />
            <TimingRow
              iconBg="rgba(79,201,138,0.12)"
              iconColor={winnerPalette.green}
              iconName="flash-outline"
              sub="Suggested window"
              title="Exercise"
              value={formatWindow(briefing.rhythm_plan.best_exercise_windows[0])}
              valueColor={winnerPalette.green}
            />
            <TimingRow
              iconBg="rgba(255,255,255,0.05)"
              iconColor="rgba(255,255,255,0.6)"
              iconName="walk-outline"
              sub="Walk or stretch"
              title="Light movement"
              value={formatWindow(briefing.rhythm_plan.best_walk_windows[0])}
            />
            <TimingRow
              iconBg="rgba(255,255,255,0.05)"
              iconColor="rgba(255,255,255,0.6)"
              iconName="leaf-outline"
              sub="Suggested window"
              title="Breathing reset"
              value={formatWindow(briefing.rhythm_plan.breathing_windows[0])}
            />
            {briefing.rhythm_plan.nap_windows[0] ? (
              <TimingRow
                iconBg="rgba(139,165,255,0.1)"
                iconColor={winnerPalette.violet}
                iconName="moon-outline"
                sub="Possible window"
                title="Short nap"
                value={formatWindow(briefing.rhythm_plan.nap_windows[0])}
                valueColor={winnerPalette.violet}
              />
            ) : null}
            <TimingRow
              iconBg="rgba(240,180,41,0.12)"
              iconColor={winnerPalette.gold}
              iconName="cafe-outline"
              sub="Based on bedtime"
              title="Caffeine cutoff"
              value={formatTime(briefing.rhythm_plan.caffeine_cutoff)}
              valueColor={winnerPalette.gold}
            />
            <TimingRow
              iconBg="rgba(139,165,255,0.08)"
              iconColor={winnerPalette.violet}
              iconName="cloudy-night-outline"
              isLast
              sub="Start here"
              title="Wind-down"
              value={formatTime(briefing.rhythm_plan.wind_down_start)}
              valueColor={winnerPalette.violet}
            />
          </View>
        </DataCard>

        <DataCard delay={300}>
          <SectionHeader label="Log sleep" tag="Optional" />
          <Text style={s.logDesc}>Enter last night's times to update your rhythm estimate.</Text>

          <View style={s.timeRow}>
            <View style={s.timeField}>
              <Text style={s.inputLbl}>Fell asleep</Text>
              <View style={s.timeDisplay}><Text style={s.timeDisplayTxt}>{sleepStartTime}</Text></View>
            </View>
            <Text style={s.timeConnector}>to</Text>
            <View style={s.timeField}>
              <Text style={s.inputLbl}>Woke up</Text>
              <View style={s.timeDisplay}><Text style={s.timeDisplayTxt}>{wakeTime}</Text></View>
            </View>
          </View>

          <View style={s.presets}>
            {[['22:30', '06:30'], ['23:15', '07:00'], ['00:00', '07:15']].map(([start, wake]) => (
              <Pressable
                key={`${start}-${wake}`}
                accessibilityRole="button"
                onPress={() => { setSleepStartTime(start); setWakeTime(wake); }}
                style={s.preset}
              >
                <Text style={s.presetTxt}>{start} - {wake}</Text>
              </Pressable>
            ))}
          </View>

          <View>
            <Text style={[s.inputLbl, s.qualityLabel]}>
              Sleep quality <Text style={s.optional}>(optional)</Text>
            </Text>
            <View style={s.qualityRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSleepQuality('')}
                style={[s.qChip, sleepQuality === '' && s.qChipActive]}
              >
                <Text style={s.qTxt}>Not sure</Text>
              </Pressable>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  onPress={() => setSleepQuality(String(value))}
                  style={[s.qChip, s.qNum, sleepQuality === String(value) && { backgroundColor: `${accent}18`, borderColor: `${accent}88` }]}
                >
                  <Text style={[s.qTxt, sleepQuality === String(value) && { color: accent }]}>{value}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleManualSubmit}
            style={[s.submitBtn, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }, isSaving && s.submitDisabled]}
          >
            {isSaving
              ? <ActivityIndicator color={accent} size="small" />
              : <Text style={[s.submitTxt, { color: accent }]}>Update rhythm estimate</Text>
            }
          </Pressable>
        </DataCard>

        <View style={s.footnote}>
          <Ionicons color="rgba(255,255,255,0.25)" name="information-circle-outline" size={13} style={s.footnoteIcon} />
          <Text style={s.footnoteTxt}>Wellness estimate. Accuracy improves with more logged nights. Wearable sync coming soon.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { backgroundColor: '#050506', flex: 1 },
  scroll: { gap: 12, paddingBottom: 44, paddingHorizontal: 16 },
  phaseRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  phaseEyebrow: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  phaseName: {
    color: '#E8EAF2',
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 0
  },
  sourceBadge: {
    alignItems: 'center',
    borderRadius: 100,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  sourceDot: { borderRadius: 2.5, height: 5, width: 5 },
  sourceTxt: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  sourceLoader: { marginLeft: 4 },
  leadBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
    padding: 13
  },
  leadEyebrow: {
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
    opacity: 0.7,
    textTransform: 'uppercase'
  },
  leadText: {
    color: '#E8EAF2',
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20
  },
  leadSub: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  logDesc: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: -4
  },
  timeRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 8 },
  timeField: { flex: 1, gap: 5 },
  inputLbl: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase'
  },
  timeDisplay: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center'
  },
  timeDisplayTxt: {
    color: '#E8EAF2',
    fontFamily: fonts.body,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1
  },
  timeConnector: {
    color: 'rgba(255,255,255,0.25)',
    fontFamily: fonts.body,
    fontSize: 12,
    paddingBottom: 12
  },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preset: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  presetTxt: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.3
  },
  qualityLabel: { marginBottom: 8 },
  optional: {
    fontWeight: '400',
    letterSpacing: 0,
    opacity: 0.4,
    textTransform: 'none'
  },
  qualityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  qChip: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  qChipActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.35)'
  },
  qNum: { alignItems: 'center', minWidth: 38 },
  qTxt: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '500'
  },
  submitBtn: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    marginTop: 2
  },
  submitDisabled: { opacity: 0.5 },
  submitTxt: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  footnote: { alignItems: 'flex-start', flexDirection: 'row', gap: 7, paddingHorizontal: 2 },
  footnoteIcon: { marginTop: 1 },
  footnoteTxt: {
    color: 'rgba(255,255,255,0.25)',
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 17
  }
});
