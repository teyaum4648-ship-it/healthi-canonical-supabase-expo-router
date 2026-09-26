import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../src/components/Screen';
import { isSupabaseConfigured, supabase } from '../../src/lib/supabase';
import { colors, fonts, cardSurface } from '../../src/styles/mobileTheme';

type ReviewQueue = {
  records: Array<{ id: string; record_type: string }>;
  certifications: Array<{ id: string; certification_name: string }>;
  contexts: Array<{ id: string; title: string }>;
  regulatoryAlerts: Array<{ id: string; title: string }>;
};

export default function LabEvidenceReviewScreen() {
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [status, setStatus] = useState('Verifying reviewer access...');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStatus('Reviewer tools are unavailable in local demo mode.');
      return;
    }
    supabase.functions.invoke('lab-evidence-review', { body: { action: 'queue' } })
      .then(({ data, error }) => {
        if (error || !data) {
          setStatus('Reviewer access is unavailable.');
          return;
        }
        setQueue(data as ReviewQueue);
        setStatus('Pending evidence review');
      })
      .catch(() => setStatus('Reviewer access is unavailable.'));
  }, []);

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>Internal</Text>
        <Text style={styles.title}>Lab Evidence Review</Text>
        <Text style={styles.body}>{status}</Text>
        {!queue && status.includes('Verifying') ? <ActivityIndicator color={colors.accent} /> : null}
        {queue ? (
          <View style={styles.card}>
            <Text style={styles.body}>Lab records: {queue.records.length}</Text>
            <Text style={styles.body}>Certifications: {queue.certifications.length}</Text>
            <Text style={styles.body}>Evidence contexts: {queue.contexts.length}</Text>
            <Text style={styles.body}>Regulatory alerts: {queue.regulatoryAlerts.length}</Text>
            <Text style={styles.note}>Publication decisions are made through the reviewer-only service. This route does not expose raw documents or reviewer identities.</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 24 },
  eyebrow: { color: colors.accent, fontFamily: fonts.bodyMedium, fontSize: 12, letterSpacing: 0 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 32, lineHeight: 38 },
  body: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  card: { ...cardSurface, borderColor: colors.hairline, borderRadius: 16, borderWidth: 1, gap: 8, padding: 18 },
  note: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 8 }
});
