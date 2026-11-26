import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { MediaEditor } from '@/components/media-editor';
import { Photo } from '@/components/media';
import { Button, Card, Chip, Field, Row, Screen, Segmented, T } from '@/components/ui';
import { useAuth, type Role } from '@/lib/auth';
import { sampleLocationOnce } from '@/lib/location';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Sitter = {
  bio: string;
  area: string;
  hourly_rate: number | null;
  hosts_at_home: boolean;
  bit_phone: string | null;
  bit_link: string | null;
  photo_path: string | null;
  video_path: string | null;
  lat: number | null;
  id_verified: boolean;
  police_status: string;
  police_expires: string | null;
  is_listed: boolean;
};
type Family = { about: string; area: string; photo_path: string | null; video_path: string | null; lat: number | null };
type Pending = { kind: 'identity' | 'police'; status: string; staff_note: string | null };

export default function Profile() {
  const t = useTheme();
  const { session, profile, activeRole, setActiveRole, signOut, refreshProfile } = useAuth();
  const [s, setS] = useState<Sitter | null>(null);
  const [f, setF] = useState<Family | null>(null);
  const [verif, setVerif] = useState<Pending[]>([]);
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const uid = session?.user.id ?? '';
  const isSitter = !!profile?.roles.includes('sitter');
  const isParent = !!profile?.roles.includes('parent');
  const both = isSitter && isParent;
  const sitterView = activeRole === 'sitter' && isSitter;

  const load = useCallback(async () => {
    if (!uid) return;
    const [sp, fam, vr] = await Promise.all([
      supabase
        .from('sitter_profiles')
        .select('bio, area, hourly_rate, hosts_at_home, bit_phone, bit_link, photo_path, video_path, lat, id_verified, police_status, police_expires, is_listed')
        .eq('id', uid)
        .maybeSingle(),
      supabase.from('families').select('about, area, photo_path, video_path, lat').eq('id', uid).maybeSingle(),
      supabase.from('verification_requests').select('kind, status, staff_note').eq('user_id', uid).order('created_at', { ascending: false }),
    ]);
    if (sp.data) {
      setS(sp.data as Sitter);
      setRate(sp.data.hourly_rate ? String(sp.data.hourly_rate) : '');
    }
    if (fam.data) setF(fam.data as Family);
    setVerif((vr.data as Pending[]) ?? []);
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function saveSitter() {
    if (!s) return;
    setMsg('');
    const r = rate ? Number(rate) : null;
    if (r !== null && (!Number.isInteger(r) || r < 20 || r > 300)) return setMsg('תעריף לשעה בין ₪20 ל-₪300');
    if (s.bit_link && !s.bit_link.startsWith('https://')) return setMsg('קישור הביט צריך להתחיל ב-https://');
    setBusy(true);
    const { error } = await supabase
      .from('sitter_profiles')
      .update({ bio: s.bio, area: s.area, hourly_rate: r, hosts_at_home: s.hosts_at_home, bit_phone: s.bit_phone || null, bit_link: s.bit_link || null })
      .eq('id', uid);
    setBusy(false);
    setMsg(error ? 'השמירה נכשלה. נסו שוב.' : '✓ נשמר');
  }

  async function saveFamily() {
    if (!f) return;
    setBusy(true);
    const { error } = await supabase.from('families').update({ about: f.about, area: f.area }).eq('id', uid);
    setBusy(false);
    setMsg(error ? 'השמירה נכשלה. נסו שוב.' : '✓ נשמר');
  }

  async function setHome(table: 'families' | 'sitter_profiles') {
    Alert.alert('שמירת מיקום הבית', 'עמדו בבית ולחצו "שמירה". המיקום משמש רק כדי לאשר שהבייביסיטר הגיעה, ולא מוצג לאף אחד.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'שמירה',
        onPress: async () => {
          setLocBusy(true);
          const p = await sampleLocationOnce();
          if (!p) {
            setLocBusy(false);
            return Alert.alert('לא הצלחנו לקבל מיקום', 'בדקו שהמיקום מופעל ושאישרתם לאפליקציה גישה אליו.');
          }
          const { error } = await supabase.from(table).update({ lat: p.lat, lng: p.lng }).eq('id', uid);
          setLocBusy(false);
          if (error) return Alert.alert('השמירה נכשלה');
          load();
        },
      },
    ]);
  }

  async function addRole(r: Role) {
    if (!profile) return;
    const roles = [...profile.roles, r];
    const { error } = await supabase.from('profiles').update({ roles }).eq('id', uid);
    if (error) return Alert.alert('לא הצלחנו להוסיף');
    if (r === 'sitter') await supabase.from('sitter_profiles').insert({ id: uid });
    else await supabase.from('families').insert({ id: uid });
    await refreshProfile();
    setActiveRole(r);
    load();
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
  const setSit = (patch: Partial<Sitter>) => setS((cur) => (cur ? { ...cur, ...patch } : cur));
  const setFam = (patch: Partial<Family>) => setF((cur) => (cur ? { ...cur, ...patch } : cur));
  const idReq = verif.find((v) => v.kind === 'identity');
  const policeReq = verif.find((v) => v.kind === 'police');

  return (
    <Screen>
      <Row>
        <Photo path={sitterView ? s?.photo_path : f?.photo_path} name={profile.full_name} size={64} />
        <View style={{ gap: 4, flexShrink: 1 }}>
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

      {sitterView && s ? (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="h3">אימות</T>
              <Chip tone={s.is_listed ? 'ok' : 'honey'} label={s.is_listed ? 'מופיעה בחיפוש' : 'עוד לא בחיפוש'} />
            </Row>
            <Row style={{ gap: 6 }}>
              <Chip
                tone={s.id_verified ? 'ok' : idReq?.status === 'pending' ? 'honey' : 'plain'}
                label={s.id_verified ? '✓ זהות מאומתת' : idReq?.status === 'pending' ? 'זהות בבדיקה' : 'זהות לא אומתה'}
              />
              <Chip
                tone={s.police_status === 'approved' ? 'acc' : policeReq?.status === 'pending' ? 'honey' : 'plain'}
                label={
                  s.police_status === 'approved'
                    ? 'אישור משטרה נבדק'
                    : policeReq?.status === 'pending'
                      ? 'אישור משטרה בבדיקה'
                      : s.police_status === 'rejected'
                        ? 'אישור משטרה נדחה'
                        : 'אין אישור משטרה'
                }
              />
            </Row>
            {idReq?.status === 'rejected' && idReq.staff_note ? <T variant="small" style={{ color: t.bad }}>הערת הצוות: {idReq.staff_note}</T> : null}
            {!s.id_verified && idReq?.status !== 'pending' ? (
              <Button title="אימות זהות" onPress={() => router.push({ pathname: '/verify', params: { kind: 'identity' } })} />
            ) : null}
            {policeReq?.status !== 'pending' ? (
              <Button
                kind="secondary"
                title={s.police_status === 'approved' ? 'העלאת אישור משטרה חדש' : 'העלאת אישור משטרה (רשות)'}
                onPress={() => router.push({ pathname: '/verify', params: { kind: 'police' } })}
              />
            ) : null}
            {!s.video_path ? <T variant="muted">כדי להופיע בחיפוש צריך גם סרטון היכרות.</T> : null}
          </Card>

          <MediaEditor
            table="sitter_profiles"
            uid={uid}
            name={profile.full_name}
            photoPath={s.photo_path}
            videoPath={s.video_path}
            videoRequired
            onSaved={(p) => setSit(p)}
          />

          <Card>
            <T variant="h3">הפרופיל שלי</T>
            <Field label="קצת עליי" value={s.bio} onChangeText={(v) => setSit({ bio: v })} multiline maxLength={1000} />
            <Field label="אזור" value={s.area} onChangeText={(v) => setSit({ area: v })} placeholder="למשל: רמת החייל" maxLength={60} />
            <Field label="תעריף לשעה (₪)" value={rate} onChangeText={(v) => setRate(v.replace(/\D/g, ''))} keyboardType="number-pad" ltr />
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="small">אפשר לשמור אצלי בבית</T>
              <Switch value={s.hosts_at_home} onValueChange={(v) => setSit({ hosts_at_home: v })} />
            </Row>
            {s.hosts_at_home ? (
              <Button
                kind="secondary"
                title={s.lat ? '✓ מיקום הבית שמור · עדכון' : 'שמירת מיקום הבית שלי'}
                onPress={() => setHome('sitter_profiles')}
                loading={locBusy}
              />
            ) : null}
          </Card>

          <Card>
            <T variant="h3">תשלום בביט</T>
            <T variant="muted">ההורים יראו את הפרטים האלה בסיום כל משמרת.</T>
            <Field label="מספר טלפון בביט" value={s.bit_phone ?? ''} onChangeText={(v) => setSit({ bit_phone: v })} keyboardType="phone-pad" ltr />
            <Field
              label="קישור לתשלום בביט"
              value={s.bit_link ?? ''}
              onChangeText={(v) => setSit({ bit_link: v.trim() })}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://"
              ltr
            />
          </Card>
          {msg ? <T style={{ color: msg.startsWith('✓') ? t.ok : t.bad }}>{msg}</T> : null}
          <Button title="שמירה" onPress={saveSitter} loading={busy} />
        </>
      ) : null}

      {!sitterView && f ? (
        <>
          <MediaEditor
            table="families"
            uid={uid}
            name={profile.full_name}
            photoPath={f.photo_path}
            videoPath={f.video_path}
            videoRequired={false}
            onSaved={(p) => setFam(p)}
          />
          <Card>
            <T variant="h3">המשפחה שלנו</T>
            <Field
              label="כמה מילים על המשפחה"
              value={f.about}
              onChangeText={(v) => setFam({ about: v })}
              multiline
              maxLength={1000}
              placeholder="למשל: שני ילדים, יואב (6) ונגה (3). יש לנו חתול רגוע."
            />
            <Field label="אזור" value={f.area} onChangeText={(v) => setFam({ area: v })} maxLength={60} />
            <Button
              kind="secondary"
              title={f.lat ? '✓ מיקום הבית שמור · עדכון' : 'שמירת מיקום הבית'}
              onPress={() => setHome('families')}
              loading={locBusy}
            />
            <T variant="muted">{'משמש לאישור שהבייביסיטר הגיעה. בלי מיקום שמור, הצ׳ק-אין יסומן "מיקום לא אומת".'}</T>
          </Card>
          {msg ? <T style={{ color: msg.startsWith('✓') ? t.ok : t.bad }}>{msg}</T> : null}
          <Button title="שמירה" onPress={saveFamily} loading={busy} />
        </>
      ) : null}

      {!isSitter ? <Button kind="link" title="רוצה גם לעבוד כבייביסיטר? הוספת פרופיל" onPress={() => addRole('sitter')} /> : null}
      {!isParent ? <Button kind="link" title="מחפשת גם בייביסיטר לילדים שלך? הוספת פרופיל הורה" onPress={() => addRole('parent')} /> : null}

      <Button kind="secondary" title="אודות ושליחת הודעה למפתח" onPress={() => router.push('/about')} />
      <Button kind="secondary" title="יציאה מהחשבון" onPress={confirmSignOut} />
    </Screen>
  );
}
