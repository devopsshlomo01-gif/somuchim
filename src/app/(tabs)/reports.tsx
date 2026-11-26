import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Row, Segmented, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { hoursLabel, type ShiftCard } from '@/lib/booking';
import { nis } from '@/lib/sitters';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
type Mode = 'month' | 'year';

const ymOf = (iso: string) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit' }).formatToParts(new Date(iso));
  return { y: Number(p.find((x) => x.type === 'year')!.value), m: Number(p.find((x) => x.type === 'month')!.value) };
};
const minsOf = (s: ShiftCard) =>
  Math.round(((s.check_out_at ? Date.parse(s.check_out_at) : Date.parse(s.ends_at)) - (s.check_in_at ? Date.parse(s.check_in_at) : Date.parse(s.starts_at))) / 60000);

export default function Reports() {
  const t = useTheme();
  const { session, activeRole } = useAuth();
  const isSitter = activeRole === 'sitter';
  const [mode, setMode] = useState<Mode>('month');
  const [rows, setRows] = useState<ShiftCard[]>([]);
  const now = ymOf(new Date().toISOString());
  const [month, setMonth] = useState(now);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('shift_cards')
        .select('*')
        .eq(isSitter ? 'sitter_id' : 'parent_id', session!.user.id)
        .in('status', isSitter ? ['unpaid', 'reported', 'confirmed'] : ['reported', 'confirmed'])
        .order('starts_at', { ascending: true })
        .limit(1000)
        .then(({ data }) => setRows((data as ShiftCard[]) ?? []));
    }, [isSitter, session]),
  );

  const other = (s: ShiftCard) => (isSitter ? `משפחת ${s.parent_name.split(' ').slice(-1)[0]}` : s.sitter_name);
  const inMonth = rows.filter((s) => {
    const k = ymOf(s.starts_at);
    return k.y === month.y && k.m === month.m;
  });
  const inYear = rows.filter((s) => ymOf(s.starts_at).y === month.y);
  const list = mode === 'month' ? inMonth : inYear;
  const total = list.reduce((a, s) => a + s.amount, 0);
  const totalMins = list.reduce((a, s) => a + minsOf(s), 0);
  const open = isSitter ? rows.filter((s) => s.status !== 'confirmed').reduce((a, s) => a + s.amount, 0) : 0;

  const byKey = new Map<string, { label: string; n: number; mins: number; sum: number }>();
  for (const s of list) {
    const key = mode === 'month' ? other(s) : String(ymOf(s.starts_at).m);
    const label = mode === 'month' ? other(s) : MONTHS[ymOf(s.starts_at).m - 1];
    const e = byKey.get(key) ?? { label, n: 0, mins: 0, sum: 0 };
    e.n += 1;
    e.mins += minsOf(s);
    e.sum += s.amount;
    byKey.set(key, e);
  }

  const shiftMonth = (d: number) =>
    setMonth(({ y, m }) => {
      const n = m + d;
      return n < 1 ? { y: y - 1, m: 12 } : n > 12 ? { y: y + 1, m: 1 } : { y, m: n };
    });
  const shiftYear = (d: number) => setMonth(({ y, m }) => ({ y: y + d, m }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <T variant="h2">{isSitter ? 'הכנסות' : 'דוחות תשלום'}</T>
        <Segmented<Mode>
          options={[
            ['month', 'חודשי'],
            ['year', 'שנתי'],
          ]}
          value={mode}
          onChange={setMode}
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable onPress={() => (mode === 'month' ? shiftMonth(-1) : shiftYear(-1))} accessibilityRole="button" hitSlop={10}>
            <T variant="h3" style={{ color: t.accent }}>
              → הקודם
            </T>
          </Pressable>
          <T variant="h3">{mode === 'month' ? `${MONTHS[month.m - 1]} ${month.y}` : String(month.y)}</T>
          <Pressable onPress={() => (mode === 'month' ? shiftMonth(1) : shiftYear(1))} accessibilityRole="button" hitSlop={10}>
            <T variant="h3" style={{ color: t.accent }}>
              הבא ←
            </T>
          </Pressable>
        </Row>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Card soft style={{ flex: 1 }}>
            <T variant="muted">{isSitter ? 'הכנסה' : 'סה״כ ששולם'}</T>
            <T variant="big">{nis(total)}</T>
            <T variant="muted">
              {list.length} משמרות · {hoursLabel(totalMins)}
            </T>
          </Card>
          {isSitter ? (
            <Card soft style={{ flex: 1 }}>
              <T variant="muted">פתוח לגבייה</T>
              <T variant="big" style={{ color: open ? t.warn : t.fg }}>
                {nis(open)}
              </T>
              <T variant="muted">מכל התקופות</T>
            </Card>
          ) : null}
        </View>

        <Card>
          <T variant="h3">{mode === 'month' ? (isSitter ? 'לפי משפחה' : 'לפי בייביסיטר') : 'לפי חודש'}</T>
          {byKey.size === 0 ? <T variant="muted">אין משמרות בתקופה הזו.</T> : null}
          {[...byKey.values()].map((e) => (
            <Row key={e.label} style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: t.line, paddingTop: 8 }}>
              <View>
                <T>{e.label}</T>
                <T variant="muted">
                  {e.n} משמרות · {hoursLabel(e.mins)}
                </T>
              </View>
              <T style={{ fontWeight: '700' }}>{nis(e.sum)}</T>
            </Row>
          ))}
        </Card>
        <T variant="muted" style={{ textAlign: 'center' }}>
          {isSitter ? 'זה סיכום ולא קבלה רשמית.' : 'הדוח הוא סיכום תשלומים ולא קבלה. קבלה רשמית מפיקה הבייביסיטר.'}
        </T>
      </ScrollView>
    </SafeAreaView>
  );
}
