import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { Avatar, Card, Chip, Row, Screen, T } from '@/components/ui';
import { colorFor, nis, type SitterCard } from '@/lib/sitters';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Filter = 'all' | 'home' | 'police' | 'adult';
const FILTERS: [Filter, string][] = [
  ['all', 'הכול'],
  ['home', 'שמירה אצלה'],
  ['police', 'אישור משטרה'],
  ['adult', '18+'],
];

export default function Search() {
  const t = useTheme();
  const [list, setList] = useState<SitterCard[] | null>(null);
  const [err, setErr] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      supabase
        .from('sitter_cards')
        .select('*')
        .order('rating', { ascending: false })
        .limit(100)
        .then(({ data, error }) => {
          if (!alive) return;
          setErr(Boolean(error));
          setList((data as SitterCard[]) ?? []);
        });
      return () => {
        alive = false;
      };
    }, []),
  );

  const shown = (list ?? []).filter(
    (s) =>
      filter === 'all' ||
      (filter === 'home' && s.hosts_at_home) ||
      (filter === 'police' && s.police_ok) ||
      (filter === 'adult' && (s.age ?? 0) >= 18),
  );

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="h2">בייביסיטר באזור</T>
        {list ? <T variant="muted">{shown.length} מאומתות</T> : null}
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {FILTERS.map(([k, l]) => {
          const on = filter === k;
          return (
            <Pressable
              key={k}
              onPress={() => setFilter(k)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: on ? t.accent : t.line,
                backgroundColor: on ? t.accent : t.surface,
              }}>
              <T variant="small" style={{ color: on ? t.accentFg : t.fg, fontWeight: '600' }}>
                {l}
              </T>
            </Pressable>
          );
        })}
      </ScrollView>

      {list === null ? <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} /> : null}
      {err ? <T style={{ color: t.bad }}>לא הצלחנו לטעון את הרשימה. בדקו את החיבור לאינטרנט.</T> : null}
      {list && !err && shown.length === 0 ? (
        <Card soft>
          <T variant="h3">עוד אין בייביסיטריות מאומתות כאן</T>
          <T variant="muted">בייביסיטריות מופיעות בחיפוש אחרי שהצוות אישר את הזהות שלהן.</T>
        </Card>
      ) : null}

      {shown.map((s) => (
        <Pressable key={s.id} onPress={() => router.push({ pathname: '/sitter/[id]', params: { id: s.id } })} accessibilityRole="button">
          <Card>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Avatar name={s.full_name} color={colorFor(s.id)} />
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="h3">
                  {s.full_name}
                  {s.age ? `, ${s.age}` : ''}
                </T>
                {s.area ? <T variant="muted">{s.area}</T> : null}
                <Row style={{ gap: 6 }}>
                  {s.id_verified ? <Chip tone="ok" label="✓ זהות מאומתת" /> : null}
                  {s.police_ok ? <Chip tone="acc" label="אישור משטרה נבדק" /> : null}
                  {s.hosts_at_home ? <Chip label="שומרת אצלה" /> : null}
                </Row>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <T style={{ color: t.honey, fontWeight: '700' }}>★ {s.review_count ? s.rating : '—'}</T>
                <T variant="muted">{s.review_count} ביקורות</T>
                <T variant="muted">{s.vouch_count} מכירים</T>
                {s.hourly_rate ? <T style={{ fontWeight: '700' }}>{nis(s.hourly_rate)}/ש׳</T> : null}
              </View>
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
