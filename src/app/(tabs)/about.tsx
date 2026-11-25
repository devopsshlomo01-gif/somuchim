import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Chip, Field, Row, Screen, Segmented, Stars, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { APP_VERSION, useTheme } from '@/lib/theme';

type Kind = 'הצעה' | 'תקלה' | 'מחמאה';
type Msg = { id: string; kind: Kind; rating: number | null; body: string; reply_to: string | null; role: string | null; created_at: string };

const DEVELOPER = 'Shlomo Davidi';
const PLACEHOLDER: Record<Kind, string> = {
  הצעה: 'מה היה עוזר לך? איזו אפשרות חסרה?',
  תקלה: 'מה ניסית לעשות, מה קרה, ובאיזה מסך?',
  מחמאה: 'מה אהבת באפליקציה?',
};

export default function About() {
  const t = useTheme();
  const { profile, activeRole } = useAuth();
  const [kind, setKind] = useState<Kind>('הצעה');
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [inbox, setInbox] = useState<Msg[]>([]);

  const loadInbox = useCallback(() => {
    if (!profile?.is_staff) return;
    supabase
      .from('feedback_messages')
      .select('id, kind, rating, body, reply_to, role, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setInbox((data as Msg[]) ?? []));
  }, [profile?.is_staff]);
  useFocusEffect(loadInbox);

  async function send() {
    if (body.trim().length < 3) {
      setNote({ ok: false, text: 'כתבו כמה מילים לפני השליחה' });
      return;
    }
    setBusy(true);
    setNote(null);
    const { error } = await supabase.from('feedback_messages').insert({
      kind,
      rating: rating || null,
      body: body.trim(),
      reply_to: reply.trim() || null,
      role: activeRole,
      app_version: APP_VERSION,
    });
    setBusy(false);
    if (error) {
      setNote({ ok: false, text: 'השליחה נכשלה. נסו שוב בעוד רגע.' });
      return;
    }
    setBody('');
    setReply('');
    setRating(0);
    setNote({ ok: true, text: '✓ ההודעה נשלחה למפתח. תודה!' });
    loadInbox();
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 4, paddingVertical: 8 }}>
        <T variant="title" style={{ textAlign: 'center', fontSize: 36 }}>
          סמוכים
        </T>
        <T variant="muted" style={{ textAlign: 'center' }}>
          בייביסיטר מהשכונה, שאפשר לסמוך עליה
        </T>
        <T variant="muted" style={{ textAlign: 'center' }}>
          גרסה {APP_VERSION}
        </T>
      </View>

      <Card>
        <T variant="h3">על האפליקציה</T>
        <T>
          סמוכים מחברת בין הורים לבייביסיטרים מהשכונה. האמון נבנה משני מקורות: ביקורות ממשמרות אמיתיות, והמלצות של
          אנשים שמכירים את הבייביסיטר אישית.
        </T>
      </Card>

      <Card>
        <T variant="h3">המפתח</T>
        <Row>
          <Avatar name="S D" size={56} color="#35608F" />
          <View>
            <T variant="h3" style={{ writingDirection: 'ltr' }}>
              {DEVELOPER}
            </T>
            <T variant="muted">פיתוח ועיצוב האפליקציה</T>
          </View>
        </Row>
      </Card>

      {profile?.is_staff ? (
        <Card style={{ borderColor: t.accent }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h3">הודעות שהתקבלו</T>
            <Chip tone="acc" label={String(inbox.length)} />
          </Row>
          <T variant="muted">מוצג רק לצוות. כל הודעה נשלחת גם למייל שלך.</T>
          {inbox.length === 0 ? <T variant="muted">עוד לא התקבלו הודעות.</T> : null}
          {inbox.map((m) => (
            <View key={m.id} style={{ gap: 4, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ gap: 6 }}>
                  <Chip tone={m.kind === 'תקלה' ? 'warn' : m.kind === 'מחמאה' ? 'ok' : 'acc'} label={m.kind} />
                  {m.rating ? <T style={{ color: t.honey }}>{'★'.repeat(m.rating)}</T> : null}
                </Row>
                <T variant="muted">{new Date(m.created_at).toLocaleString('he-IL')}</T>
              </Row>
              <T selectable>{m.body}</T>
              {m.reply_to ? <T variant="muted" selectable>לחזרה: {m.reply_to}</T> : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <T variant="h3">שליחת הודעה למפתח</T>
        <T variant="muted">רעיון, תקלה או סתם מילה טובה – ההודעה מגיעה ישירות אליי.</T>
        <Segmented<Kind>
          options={[
            ['הצעה', 'הצעה'],
            ['תקלה', 'תקלה'],
            ['מחמאה', 'מחמאה'],
          ]}
          value={kind}
          onChange={setKind}
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="small" style={{ fontWeight: '600' }}>
            איך האפליקציה בעינייך?
          </T>
          <Stars value={rating} onChange={setRating} />
        </Row>
        <Field label="ההודעה שלך" value={body} onChangeText={setBody} multiline maxLength={2000} placeholder={PLACEHOLDER[kind]} />
        <Field
          label="מייל או טלפון לחזרה (רשות)"
          value={reply}
          onChangeText={setReply}
          autoCapitalize="none"
          maxLength={120}
          ltr
        />
        {note ? <T style={{ color: note.ok ? t.ok : t.bad }}>{note.text}</T> : null}
        <Button title="שליחה" onPress={send} loading={busy} disabled={body.trim().length < 3} />
      </Card>

      <View style={{ alignItems: 'center', gap: 4, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 14 }}>
        <T variant="small" style={{ textAlign: 'center', writingDirection: 'ltr' }}>
          Created <T variant="small" style={{ fontWeight: '700' }}>{DEVELOPER}</T>
        </T>
        <T variant="muted" style={{ textAlign: 'center' }}>
          © 2026 סמוכים
        </T>
      </View>
    </Screen>
  );
}
