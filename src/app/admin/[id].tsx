import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, View } from 'react-native';

import { IntroVideo } from '@/components/media';
import { Button, Card, Field, Row, Screen, T } from '@/components/ui';
import type { QueueItem } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Doc = { path: string; url: string | null; isImage: boolean };

export default function ReviewVerification() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [v, setV] = useState<QueueItem | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [note, setNote] = useState('');
  const [issued, setIssued] = useState('');
  const [busy, setBusy] = useState(false);
  const [age, setAge] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('verification_queue').select('*').eq('id', id).maybeSingle();
      const item = data as QueueItem | null;
      setV(item);
      if (!item) return;
      if (item.birth_date) setAge(Math.floor((Date.now() - Date.parse(item.birth_date)) / (365.25 * 24 * 3600 * 1000)));
      const out: Doc[] = [];
      for (const path of item.files) {
        const { data: s } = await supabase.storage.from('documents').createSignedUrl(path, 600);
        out.push({ path, url: s?.signedUrl ?? null, isImage: /\.(jpe?g|png|heic|webp)$/i.test(path) });
      }
      setDocs(out);
    })();
  }, [id]);

  const issuedIso = (() => {
    const m = issued.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
  })();

  async function decide(approve: boolean) {
    if (!v) return;
    if (!approve && !note.trim()) return Alert.alert('כתבו למה נדחה', 'ההערה תוצג למבקשת כדי שתוכל לתקן.');
    if (approve && v.kind === 'police' && !issuedIso) return Alert.alert('תאריך הנפקה', 'הזינו את תאריך ההנפקה שמופיע במסמך, למשל 02.11.2026');
    setBusy(true);
    const { error } = await supabase.rpc('review_verification', {
      request_id: v.id,
      approve,
      note: note.trim() || null,
      police_issued: v.kind === 'police' ? issuedIso : null,
    });
    setBusy(false);
    if (error) return Alert.alert('העדכון נכשל', error.message);
    router.back();
  }

  if (!v) return <ActivityIndicator color={t.accent} style={{ marginTop: 60 }} />;

  return (
    <Screen header>
      <T variant="h2">{v.kind === 'identity' ? 'אימות זהות' : 'אישור משטרה'}</T>
      <Card>
        <T variant="h3">{v.full_name}</T>
        {v.kind === 'identity' ? (
          <>
            <T>שם בתעודה: {v.full_name_on_id}</T>
            <T>ת״ז מסתיימת ב: {v.id_last4}</T>
            <T>
              תאריך לידה: {v.birth_date ? new Date(v.birth_date).toLocaleDateString('he-IL') : '—'}
              {age !== null ? ` (גיל ${age})` : ''}
            </T>
            {age !== null && age < 18 ? <T style={{ color: t.warn, fontWeight: '700' }}>קטינה: לוודא אישור הורה לפני אישור.</T> : null}
          </>
        ) : null}
        <T variant="muted">
          {v.area ? `${v.area} · ` : ''}
          {v.hourly_rate ? `₪${v.hourly_rate} לשעה` : 'בלי תעריף'}
        </T>
      </Card>

      <T variant="h3">מסמכים</T>
      {docs.length === 0 ? <ActivityIndicator color={t.accent} /> : null}
      {docs.map((d) =>
        d.url && d.isImage ? (
          <Image key={d.path} source={{ uri: d.url }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12 }} contentFit="contain" />
        ) : (
          <Button key={d.path} kind="secondary" title="פתיחת המסמך (PDF)" onPress={() => d.url && Linking.openURL(d.url)} disabled={!d.url} />
        ),
      )}

      {v.kind === 'identity' ? (
        <>
          <T variant="h3">סרטון ההיכרות</T>
          <IntroVideo path={v.video_path} emptyText="לא הועלה סרטון" />
          <T variant="muted">בודקים: הפנים בסלפי ובסרטון תואמות לתמונה בתעודה, השם תואם, והתעודה לא נראית ערוכה.</T>
        </>
      ) : (
        <T variant="muted">בודקים: שם ותעודת זהות תואמים לבייביסיטר, המסמך לא ערוך, והונפק בשנה האחרונה.</T>
      )}

      {v.status === 'pending' ? (
        <Card>
          {v.kind === 'police' ? (
            <Field label="תאריך הנפקת האישור" value={issued} onChangeText={setIssued} placeholder="02.11.2026" keyboardType="numbers-and-punctuation" ltr />
          ) : null}
          <Field label="הערה (חובה בדחייה, מוצגת למבקשת)" value={note} onChangeText={setNote} multiline maxLength={500} />
          <Row style={{ flexWrap: 'nowrap' }}>
            <View style={{ flex: 1 }}>
              <Button title="אישור" onPress={() => decide(true)} loading={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button kind="secondary" title="דחייה" onPress={() => decide(false)} disabled={busy} />
            </View>
          </Row>
        </Card>
      ) : (
        <Card soft>
          <T>{v.status === 'approved' ? '✓ אושר' : 'נדחה'}</T>
          {v.staff_note ? <T variant="muted">{v.staff_note}</T> : null}
        </Card>
      )}
    </Screen>
  );
}
