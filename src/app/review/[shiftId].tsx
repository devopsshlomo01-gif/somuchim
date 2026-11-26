import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, Card, Field, Row, Screen, Stars, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { ShiftCard } from '@/lib/booking';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const CATS = [
  ['reliability', 'אמינות'],
  ['punctuality', 'דייקנות'],
  ['with_kids', 'יחס לילדים'],
  ['communication', 'תקשורת'],
] as const;
type Cat = (typeof CATS)[number][0];

export default function Review() {
  const t = useTheme();
  const { session } = useAuth();
  const { shiftId } = useLocalSearchParams<{ shiftId: string }>();
  const [shift, setShift] = useState<ShiftCard | null>(null);
  const [scores, setScores] = useState<Record<Cat, number>>({ reliability: 0, punctuality: 0, with_kids: 0, communication: 0 });
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase
      .from('shift_cards')
      .select('*')
      .eq('id', shiftId)
      .maybeSingle()
      .then(({ data }) => setShift((data as ShiftCard) ?? null));
  }, [shiftId]);

  const complete = CATS.every(([k]) => scores[k] > 0);
  const first = shift?.sitter_name.split(' ')[0] ?? '';

  async function publish() {
    if (!shift) return;
    setBusy(true);
    setErr('');
    const { error } = await supabase.from('reviews').insert({
      shift_id: shift.id,
      sitter_id: shift.sitter_id,
      author_id: session!.user.id,
      ...scores,
      body: body.trim(),
    });
    setBusy(false);
    if (error) return setErr(error.code === '23505' ? 'כבר כתבת ביקורת על המשמרת הזו.' : 'הפרסום נכשל. נסו שוב.');
    router.back();
  }

  return (
    <Screen header>
      <T variant="h2">איך היה עם {first}?</T>
      <T variant="muted">הביקורת תתפרסם בפרופיל שלה, עם השם הפרטי שלך.</T>
      <Card>
        {CATS.map(([k, label]) => (
          <Row key={k} style={{ justifyContent: 'space-between' }}>
            <T>{label}</T>
            <Stars value={scores[k]} onChange={(n) => setScores((s) => ({ ...s, [k]: n }))} />
          </Row>
        ))}
      </Card>
      <Field label="כמה מילים להורים אחרים" value={body} onChangeText={setBody} multiline maxLength={1000} placeholder="מה היה טוב? מה כדאי לדעת?" />
      {err ? <T style={{ color: t.bad }}>{err}</T> : null}
      <Button title="פרסום" onPress={publish} loading={busy} disabled={!complete || !shift} />
      <Button kind="link" title="אחר כך" onPress={() => router.back()} />
    </Screen>
  );
}
