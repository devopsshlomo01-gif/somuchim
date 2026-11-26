import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Button, Card, Field, Row, Screen, Segmented, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { addDays, dayLabel, durationMinutes, fromMinutes, hoursLabel, israelToday, toMinutes } from '@/lib/booking';
import { nis, type SitterCard } from '@/lib/sitters';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Loc = 'parent_home' | 'sitter_home';

function TimeStepper({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  const step = (d: number) => onChange(fromMinutes(toMinutes(value) + d));
  const btn = (txt: string, d: number, a11y: string) => (
    <Pressable
      onPress={() => step(d)}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface }}>
      <T variant="h3">{txt}</T>
    </Pressable>
  );
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <T variant="small" style={{ fontWeight: '600' }}>
        {label}
      </T>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        {btn('−', -30, `${label} מוקדם יותר`)}
        <T variant="h2" style={{ writingDirection: 'ltr', fontVariant: ['tabular-nums'] }}>
          {value}
        </T>
        {btn('+', 30, `${label} מאוחר יותר`)}
      </Row>
    </View>
  );
}

export default function NewRequest() {
  const t = useTheme();
  const { session } = useAuth();
  const { sitterId } = useLocalSearchParams<{ sitterId: string }>();
  const [sitter, setSitter] = useState<SitterCard | null>(null);
  const today = israelToday();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const [loc, setLoc] = useState<Loc>('parent_home');
  const [date, setDate] = useState(days[0]);
  const [from, setFrom] = useState('19:00');
  const [to, setTo] = useState('23:00');
  const [kids, setKids] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase
      .from('sitter_cards')
      .select('*')
      .eq('id', sitterId)
      .maybeSingle()
      .then(({ data }) => setSitter((data as SitterCard) ?? null));
  }, [sitterId]);

  const mins = durationMinutes(from, to);
  const estimate = sitter?.hourly_rate ? Math.round((mins / 60) * sitter.hourly_rate) : null;
  const firstName = sitter?.full_name.split(' ')[0] ?? '';

  async function send() {
    setErr('');
    if (mins > 14 * 60) return setErr('משמרת יכולה להיות עד 14 שעות');
    if (!kids.trim()) return setErr('כתבו כמה ילדים ובאילו גילאים');
    setBusy(true);
    const { error } = await supabase.from('booking_requests').insert({
      parent_id: session!.user.id,
      sitter_id: sitterId,
      location: loc,
      start_date: date,
      start_time: from,
      end_time: to,
      kids: kids.trim(),
      notes: notes.trim(),
    });
    setBusy(false);
    if (error) return setErr('השליחה נכשלה. נסו שוב.');
    router.replace({ pathname: '/shifts', params: { sent: '1' } });
  }

  return (
    <Screen header>
      <T variant="h2">בקשת שמירה{firstName ? ` מ${firstName}` : ''}</T>

      <Card>
        <T variant="h3">איפה?</T>
        <Segmented<Loc>
          options={
            sitter?.hosts_at_home
              ? [
                  ['parent_home', 'אצלנו בבית'],
                  ['sitter_home', 'אצל הבייביסיטר'],
                ]
              : [['parent_home', 'אצלנו בבית']]
          }
          value={loc}
          onChange={setLoc}
        />
        {loc === 'parent_home' ? <T variant="muted">פרטי הבית נשלחים לבייביסיטר רק אחרי שהיא מאשרת.</T> : null}
      </Card>

      <Card>
        <T variant="h3">מתי?</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {days.map((d, i) => {
            const on = d === date;
            const { day, date: dd } = dayLabel(d);
            return (
              <Pressable
                key={d}
                onPress={() => setDate(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`יום ${day} ${dd}`}
                style={{
                  width: 62,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  alignItems: 'center',
                  borderColor: on ? t.accent : t.line,
                  backgroundColor: on ? t.accent : t.surface,
                }}>
                <T variant="small" style={{ color: on ? t.accentFg : t.muted, textAlign: 'center' }}>
                  {i === 0 ? 'היום' : i === 1 ? 'מחר' : day}
                </T>
                <T variant="h3" style={{ color: on ? t.accentFg : t.fg, textAlign: 'center' }}>
                  {dd}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TimeStepper label="משעה" value={from} onChange={setFrom} />
          <TimeStepper label="עד שעה" value={to} onChange={setTo} />
        </View>
        <T variant="muted">
          {hoursLabel(mins)}
          {toMinutes(to) <= toMinutes(from) ? ' · מסתיים אחרי חצות' : ''}
          {estimate !== null ? ` · משוער ${nis(estimate)}` : ''}
        </T>
      </Card>

      <Card>
        <Field label="ילדים וגילאים" value={kids} onChangeText={setKids} placeholder="למשל: 2 (גילאי 3 ו-6)" maxLength={200} />
        <Field
          label="הערות (אלרגיות, חיות, שגרת שינה)"
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={1000}
          placeholder="למשל: הקטנה אלרגית לבוטנים, הולכת לישון ב-20:00"
        />
      </Card>

      {err ? <T style={{ color: t.bad }}>{err}</T> : null}
      <Button title="שליחת בקשה" onPress={send} loading={busy} disabled={!sitter} />
    </Screen>
  );
}
