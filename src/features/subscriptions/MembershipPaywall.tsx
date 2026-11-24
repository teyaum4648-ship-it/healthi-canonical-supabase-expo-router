import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path } from 'react-native-svg';
import type { PurchasesPackage } from 'react-native-purchases';

import * as dv from '../../styles/daywoven1c';
import { fonts } from '../../styles/mobileTheme';
import { subscriptionPlan } from './subscriptionPlans';

type Action = 'purchase' | 'restore' | 'website' | 'verify' | null;
type Props = {
  gated: boolean;
  active: boolean;
  enabled: boolean;
  loading: boolean;
  action: Action;
  canBuyNative: boolean;
  packages: PurchasesPackage[];
  selected: string | null;
  error: string;
  webCheckoutAvailable: boolean;
  onSelect: (identifier: string) => void;
  onPurchase: () => void;
  onRestore: () => void;
  onRetry: () => void;
  onPreview: () => void;
  onBack: () => void;
  onManage: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
  onWebsiteCheckout: () => void;
  onCheckWebsitePurchase: () => void;
};

const foundations: { icon: ComponentProps<typeof Ionicons>['name']; name: string; color: string }[] = [
  { icon: 'moon-outline', name: 'Sleep', color: dv.pillar.recovery_rhythm },
  { icon: 'nutrition-outline', name: 'Food', color: dv.pillar.nourishment },
  { icon: 'fitness-outline', name: 'Move', color: dv.pillar.movement_capacity },
  { icon: 'leaf-outline', name: 'Mind', color: dv.pillar.mind_life_load }
];

/** A brand illustration, not a simulated readiness score or personal health result. */
function WovenDay() {
  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.illustration}>
      <Svg width="100%" height="70" viewBox="0 0 342 126" fill="none">
        <G stroke={dv.membership.lineOnForest} strokeWidth="1">
          <Circle cx="171" cy="60" r="52" />
          <Circle cx="171" cy="60" r="39" />
          <Path d="M0 60H119M223 60H342" strokeDasharray="3 5" />
        </G>
        <G strokeWidth="2.5" strokeLinecap="round">
          <Path d="M0 20C75 20 99 94 147 77C182 64 173 26 199 27C223 28 243 42 342 42" stroke={dv.pillar.recovery_rhythm} />
          <Path d="M0 46C85 46 107 15 141 30C175 46 167 96 199 94C241 92 257 18 342 18" stroke={dv.pillar.nourishment} />
          <Path d="M0 76C78 76 101 101 136 92C179 81 175 38 203 43C242 50 264 100 342 100" stroke={dv.pillar.movement_capacity} />
          <Path d="M0 102C66 102 111 35 145 47C175 58 175 86 205 77C245 66 266 74 342 74" stroke={dv.pillar.mind_life_load} />
        </G>
      </Svg>
      <View style={styles.foundationRow}>
        {foundations.map(item => (
          <View key={item.name} style={styles.foundation}>
            <Ionicons name={item.icon} color={item.color} size={16} />
            <Text style={styles.foundationText}>{item.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function MembershipPaywall(props: Props) {
  const [compact, setCompact] = useState(false);
  const busy = props.action !== null;
  const selected = props.packages.find(item => item.identifier === props.selected);
  const canPurchase = props.enabled && !!selected && !props.loading && props.canBuyNative && !busy;
  const showPlans = !props.active && props.enabled && props.packages.length > 0;

  return (
    <View style={styles.root} onLayout={event => setCompact(event.nativeEvent.layout.width < 360)}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <LinearGradient colors={[dv.membership.forestLight, dv.membership.forest]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}>
          <SafeAreaView edges={['top']} style={styles.hero}>
            <View style={styles.topline}>
              <Text accessibilityLabel="Daywoven" style={styles.wordmark}>daywoven<Text style={styles.wordmarkDot}>.</Text></Text>
              {props.gated ? (
                <View style={styles.memberBadge}><Text style={styles.memberBadgeText}>MEMBERSHIP</Text></View>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="Back to settings" disabled={busy} onPress={props.onBack} style={styles.close} hitSlop={4}>
                  <Ionicons name="close-outline" size={24} color={dv.membership.onForest} />
                </Pressable>
              )}
            </View>
            <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>Your whole day.{"\n"}<Text style={styles.titleAccent}>A little more in tune.</Text></Text>
            <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>Understand what your body needs today,{"\n"}with the reasons behind it.</Text>
            <WovenDay />
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.benefits}>
            {[
              ['sunny-outline', 'One clear direction, every morning'],
              ['git-merge-outline', 'Sleep, food, movement, and mind, connected'],
              ['repeat-outline', 'Guidance that adapts to your day']
            ].map(([icon, text]) => (
              <View key={text} style={styles.benefit}>
                <Ionicons name={icon as ComponentProps<typeof Ionicons>['name']} size={19} color={dv.ink.text} />
                <Text style={styles.benefitText}>{text}</Text>
              </View>
            ))}
          </View>

          {props.active ? (
            <View style={styles.statePanel}>
              <Ionicons name="checkmark-circle-outline" size={28} color={dv.membership.onSelected} />
              <Text accessibilityRole="header" style={styles.sectionTitle}>You’re part of Daywoven.</Text>
              <Text style={styles.body}>Your membership is active. Your daily tools are ready when you are.</Text>
              {props.webCheckoutAvailable ? <Text style={styles.body}>For a website membership, use the billing-management link in your purchase confirmation.</Text> : null}
            </View>
          ) : null}

          {props.loading ? (
            <View accessibilityRole="progressbar" accessibilityLabel="Loading membership plans" style={styles.loading}>
              <ActivityIndicator color={dv.membership.onSelected} />
              <Text style={styles.body}>Finding your membership options…</Text>
            </View>
          ) : null}

          {showPlans && !props.loading ? (
            <View style={styles.plans} accessibilityRole="radiogroup" accessibilityLabel="Membership plans">
              <View style={styles.sectionHeading}>
                <Text accessibilityRole="header" style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>Make room for your whole self.</Text>
                <Text style={styles.sectionNote}>Every plan includes all four foundations.</Text>
              </View>
              <View style={styles.planOptions}>
              {props.packages.map(item => {
                const plan = subscriptionPlan(item, props.packages);
                const checked = item.identifier === props.selected;
                return (
                  <Pressable
                    key={item.identifier}
                    accessibilityRole="radio"
                    aria-checked={checked}
                    accessibilityLabel={`${plan.title}, ${plan.price}${plan.cadence}, ${plan.detail}${plan.savings ? `, save ${plan.savings} percent compared with monthly billing` : ''}`}
                    accessibilityState={{ checked, disabled: busy }}
                    disabled={busy}
                    onPress={() => props.onSelect(item.identifier)}
                    style={({ pressed }) => [styles.plan, checked && styles.planSelected, pressed && styles.pressed]}
                  >
                    <View style={styles.planHeading}>
                      <View style={[styles.radio, checked && styles.radioSelected]}>{checked ? <View style={styles.radioDot} /> : null}</View>
                        {plan.savings ? <View style={styles.savings}><Text style={styles.savingsText}>Save {plan.savings}%</Text></View> : null}
                    </View>
                    <View style={styles.planCopy}>
                      <Text style={styles.planTitle}>{plan.title}</Text>
                      <Text style={styles.planPrice}>{plan.price}<Text style={styles.planCadence}>{plan.cadence}</Text></Text>
                      <Text style={styles.planDetail}>{plan.detail}</Text>
                    </View>
                  </Pressable>
                );
              })}
              </View>
            </View>
          ) : null}

          {!props.loading && !props.active && (!props.enabled || !props.packages.length) && !props.error ? (
            <View style={styles.statePanel}>
              <Text style={styles.sectionTitle}>A little pause.</Text>
              <Text style={styles.body}>{props.enabled ? 'Your membership options could not be found. Please try again.' : 'In-app membership is not available on this device yet.'}</Text>
              <Pressable accessibilityRole="button" disabled={busy} onPress={props.onRetry} style={styles.textButton}><Text style={styles.link}>Try again</Text></Pressable>
            </View>
          ) : null}

          {props.error ? (
            <View style={styles.errorPanel}>
              <Text accessibilityRole="alert" style={styles.error}>{props.error}</Text>
              <Pressable accessibilityRole="button" disabled={busy} onPress={props.onRetry} style={styles.textButton}><Text style={styles.link}>Reload membership options</Text></Pressable>
            </View>
          ) : null}

          {!props.canBuyNative && props.enabled && !props.active ? <Text style={styles.body}>In-app purchases are available in the Daywoven iOS app.</Text> : null}

          {props.webCheckoutAvailable && !props.active ? (
            <View style={styles.website}>
              <Pressable accessibilityRole="link" disabled={busy} onPress={props.onWebsiteCheckout} style={styles.textButton}>
                <Text style={styles.link}>{props.action === 'website' ? 'Opening Daywoven…' : 'Prefer to subscribe on our website?'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={props.onCheckWebsitePurchase} style={styles.textButton}>
                <Text style={styles.secondaryLink}>{props.action === 'verify' ? 'Checking your membership…' : 'Already paid on the website? Check access'}</Text>
              </Pressable>
              <Text style={styles.finePrint}>Website purchases are billed and managed through our web checkout provider. Use the billing link in your purchase confirmation.</Text>
            </View>
          ) : null}

          <Pressable accessibilityRole="link" accessibilityLabel="Preview the app" disabled={busy} onPress={props.onPreview} style={styles.preview}>
            <Ionicons name="play-circle-outline" size={20} color={dv.ink.muted} />
            <Text style={styles.previewText}>Take a look inside Daywoven</Text>
          </Pressable>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View style={styles.footerInner}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: props.active ? busy : !canPurchase, busy }}
            disabled={props.active ? busy : !canPurchase}
            onPress={props.active ? props.onManage : props.onPurchase}
            style={({ pressed }) => [styles.cta, (props.active ? busy : !canPurchase) && styles.disabled, pressed && styles.pressed]}
          >
            {busy ? <ActivityIndicator color={dv.membership.forest} /> : null}
            <Text style={styles.ctaText}>{props.action === 'purchase' ? 'Confirming your membership…' : props.action === 'restore' ? 'Restoring your membership…' : props.action === 'verify' ? 'Checking your membership…' : props.action === 'website' ? 'Opening Daywoven…' : props.active ? 'Manage Apple subscription' : 'Subscribe to Daywoven'}</Text>
          </Pressable>
          {!props.active && selected ? <Text style={styles.renewal}>{subscriptionPlan(selected).renewal}</Text> : null}
          <View style={styles.footerLinks}>
            <Pressable accessibilityRole="button" disabled={busy || !props.enabled || !props.canBuyNative} onPress={props.onRestore} style={styles.footerLink}><Text style={[styles.footerLinkText, (!props.enabled || !props.canBuyNative) && styles.disabled]}>Restore purchases</Text></Pressable>
            <Pressable accessibilityRole="link" onPress={props.onTerms} style={styles.footerLink}><Text style={styles.footerLinkText}>Terms</Text></Pressable>
            <Pressable accessibilityRole="link" onPress={props.onPrivacy} style={styles.footerLink}><Text style={styles.footerLinkText}>Privacy</Text></Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: dv.surface.canvas },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  hero: { paddingHorizontal: 24, paddingBottom: 16, width: '100%', maxWidth: 580, alignSelf: 'center' },
  topline: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  wordmark: { color: dv.membership.onForest, fontFamily: fonts.bodySemibold, fontSize: 27, letterSpacing: -1.8 },
  wordmarkDot: { color: dv.membership.lime },
  memberBadge: { borderColor: dv.membership.lineOnForest, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  memberBadgeText: { color: dv.membership.mutedOnForest, fontFamily: fonts.bodySemibold, fontSize: 10, letterSpacing: 1.1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: dv.membership.lineOnForest },
  title: { marginTop: 10, color: dv.membership.onForest, fontFamily: fonts.display, fontSize: 30, lineHeight: 37, letterSpacing: -.3 },
  titleCompact: { fontSize: 30, lineHeight: 37 },
  titleAccent: { color: dv.membership.lime },
  subtitle: { color: dv.membership.mutedOnForest, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, marginTop: 12 },
  subtitleCompact: { fontSize: 14, lineHeight: 21 },
  illustration: { marginTop: 8 },
  foundationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: -2 },
  foundation: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  foundationText: { color: dv.membership.mutedOnForest, fontFamily: fonts.bodyMedium, fontSize: 12 },
  content: { width: '100%', maxWidth: 580, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 16 },
  benefits: { paddingVertical: 18, gap: 11, borderBottomWidth: 1, borderBottomColor: dv.ink.hairline },
  benefit: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  benefitText: { flex: 1, color: dv.ink.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  plans: { gap: 10, paddingTop: 17 },
  planOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionHeading: { marginBottom: 5, gap: 5 },
  sectionTitle: { color: dv.ink.text, fontFamily: fonts.displayMedium, fontSize: 20, lineHeight: 26 },
  sectionTitleCompact: { fontSize: 21, lineHeight: 26 },
  sectionNote: { color: dv.ink.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  plan: { flexBasis: '45%', flexGrow: 1, minWidth: 125, backgroundColor: dv.surface.card, borderWidth: 1.5, borderColor: dv.ink.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  planSelected: { backgroundColor: dv.membership.selected, borderColor: dv.membership.selectedBorder },
  radio: { width: 22, height: 22, borderWidth: 1.5, borderColor: dv.ink.muted, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  radioSelected: { borderColor: dv.membership.onSelected },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: dv.membership.onSelected },
  planCopy: { flex: 1, gap: 4 },
  planHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  planTitle: { fontFamily: fonts.bodySemibold, color: dv.ink.text, fontSize: 15, lineHeight: 21 },
  planPrice: { fontFamily: fonts.bodySemibold, color: dv.ink.text, fontSize: 20, lineHeight: 27, fontVariant: ['tabular-nums'] },
  planCadence: { fontFamily: fonts.body, color: dv.ink.muted, fontSize: 14 },
  planDetail: { fontFamily: fonts.body, color: dv.ink.muted, fontSize: 12, lineHeight: 18 },
  savings: { backgroundColor: dv.membership.lime, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  savingsText: { color: dv.membership.forest, fontFamily: fonts.bodySemibold, fontSize: 11, lineHeight: 14 },
  statePanel: { paddingVertical: 24, gap: 10 },
  body: { color: dv.ink.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  loading: { paddingVertical: 32, gap: 12, alignItems: 'center' },
  errorPanel: { paddingTop: 18, gap: 5 },
  error: { color: dv.safety.onCanvas, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  website: { paddingTop: 14, gap: 2 },
  textButton: { minHeight: 44, justifyContent: 'center' },
  link: { color: dv.membership.onSelected, fontFamily: fonts.bodySemibold, fontSize: 14, lineHeight: 21, textDecorationLine: 'underline' },
  secondaryLink: { color: dv.ink.muted, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 20, textDecorationLine: 'underline' },
  finePrint: { color: dv.ink.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  preview: { minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  previewText: { color: dv.ink.muted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  footer: { backgroundColor: dv.surface.canvas, borderTopWidth: 1, borderTopColor: dv.ink.hairline },
  footerInner: { width: '100%', maxWidth: 580, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 4 },
  cta: { minHeight: 56, backgroundColor: dv.membership.lime, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  ctaText: { flexShrink: 1, color: dv.membership.forest, fontFamily: fonts.bodySemibold, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  renewal: { color: dv.ink.muted, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 9 },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 17 },
  footerLink: { minHeight: 44, justifyContent: 'center' },
  footerLinkText: { color: dv.ink.muted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  disabled: { opacity: .45 },
  pressed: { opacity: .75 }
});
