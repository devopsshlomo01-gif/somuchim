import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Card, Field, Segmented, Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { digits, isEmail, isIsraeliMobile, toE164 } from '@/lib/validate';

type Method = 'sms' | 'email';
const RESEND_SECONDS = 30;

export default function SignIn() {
  const t = useTheme();
  const [step, setStep] = useState<'contact' | 'code'>('contact');
  const [method, setMethod] = useState<Method>('sms');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const h = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(h);
  }, [wait]);

  async function send() {
    setErr('');
    if (method === 'sms' && !isIsraeliMobile(phone)) return setErr('מספר הנייד צריך להיות 10 ספרות ולהתחיל ב-05');
    if (method === 'email' && !isEmail(email)) return setErr('כתובת המייל לא תקינה. למשל name@gmail.com');
    setBusy(true);
    const { error } =
      method === 'sms'
        ? await supabase.auth.signInWithOtp({ phone: toE164(phone) })
        : await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      setErr(error.status === 429 ? 'נשלחו יותר מדי קודים. נסו שוב בעוד כמה דקות.' : 'לא הצלחנו לשלוח את הקוד. נסו שוב.');
      return;
    }
    setCode('');
    setWait(RESEND_SECONDS);
    setStep('code');
    setTimeout(() => codeRef.current?.focus(), 300);
  }

  async function verify(value = code) {
    if (value.length !== 6) return;
    setErr('');
    setBusy(true);
    const { error } =
      method === 'sms'
        ? await supabase.auth.verifyOtp({ phone: toE164(phone), token: value, type: 'sms' })
        : await supabase.auth.verifyOtp({ email: email.trim(), token: value, type: 'email' });
    setBusy(false);
    if (error) {
      setErr('הקוד שגוי או שפג תוקפו. בדקו ונסו שוב, או בקשו קוד חדש.');
      return;
    }
    router.replace('/');
  }

  const head = (
    <View style={{ alignItems: 'center', gap: 4, paddingVertical: 16 }}>
      <T variant="title" style={{ textAlign: 'center', fontSize: 38 }}>
        סמוכים
      </T>
      <T variant="muted" style={{ textAlign: 'center' }}>
        בייביסיטר מהשכונה, שאפשר לסמוך עליה
      </T>
    </View>
  );

  if (step === 'code') {
    const to = method === 'sms' ? `${digits(phone).slice(0, 3)}-${digits(phone).slice(3)}` : email.trim();
    return (
      <Screen>
        {head}
        <Card>
          <Button kind="link" title="→ שינוי פרטים" onPress={() => setStep('contact')} />
          <T variant="h2">הזנת קוד</T>
          <T variant="small">
            שלחנו קוד בן 6 ספרות {method === 'sms' ? 'ב-SMS' : 'במייל'} ל-{'⁦'}
            {to}
            {'⁩'}
          </T>
          <TextInput
            ref={codeRef}
            value={code}
            onChangeText={(v) => {
              const c = v.replace(/\D/g, '').slice(0, 6);
              setCode(c);
              if (c.length === 6) verify(c);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={6}
            placeholder="––––––"
            placeholderTextColor={t.muted}
            accessibilityLabel="קוד אימות"
            style={{
              borderWidth: 1,
              borderColor: t.line,
              borderRadius: 10,
              backgroundColor: t.surface,
              color: t.fg,
              fontSize: 28,
              fontWeight: '700',
              letterSpacing: 10,
              textAlign: 'center',
              writingDirection: 'ltr',
              paddingVertical: 12,
            }}
          />
          {err ? <T style={{ color: t.bad }}>{err}</T> : null}
          <Button title="אישור" onPress={() => verify()} loading={busy} disabled={code.length !== 6} />
          {wait > 0 ? (
            <T variant="muted">אפשר לשלוח שוב בעוד {wait} שניות</T>
          ) : (
            <Button kind="link" title="שליחה חוזרת" onPress={send} />
          )}
          {method === 'email' ? <T variant="muted">לא מוצאים? בדקו בתיקיית הספאם או בקידומי מכירות.</T> : null}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      {head}
      <Card>
        <T variant="h2">כניסה או הרשמה</T>
        <T variant="muted">בלי סיסמה. נשלח לך קוד חד-פעמי.</T>
        <Segmented<Method>
          options={[
            ['sms', 'SMS'],
            ['email', 'מייל'],
          ]}
          value={method}
          onChange={(m) => {
            setMethod(m);
            setErr('');
          }}
        />
        {method === 'sms' ? (
          <Field
            label="מספר נייד"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            placeholder="050-1234567"
            ltr
          />
        ) : (
          <Field
            label="כתובת מייל"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="name@example.com"
            ltr
          />
        )}
        {err ? <T style={{ color: t.bad }}>{err}</T> : null}
        <Button title="שליחת קוד" onPress={send} loading={busy} />
      </Card>
      <T variant="muted" style={{ textAlign: 'center' }}>
        בהמשך תתבקשו לאשר את תנאי השימוש ומדיניות הפרטיות.
      </T>
    </Screen>
  );
}
