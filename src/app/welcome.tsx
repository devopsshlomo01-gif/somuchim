import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { Button, Card, Field, Screen, T } from '@/components/ui';
import { useAuth, type Role } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { fullNameOk } from '@/lib/validate';

export default function Welcome() {
  const t = useTheme();
  const { session, profile, refreshProfile, setActiveRole } = useAuth();
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<Role[]>(['parent']);
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!session) return <Redirect href="/sign-in" />;
  if (profile) return <Redirect href="/" />;

  const toggle = (r: Role) => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  async function finish() {
    setErr('');
    if (!fullNameOk(name)) return setErr('כתבו שם פרטי ושם משפחה');
    if (!roles.length) return setErr('בחרו לפחות תפקיד אחד');
    if (!terms) return setErr('כדי להמשיך יש לאשר את תנאי השימוש ומדיניות הפרטיות');
    setBusy(true);
    const uid = session!.user.id;
    const { error } = await supabase.from('profiles').insert({ id: uid, full_name: name.trim(), roles });
    if (!error && roles.includes('sitter')) await supabase.from('sitter_profiles').insert({ id: uid });
    if (!error && roles.includes('parent')) await supabase.from('families').insert({ id: uid });
    setBusy(false);
    if (error) return setErr('השמירה נכשלה. נסו שוב.');
    setActiveRole(roles.includes('parent') ? 'parent' : 'sitter');
    await refreshProfile();
    router.replace(roles.includes('parent') ? '/search' : '/profile');
  }

  const RoleBox = ({ r, title, sub }: { r: Role; title: string; sub: string }) => {
    const on = roles.includes(r);
    return (
      <Pressable
        onPress={() => toggle(r)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        style={{
          flex: 1,
          borderWidth: 1,
          borderRadius: 10,
          padding: 12,
          alignItems: 'center',
          gap: 2,
          borderColor: on ? t.accent : t.line,
          backgroundColor: on ? t.accentSoft : t.surface,
        }}>
        <T variant="h3" style={{ color: on ? t.accent : t.fg, textAlign: 'center' }}>
          {title}
        </T>
        <T variant="muted" style={{ textAlign: 'center' }}>
          {sub}
        </T>
      </Pressable>
    );
  };

  return (
    <Screen>
      <T variant="title">נעים להכיר</T>
      <Card>
        <Field label="שם מלא" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
        <T variant="small" style={{ fontWeight: '600' }}>
          אני כאן בתור
        </T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <RoleBox r="parent" title="הורה" sub="מחפש/ת בייביסיטר" />
          <RoleBox r="sitter" title="בייביסיטר" sub="מחפש/ת עבודה" />
        </View>
        <T variant="muted">אפשר לבחור את שניהם, ולשנות בכל זמן.</T>
        {roles.includes('sitter') ? (
          <T variant="muted">כבייביסיטר: בשלב הבא – אימות זהות, תמונה, סרטון היכרות ופרטי תשלום.</T>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Switch value={terms} onValueChange={setTerms} accessibilityLabel="אישור תנאי השימוש" />
          <T variant="small" style={{ flex: 1 }}>
            קראתי ואני מסכים/ה לתנאי השימוש ולמדיניות הפרטיות
          </T>
        </View>
        {err ? <T style={{ color: t.bad }}>{err}</T> : null}
        <Button title="סיום הרשמה" onPress={finish} loading={busy} />
      </Card>
    </Screen>
  );
}
