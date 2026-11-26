import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Avatar, Button, Card, Chip, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colorFor, nis, type SitterCard } from '@/lib/sitters';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Review = { id: string; body: string; created_at: string; reliability: number; punctuality: number; with_kids: number; communication: number };
type Vouch = { id: string; relation: string; known_for: string; body: string };

export default function SitterProfile() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, activeRole } = useAuth();
  const [s, setS] = useState<SitterCard | null | undefined>(undefined);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [vouches, setVouches] = useState<Vouch[]>([]);

  useEffect(() => {
    (async () => {
      const [card, rv, vc] = await Promise.all([
        supabase.from('sitter_cards').select('*').eq('id', id).maybeSingle(),
        supabase.from('reviews').select('id, body, created_at, reliability, punctuality, with_kids, communication').eq('sitter_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('vouches').select('id, relation, known_for, body').eq('sitter_id', id).limit(20),
      ]);
      setS((card.data as SitterCard) ?? null);
      setReviews((rv.data as Review[]) ?? []);
      setVouches((vc.data as Vouch[]) ?? []);
    })();
  }, [id]);

  if (s === undefined) return <ActivityIndicator color={t.accent} style={{ marginTop: 60 }} />;
  if (s === null)
    return (
      <Screen>
        <T variant="h3">הפרופיל לא זמין</T>
      </Screen>
    );

  const avg = (r: Review) => (r.reliability + r.punctuality + r.with_kids + r.communication) / 4;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Avatar name={s.full_name} size={76} color={colorFor(s.id)} />
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="h2">
            {s.full_name}
            {s.age ? `, ${s.age}` : ''}
          </T>
          {s.area ? <T variant="muted">{s.area}</T> : null}
          <Row style={{ gap: 6 }}>
            {s.id_verified ? <Chip tone="ok" label="✓ זהות מאומתת" /> : null}
            {s.police_ok ? <Chip tone="acc" label="אישור משטרה נבדק" /> : null}
            {s.age !== null && s.age < 18 ? <Chip tone="warn" label="קטינה · אישור הורה בתיק" /> : null}
          </Row>
        </View>
      </View>
      {s.bio ? <T>{s.bio}</T> : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card soft style={{ flex: 1 }}>
          <T variant="muted">ציון ממשמרות</T>
          <T variant="big">{s.review_count ? s.rating : '—'}</T>
          <T variant="muted">{s.review_count} ביקורות מאומתות</T>
        </Card>
        <Card soft style={{ flex: 1 }}>
          <T variant="muted">מכירים אותה אישית</T>
          <T variant="big">{s.vouch_count}</T>
          <T variant="muted">המלצות היכרות</T>
        </Card>
      </View>

      <Card>
        <T variant="h3">ביקורות ממשמרות</T>
        {reviews.length ? (
          reviews.map((r) => (
            <View key={r.id} style={{ gap: 2, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T style={{ color: t.honey, fontWeight: '700' }}>{'★'.repeat(Math.round(avg(r)))}</T>
                <T variant="muted">{new Date(r.created_at).toLocaleDateString('he-IL')}</T>
              </Row>
              {r.body ? <T>{r.body}</T> : null}
            </View>
          ))
        ) : (
          <T variant="muted">עוד אין ביקורות.</T>
        )}
      </Card>

      <Card>
        <T variant="h3">אנשים שמכירים אותה</T>
        {vouches.length ? (
          vouches.map((v) => (
            <View key={v.id} style={{ gap: 4 }}>
              <Row style={{ gap: 6 }}>
                <Chip label={v.relation} />
                <T variant="muted">{v.known_for}</T>
              </Row>
              <T>{v.body}</T>
            </View>
          ))
        ) : (
          <T variant="muted">עוד אין המלצות היכרות.</T>
        )}
      </Card>

      <Card soft>
        {s.hourly_rate ? <T variant="h3">{nis(s.hourly_rate)} לשעה</T> : null}
        {activeRole === 'parent' && session?.user.id !== s.id ? (
          <Button title="שליחת בקשת שמירה" onPress={() => router.push({ pathname: '/request/[sitterId]', params: { sitterId: s.id } })} />
        ) : null}
      </Card>
    </Screen>
  );
}
