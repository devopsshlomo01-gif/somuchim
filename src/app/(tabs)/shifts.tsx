import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, Row, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ShiftItem } from '@/components/shift-item';
import { dayLabel, durationMinutes, hhmm, hoursLabel, REQUEST_STATUS, type RequestCard, type ShiftCard } from '@/lib/booking';
import { nis } from '@/lib/sitters';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function Shifts() {
  const t = useTheme();
  const { session, activeRole } = useAuth();
  const { sent } = useLocalSearchParams<{ sent?: string }>();
  const [requests, setRequests] = useState<RequestCard[]>([]);
  const [shifts, setShifts] = useState<ShiftCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState(sent ? 'הבקשה נשלחה. נעדכן כשתאשר.' : '');

  const me = session!.user.id;
  const isSitter = activeRole === 'sitter';
  const col = isSitter ? 'sitter_id' : 'parent_id';

  const load = useCallback(async () => {
    setLoading(true);
    const [r, s] = await Promise.all([
      supabase.from('request_cards').select('*').eq(col, me).order('created_at', { ascending: false }).limit(30),
      supabase.from('shift_cards').select('*').eq(col, me).order('starts_at', { ascending: false }).limit(50),
    ]);
    setRequests((r.data as RequestCard[]) ?? []);
    setShifts((s.data as ShiftCard[]) ?? []);
    setLoading(false);
  }, [col, me]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function respond(id: string, accept: boolean) {
    setBusyId(id);
    const { error } = await supabase.rpc('respond_to_request', { request_id: id, accept });
    setBusyId(null);
    if (error) {
      Alert.alert('לא הצלחנו לעדכן', 'ייתכן שהבקשה כבר טופלה. נסו לרענן.');
    } else {
      setNotice(accept ? 'אישרת את הבקשה. המשמרת נוספה לרשימה.' : 'הבקשה נדחתה.');
    }
    load();
  }

  function cancel(id: string) {
    Alert.alert('ביטול בקשה', 'לבטל את הבקשה?', [
      { text: 'לא', style: 'cancel' },
      {
        text: 'ביטול הבקשה',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          await supabase.rpc('cancel_request', { request_id: id });
          setBusyId(null);
          load();
        },
      },
    ]);
  }

  const pending = requests.filter((r) => r.status === 'pending');
  const history = requests.filter((r) => r.status !== 'pending' && r.status !== 'accepted').slice(0, 5);

  const requestItem = (r: RequestCard) => {
    const { day, date } = dayLabel(r.start_date);
    const mins = durationMinutes(r.start_time, r.end_time);
    const [label, tone] = REQUEST_STATUS[r.status];
    const other = isSitter ? r.parent_name : r.sitter_name;
    return (
      <Card key={r.id} soft={r.status !== 'pending'}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h3">{isSitter ? `משפחת ${other.split(' ').slice(-1)[0]}` : other}</T>
          <Chip tone={tone} label={label} />
        </Row>
        <T>
          יום {day} {date} · {hhmm(r.start_time)}–{hhmm(r.end_time)} · {hoursLabel(mins)}
        </T>
        <T variant="muted">
          {r.location === 'parent_home' ? 'אצל המשפחה' : 'אצל הבייביסיטר'}
          {r.kids ? ` · ${r.kids}` : ''}
          {r.hourly_rate ? ` · משוער ${nis(Math.round((mins / 60) * r.hourly_rate))}` : ''}
        </T>
        {isSitter && r.family_about ? <T variant="small">{r.family_about}</T> : null}
        {r.notes ? <T variant="small">הערות: {r.notes}</T> : null}
        {r.status === 'pending' && isSitter ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button title="אישור" onPress={() => respond(r.id, true)} loading={busyId === r.id} />
            </View>
            <View style={{ flex: 1 }}>
              <Button kind="secondary" title="דחייה" onPress={() => respond(r.id, false)} disabled={busyId === r.id} />
            </View>
          </View>
        ) : null}
        {r.status === 'pending' && !isSitter ? <Button kind="link" title="ביטול הבקשה" onPress={() => cancel(r.id)} /> : null}
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.accent} />}>
        {notice ? (
          <Card soft>
            <T style={{ color: t.ok, fontWeight: '600' }}>✓ {notice}</T>
          </Card>
        ) : null}

        <T variant="h2">{isSitter ? 'בקשות חדשות' : 'הבקשות שלי'}</T>
        {pending.length === 0 ? (
          <T variant="muted">
            {isSitter ? 'אין בקשות שממתינות לך.' : 'אין בקשות פתוחות. שולחים בקשה מתוך הפרופיל של בייביסיטר.'}
          </T>
        ) : (
          pending.map(requestItem)
        )}

        <T variant="h2">משמרות</T>
        {shifts.length === 0 ? (
          <T variant="muted">
            {isSitter ? 'כשתאשרי בקשה, המשמרת תופיע כאן.' : 'אחרי שבייביסיטר תאשר בקשה, המשמרת תופיע כאן.'}
          </T>
        ) : (
          shifts.map((s) => (
            <ShiftItem
              key={s.id}
              s={s}
              isSitter={isSitter}
              onChanged={(msg) => {
                if (msg) setNotice(msg);
                load();
              }}
            />
          ))
        )}

        {history.length ? (
          <>
            <T variant="h3">בקשות קודמות</T>
            {history.map(requestItem)}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
