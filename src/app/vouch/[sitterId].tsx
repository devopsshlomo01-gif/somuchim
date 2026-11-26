import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Field, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const RELATIONS = ['שכן/ה', 'משפחה', 'מעסיק/ה קודם/ת', 'מורה או מדריך/ה', 'חבר/ה של המשפחה'];
const KNOWN = ['פחות משנה', '1–3 שנים', 'יותר מ-3 שנים'];

function Choice({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: on ? t.accent : t.line,
              backgroundColor: on ? t.accentSoft : t.surface,
            }}>
            <T variant="small" style={{ color: on ? t.accent : t.fg, fontWeight: '600' }}>
              {o}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Vouch() {
  const t = useTheme();
  const { session } = useAuth();
  const { sitterId, name } = useLocalSearchParams<{ sitterId: string; name?: string }>();
  const [relation, setRelation] = useState('');
  const [known, setKnown] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function publish() {
    setErr('');
    if (!relation || !known) return setErr('בחרו סוג קשר וכמה זמן אתם מכירים');
    if (body.trim().length < 5) return setErr('כתבו כמה מילים');
    setBusy(true);
    const { error } = await supabase.from('vouches').insert({
      sitter_id: sitterId,
      author_id: session!.user.id,
      relation,
      known_for: known,
      body: body.trim(),
    });
    setBusy(false);
    if (error) return setErr(error.code === '23505' ? 'כבר כתבת המלצה עליה.' : 'הפרסום נכשל. נסו שוב.');
    router.back();
  }

  return (
    <Screen header>
      <T variant="h2">מאיפה את/ה מכיר/ה {name ? name.split(' ')[0] : 'אותה'}?</T>
      <Card>
        <T variant="h3">סוג הקשר</T>
        <Choice options={RELATIONS} value={relation} onChange={setRelation} />
        <T variant="h3">כמה זמן?</T>
        <Choice options={KNOWN} value={known} onChange={setKnown} />
      </Card>
      <Field label="למה אפשר לסמוך עליה?" value={body} onChangeText={setBody} multiline maxLength={600} />
      <T variant="muted">המלצה אחת לכל אדם. היא מוצגת בנפרד מהציונים ולא משנה אותם.</T>
      {err ? <T style={{ color: t.bad }}>{err}</T> : null}
      <Button title="פרסום המלצה" onPress={publish} loading={busy} />
    </Screen>
  );
}
