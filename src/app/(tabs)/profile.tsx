import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { Avatar, Button, Card, Chip, Field, Row, Screen, Segmented, T } from '@/components/ui';
import { useAuth, type Role } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Sitter = {
  bio: string;
  area: string;
  hourly_rate: number | null;
  hosts_at_home: boolean;
  bit_phone: string | null;
  bit_link: string | null;
  id_verified: boolean;
  police_status: string;
  is_listed: boolean;
};

export default function Profile() {
  const t = useTheme();
  const { session, profile, activeRole, setActiveRole, signOut } = useAuth();
  const [s, setS] = useState<Sitter | null>(null);
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const isSitter = profile?.roles.includes('sitter');
  const both = profile?.roles.length === 2;

  useEffect(() => {
    if (!isSitter || !session) return;
    supabase
      .from('sitter_profiles')
      .select('bio, area, hourly_rate, hosts_at_home, bit_phone, bit_link, id_verified, police_status, is_listed')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setS(data as Sitter);
          setRate(data.hourly_rate ? String(data.hourly_rate) : '');
        }
      });
  }, [isSitter, session]);

  async function save() {
    if (!s || !session) return;
    setMsg('');
    const r = rate ? Number(rate) : null;
    if (r !== null && (!Number.isInteger(r) || r < 20 || r > 300)) return setMsg('תעריף לשעה בין ₪20 ל-₪300');
    if (s.bit_link && !s.bit_link.startsWith('https://')) return setMsg('קישור הביט צריך להתחיל ב-https://');
    setBusy(true);
    const { error } = await supabase
      .from('sitter_profiles')
      .update({
        bio: s.bio,
        area: s.area,
        hourly_rate: r,
        hosts_at_home: s.hosts_at_home,
        bit_phone: s.bit_phone || null,
        bit_link: s.bit_link || null,
      })
      .eq('id', session.user.id);
    setBusy(false);
    setMsg(error ? 'השמירה נכשלה. נסו שוב.' : '✓ נשמר');
  }

  function confirmSignOut() {
    Alert.alert('יציאה מהחשבון', 'לצאת מהחשבון במכשיר הזה?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'יציאה',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/sign-in');
        },
      },
    ]);
  }

  if (!profile) return null;
  const set = (patch: Partial<Sitter>) => setS((cur) => (cur ? { ...cur, ...patch } : cur));

  return (
    <Screen>
      <Row>
        <Avatar name={profile.full_name} size={64} />
        <View style={{ gap: 4 }}>
          <T variant="h2">{profile.full_name}</T>
          <T variant="muted">{session?.user.phone ? `+${session.user.phone}` : session?.user.email}</T>
        </View>
      </Row>

      {both ? (
        <Card>
          <T variant="h3">אני עכשיו בתור</T>
          <Segmented<Role>
            options={[
              ['parent', 'הורה'],
              ['sitter', 'בייביסיטר'],
            ]}
            value={activeRole}
            onChange={setActiveRole}
          />
        </Card>
      ) : null}

      {isSitter && activeRole === 'sitter' && s ? (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="h3">סטטוס</T>
              <Chip tone={s.is_listed ? 'ok' : 'honey'} label={s.is_listed ? 'מופיעה בחיפוש' : 'ממתינה לאימות'} />
            </Row>
            <Row style={{ gap: 6 }}>
              <Chip tone={s.id_verified ? 'ok' : 'plain'} label={s.id_verified ? '✓ זהות מאומתת' : 'זהות לא אומתה'} />
              <Chip
                tone={s.police_status === 'approved' ? 'acc' : 'plain'}
                label={{ none: 'אין אישור משטרה', review: 'אישור משטרה בבדיקה', approved: 'אישור משטרה נבדק', rejected: 'אישור משטרה נדחה' }[s.police_status] ?? ''}
              />
            </Row>
            <T variant="muted">העלאת תעודת זהות, סלפי, סרטון היכרות ואישור משטרה – בשלב הבא של הפיתוח.</T>
          </Card>
          <Card>
            <T variant="h3">הפרופיל שלי</T>
            <Field label="קצת עליי" value={s.bio} onChangeText={(v) => set({ bio: v })} multiline maxLength={1000} />
            <Field label="אזור" value={s.area} onChangeText={(v) => set({ area: v })} placeholder="למשל: רמת החייל" maxLength={60} />
            <Field label="תעריף לשעה (₪)" value={rate} onChangeText={(v) => setRate(v.replace(/\D/g, ''))} keyboardType="number-pad" ltr />
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="small">אפשר לשמור אצלי בבית</T>
              <Switch value={s.hosts_at_home} onValueChange={(v) => set({ hosts_at_home: v })} />
            </Row>
          </Card>
          <Card>
            <T variant="h3">תשלום בביט</T>
            <T variant="muted">ההורים יראו את הפרטים האלה בסיום כל משמרת.</T>
            <Field label="מספר טלפון בביט" value={s.bit_phone ?? ''} onChangeText={(v) => set({ bit_phone: v })} keyboardType="phone-pad" ltr />
            <Field
              label="קישור לתשלום בביט"
              value={s.bit_link ?? ''}
              onChangeText={(v) => set({ bit_link: v.trim() })}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://"
              ltr
            />
          </Card>
          {msg ? <T style={{ color: msg.startsWith('✓') ? t.ok : t.bad }}>{msg}</T> : null}
          <Button title="שמירה" onPress={save} loading={busy} />
        </>
      ) : null}

      <Button kind="secondary" title="יציאה מהחשבון" onPress={confirmSignOut} />
    </Screen>
  );
}
