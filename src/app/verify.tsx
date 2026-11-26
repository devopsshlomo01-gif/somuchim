import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, Field, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { PICK_ERROR, pickDocument, pickPhoto, uploadFile, type Picked } from '@/lib/upload';
import { fullNameOk, isValidIsraeliId } from '@/lib/validate';

function Slot({ label, hint, file, onPick, isDoc }: { label: string; hint: string; file: Picked | null; onPick: () => void; isDoc?: boolean }) {
  const t = useTheme();
  return (
    <Card soft>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="h3">{label}</T>
          <T variant="muted">{hint}</T>
        </View>
        {file && !isDoc && file.mime.startsWith('image/') ? (
          <Image source={{ uri: file.uri }} style={{ width: 56, height: 56, borderRadius: 8 }} contentFit="cover" />
        ) : file ? (
          <T style={{ color: t.ok, fontWeight: '700' }}>✓ נבחר</T>
        ) : null}
      </Row>
      <Button kind="secondary" title={file ? 'החלפה' : 'בחירה'} onPress={onPick} />
    </Card>
  );
}

export default function Verify() {
  const t = useTheme();
  const { session, profile } = useAuth();
  const { kind } = useLocalSearchParams<{ kind: 'identity' | 'police' }>();
  const uid = session!.user.id;
  const identity = kind !== 'police';

  const [name, setName] = useState(profile?.full_name ?? '');
  const [idNum, setIdNum] = useState('');
  const [birth, setBirth] = useState('');
  const [idImg, setIdImg] = useState<Picked | null>(null);
  const [selfie, setSelfie] = useState<Picked | null>(null);
  const [doc, setDoc] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const birthIso = (() => {
    const m = birth.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (!m) return null;
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  })();

  async function pick(setter: (p: Picked) => void, fn: () => ReturnType<typeof pickPhoto>) {
    const r = await fn();
    if (r.ok) setter(r.file);
    else if (PICK_ERROR[r.reason]) Alert.alert(PICK_ERROR[r.reason]);
  }

  async function submit() {
    setErr('');
    if (identity) {
      if (!fullNameOk(name)) return setErr('כתבו שם מלא כמו בתעודת הזהות');
      if (!isValidIsraeliId(idNum)) return setErr('מספר תעודת הזהות לא תקין. בדקו את הספרות.');
      if (!birthIso) return setErr('תאריך לידה בפורמט 15.03.2007');
      if (!idImg || !selfie) return setErr('צריך צילום של תעודת הזהות וסלפי');
    } else if (!doc) {
      return setErr('בחרו את קובץ האישור');
    }
    setBusy(true);
    try {
      const files = identity
        ? [await uploadFile('documents', uid, 'id-card', idImg!), await uploadFile('documents', uid, 'selfie', selfie!)]
        : [await uploadFile('documents', uid, 'police', doc!)];
      const { error } = await supabase.from('verification_requests').insert({
        kind: identity ? 'identity' : 'police',
        full_name_on_id: identity ? name.trim() : null,
        id_last4: identity ? idNum.trim().padStart(9, '0').slice(-4) : null,
        birth_date: identity ? birthIso : null,
        files,
      });
      if (error) throw error;
      Alert.alert('נשלח לבדיקה', 'הצוות בודק בדרך כלל תוך 24 שעות.');
      router.back();
    } catch {
      setErr('השליחה נכשלה. בדקו את החיבור ונסו שוב.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header>
      <Stack.Screen options={{ title: identity ? 'אימות זהות' : 'אישור משטרה' }} />
      {identity ? (
        <>
          <T variant="muted">הפרטים נשמרים מוצפנים ונבדקים על ידי הצוות. מספר הזהות המלא לא נשמר ולא מוצג לאף אחד.</T>
          <Card>
            <Field label="שם מלא כמו בתעודת הזהות" value={name} onChangeText={setName} autoComplete="name" />
            <Field
              label="מספר תעודת זהות"
              value={idNum}
              onChangeText={(v) => setIdNum(v.replace(/\D/g, '').slice(0, 9))}
              keyboardType="number-pad"
              ltr
              hint={idNum.length >= 5 ? (isValidIsraeliId(idNum) ? '✓ מספר תקין' : 'ספרת הביקורת לא מתאימה') : undefined}
            />
            <Field label="תאריך לידה" value={birth} onChangeText={setBirth} placeholder="15.03.2007" keyboardType="numbers-and-punctuation" ltr />
            <T variant="muted">מתחת לגיל 18 נבקש גם אישור הורה.</T>
          </Card>
          <Slot label="צילום תעודת הזהות" hint="הצד עם התמונה, כל הפרטים קריאים" file={idImg} onPick={() => pick(setIdImg, () => pickPhoto('camera'))} />
          <Slot label="סלפי" hint="פנים מלאות, בלי משקפי שמש" file={selfie} onPick={() => pick(setSelfie, () => pickPhoto('camera', true))} />
        </>
      ) : (
        <>
          <T variant="muted">
            {'אישור על היעדר עבירות מין. אחרי בדיקת הצוות יופיע בפרופיל שלך התג "אישור משטרה נבדק". המסמך עצמו לא מוצג להורים.'}
          </T>
          <Slot
            label="קובץ האישור"
            hint="עדיף ה-PDF המקורי שקיבלת, בלי לפתוח ולשמור אותו בתוכנה אחרת"
            file={doc}
            isDoc
            onPick={() => pick(setDoc, pickDocument)}
          />
        </>
      )}
      {err ? <T style={{ color: t.bad }}>{err}</T> : null}
      <Button title="שליחה לבדיקה" onPress={submit} loading={busy} />
    </Screen>
  );
}
