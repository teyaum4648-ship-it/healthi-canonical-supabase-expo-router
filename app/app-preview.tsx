import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../src/components/Screen';

// Real Daywoven app captures already published as assets on daywovenapp.com.
// Do not substitute stock photos or promise features that are not in the build.
const IMAGE_BASE = 'https://daywovenapp.com/assets/';

type Feature = {
  number: string;
  eyebrow: string;
  title: string;
  copy: string;
  benefit: string;
  image: string;
  imageLabel: string;
};

const features: Feature[] = [
  {
    number: '01',
    eyebrow: 'YOUR DAY, IN ONE PLACE',
    title: 'One daily direction. With reasons.',
    copy: 'Bring your sleep, food, movement and mood into one daily overview. See what informed your starting point instead of having to piece together five separate trackers.',
    benefit: 'Why it helps: spend less time interpreting your logs and more time choosing a realistic next step.',
    image: 'home.webp',
    imageLabel: 'Daywoven Home and daily wellness overview'
  },
  {
    number: '02',
    eyebrow: 'FOOD SEARCH + BARCODE SCANNER',
    title: 'Understand what is in your food.',
    copy: 'Search for products or scan a barcode to explore nutrition details, product scores and the reasons behind them. Log what you eat so Daywoven can connect meals with the rest of your day.',
    benefit: 'Why it helps: make more informed food decisions without having to decode every label yourself. Results depend on available product and label data.',
    image: 'food-results.webp',
    imageLabel: 'Daywoven food lookup and product-results screen'
  },
  {
    number: '03',
    eyebrow: 'SLEEP + CIRCADIAN RHYTHM',
    title: 'Find the rhythm behind your energy.',
    copy: 'Track sleep timing, explore your daily rhythm and get practical wind-down guidance. With your permission, supported Apple Health information can help build a clearer picture.',
    benefit: 'Why it helps: notice timing patterns over several days, rather than judging your sleep from one night.',
    image: 'rhythm.webp',
    imageLabel: 'Daywoven Sleep and daily rhythm screen'
  },
  {
    number: '04',
    eyebrow: 'MOVEMENT + TRAINING',
    title: 'Train with context, not guesswork.',
    copy: 'Plan and log workouts, look back at sessions and use available recovery signals to understand the effort Daywoven suggests for today.',
    benefit: 'Why it helps: keep training consistent while making room for lighter days when the signals are incomplete or recovery may need attention.',
    image: 'movement.webp',
    imageLabel: 'Daywoven Movement and workout tracking screen'
  },
  {
    number: '05',
    eyebrow: 'MOOD + MIND',
    title: 'See how the rest of life fits in.',
    copy: 'Check in on mood and daily load, revisit what you recorded, and explore gentle breathing and reflection tools when you want a reset.',
    benefit: 'Why it helps: add context to your habits and spot patterns that a workout or calorie number cannot explain by itself.',
    image: 'mood.webp',
    imageLabel: 'Daywoven Mood check-in screen'
  }
];

const extras = [
  { title: 'Hydration', copy: 'Keep daily water intake alongside food and activity.' },
  { title: 'Progress over time', copy: 'Look back at what you actually logged and see your trends develop.' },
  { title: 'Personal baseline', copy: 'Start with the wellness questionnaire, then refine your plan as new data arrives.' },
  { title: 'Breathing practices', copy: 'Try guided, optional breathing routines for a moment of calm.' }
];

function PreviewImage({ name, label }: { name: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.imageFrame}>
      {failed ? (
        <View style={styles.imageFallback}>
          <Text style={styles.imageFallbackTitle}>App screenshot unavailable</Text>
          <Text style={styles.imageFallbackText}>Connect to the internet to view the Daywoven screenshot.</Text>
        </View>
      ) : (
        <Image
          accessibilityLabel={label}
          accessibilityRole="image"
          onError={() => setFailed(true)}
          resizeMode="contain"
          source={{ uri: `${IMAGE_BASE}${name}` }}
          style={styles.image}
        />
      )}
      <Text style={styles.imageCaption}>ACTUAL DAYWOVEN APP PREVIEW</Text>
    </View>
  );
}

function goBackToMembership() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/paywall');
  }
}

export default function AppPreviewScreen() {
  return (
    <Screen backgroundStyle={styles.background} contentStyle={styles.page}>
      <View style={styles.nav}>
        <Text style={styles.wordmark}>daywoven<Text style={styles.brandDot}>.</Text></Text>
        <Pressable accessibilityRole="button" onPress={goBackToMembership} style={styles.navBack}>
          <Text style={styles.navBackText}>‹ Membership</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>A LOOK INSIDE DAYWOVEN</Text>
        <Text accessibilityRole="header" style={styles.heroTitle}>
          Know what your body needs today.{ '\n' }
          <Text style={styles.heroAccent}>And why.</Text>
        </Text>
        <Text style={styles.heroText}>
          Explore what is inside before you choose a membership. These are real app preview images and clear explanations of what each tool is designed to do.
        </Text>
        <View style={styles.heroTags}>
          {['FOOD', 'SLEEP', 'MOVEMENT', 'MOOD'].map(tag => (
            <View key={tag} style={styles.heroTag}><Text style={styles.heroTagText}>{tag}</Text></View>
          ))}
        </View>
      </View>

      <PreviewImage name="home.webp" label="Daywoven daily Home dashboard" />

      <View style={styles.sectionLead}>
        <Text style={styles.sectionEyebrow}>THE TOOLS</Text>
        <Text style={styles.sectionTitle}>A clearer picture. One feature at a time.</Text>
        <Text style={styles.sectionBody}>Every feature is designed to help you make sense of everyday patterns without treating any single number as a medical diagnosis.</Text>
      </View>

      {features.map(feature => (
        <View key={feature.number} style={styles.feature}>
          <View style={styles.featureTopline}>
            <Text style={styles.featureNumber}>{feature.number}</Text>
            <Text style={styles.featureEyebrow}>{feature.eyebrow}</Text>
          </View>
          <Text style={styles.featureTitle}>{feature.title}</Text>
          <Text style={styles.featureCopy}>{feature.copy}</Text>
          {feature.number !== '01' ? <PreviewImage name={feature.image} label={feature.imageLabel} /> : null}
          <View style={styles.benefit}>
            <View style={styles.benefitDot} />
            <Text style={styles.benefitText}>{feature.benefit}</Text>
          </View>
        </View>
      ))}

      <View style={styles.moreSection}>
        <Text style={styles.sectionEyebrow}>AND MORE</Text>
        <Text style={styles.sectionTitle}>Little tools. Real-life usefulness.</Text>
        <View style={styles.extrasGrid}>
          {extras.map(item => (
            <View key={item.title} style={styles.extraCard}>
              <View style={styles.extraDot} />
              <Text style={styles.extraTitle}>{item.title}</Text>
              <Text style={styles.extraCopy}>{item.copy}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.finalPanel}>
        <Text style={styles.finalEyebrow}>YOUR WELLNESS, YOUR CHOICE</Text>
        <Text style={styles.finalTitle}>Ready to explore your own patterns?</Text>
        <Text style={styles.finalCopy}>
          Return to the membership screen to review available plans and pricing. This tour is informational and does not unlock premium features.
        </Text>
        <Pressable accessibilityRole="button" onPress={goBackToMembership} style={styles.finalButton}>
          <Text style={styles.finalButtonText}>Back to membership options   ↗</Text>
        </Pressable>
        <Text style={styles.smallPrint}>Features and insights depend on your data, permissions and product availability. Daywoven is for wellness information, not diagnosis or treatment.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#12251B',
    experimental_backgroundImage: 'linear-gradient(180deg, #214632 0%, #13281D 29%, #0C1912 100%)'
  },
  page: { gap: 24, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 54 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  wordmark: { color: '#F6F8F4', fontSize: 26, fontWeight: '800', letterSpacing: -1.4 },
  brandDot: { color: '#C8F18C' },
  navBack: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 22, borderColor: 'rgba(200,241,140,0.3)', borderWidth: 1 },
  navBackText: { color: '#D5E9C9', fontSize: 12, fontWeight: '700' },
  hero: { gap: 16, paddingTop: 22, paddingBottom: 4 },
  heroEyebrow: { color: '#C8F18C', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heroTitle: { color: '#F6F8F4', fontSize: 42, fontWeight: '800', lineHeight: 47, letterSpacing: -1.8 },
  heroAccent: { color: '#B8D69D' },
  heroText: { color: '#C3D3C0', fontSize: 15, lineHeight: 25 },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 6 },
  heroTag: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(200,241,140,0.24)', backgroundColor: 'rgba(200,241,140,0.06)' },
  heroTagText: { color: '#CBE3B5', fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  imageFrame: { backgroundColor: '#102219', borderRadius: 23, borderColor: 'rgba(200,241,140,0.14)', borderWidth: 1, overflow: 'hidden', padding: 12 },
  image: { width: '100%', height: 335 },
  imageCaption: { textAlign: 'center', color: '#92A892', fontSize: 10, letterSpacing: 1, fontWeight: '700', paddingTop: 7, paddingBottom: 4 },
  imageFallback: { height: 335, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 25, gap: 7 },
  imageFallbackTitle: { color: '#F6F8F4', fontSize: 17, fontWeight: '700' },
  imageFallbackText: { color: '#B8CAB5', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  sectionLead: { gap: 12, paddingTop: 13 },
  sectionEyebrow: { color: '#C8F18C', fontWeight: '800', fontSize: 10, letterSpacing: 1.5 },
  sectionTitle: { color: '#F6F8F4', fontWeight: '800', fontSize: 31, lineHeight: 36, letterSpacing: -1 },
  sectionBody: { color: '#B8CAB5', lineHeight: 23, fontSize: 14 },
  feature: { backgroundColor: '#182F21', borderRadius: 23, borderColor: 'rgba(200,241,140,0.13)', borderWidth: 1, padding: 18, gap: 15 },
  featureTopline: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  featureNumber: { color: '#C8F18C', fontSize: 12, fontWeight: '800' },
  featureEyebrow: { color: '#B4CDB0', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, flexShrink: 1 },
  featureTitle: { color: '#F6F8F4', fontWeight: '800', fontSize: 25, lineHeight: 30, letterSpacing: -0.7 },
  featureCopy: { color: '#C0D0BE', fontSize: 14, lineHeight: 23 },
  benefit: { flexDirection: 'row', gap: 10, backgroundColor: '#23442F', borderRadius: 14, padding: 13 },
  benefitDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C8F18C', marginTop: 7 },
  benefitText: { color: '#E2F1D5', fontSize: 12, lineHeight: 21, flex: 1 },
  moreSection: { gap: 18, paddingTop: 16 },
  extrasGrid: { gap: 12 },
  extraCard: { backgroundColor: '#1A3224', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(200,241,140,0.12)', padding: 17, gap: 8 },
  extraDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#C8F18C' },
  extraTitle: { color: '#F6F8F4', fontSize: 17, fontWeight: '700' },
  extraCopy: { color: '#B8CAB5', fontSize: 13, lineHeight: 21 },
  finalPanel: { gap: 18, marginTop: 10, padding: 23, backgroundColor: '#2B5037', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(200,241,140,0.24)' },
  finalEyebrow: { color: '#C8F18C', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  finalTitle: { color: '#F6F8F4', fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -1 },
  finalCopy: { color: '#D2E4CB', fontSize: 14, lineHeight: 23 },
  finalButton: { padding: 16, alignItems: 'center', justifyContent: 'center', minHeight: 54, borderRadius: 14, backgroundColor: '#C8F18C' },
  finalButtonText: { color: '#17231D', fontSize: 14, fontWeight: '800' },
  smallPrint: { color: '#B3C9AF', fontSize: 11, lineHeight: 18 }
});
