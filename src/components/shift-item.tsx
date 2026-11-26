import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, View } from 'react-native';

import { Button, Card, Chip, Row, T } from '@/components/ui';
import { hoursLabel, SHIFT_STATUS, type ShiftCard } from '@/lib/booking';
import { distanceLabel, sampleLocationOnce } from '@/lib/location';
import { nis } from '@/lib/sitters';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });

function PaySheet({ s, onClose, onPaid }: { s: ShiftCard; onClose: () => void; onPaid: () => void }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const first = s.sitter_name.split(' ')[0];
  const link = s.bit_link && s.bit_link.startsWith('https://') ? s.bit_link : null;

  async function paid() {
    setBusy(true);
    const { error } = await supabase.rpc('report_paid', { shift_id: s.id });
    setBusy(false);
    if (error) return Alert.alert('לא הצלחנו לעדכן', 'נסו שוב.');
    onPaid();
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(10,20,18,0.45)' }} onPress={onClose} accessibilityLabel="סגירה" />
      <View style={{ backgroundColor: t.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, gap: 12, paddingBottom: 32 }}>
        <T variant="h2">המשמרת הסתיימה</T>
        <Card soft>
          <Row style={{ justifyContent: 'space-between' }}>
            <T>
              {s.check_in_at ? clock(s.check_in_at) : ''}–{s.check_out_at ? clock(s.check_out_at) : ''}
            </T>
            <T variant="muted">{nis(s.hourly_rate)} לשעה</T>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h3">לתשלום</T>
            <T variant="big">{nis(s.amount)}</T>
          </Row>
        </Card>
        <T variant="h3">תשלום בביט</T>
        {link ? (
          <Button title={`לתשלום ${nis(s.amount)} בביט ל${first}`} onPress={() => Linking.openURL(link)} />
        ) : (
          <T variant="muted">{first} עוד לא הוסיפה קישור לתשלום בביט.</T>
        )}
        {s.bit_phone ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="muted">או לפי מספר טלפון:</T>
            <Row>
              <T style={{ writingDirection: 'ltr', fontWeight: '700' }}>{s.bit_phone}</T>
              <Button
                kind="link"
                title="העתקה"
                onPress={async () => {
                  await Clipboard.setStringAsync(s.bit_phone!);
                  Alert.alert('המספר הועתק');
                }}
              />
            </Row>
          </Row>
        ) : null}
        <T variant="muted">ביט לא מדווחת לנו על התשלום, לכן {first} תאשר את הקבלה.</T>
        <Button kind="secondary" title="שילמתי" onPress={paid} loading={busy} />
      </View>
    </Modal>
  );
}

export function ShiftItem({ s, isSitter, onChanged }: { s: ShiftCard; isSitter: boolean; onChanged: (msg?: string) => void }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [label, tone] = SHIFT_STATUS[s.status] ?? [s.status, 'plain'];
  const mins = Math.round((new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000);
  const title = isSitter ? `משפחת ${s.parent_name.split(' ').slice(-1)[0]}` : s.sitter_name;
  const [openedAt] = useState(() => Date.now());
  const startsSoon = new Date(s.starts_at).getTime() - openedAt <= 2 * 3600 * 1000;

  async function stamp(kind: 'check_in' | 'check_out') {
    setBusy(true);
    const p = await sampleLocationOnce();
    const { data, error } = await supabase.rpc(kind, { shift_id: s.id, lat: p?.lat ?? null, lng: p?.lng ?? null });
    setBusy(false);
    if (error) {
      Alert.alert('לא הצלחנו לעדכן', error.message.includes('too early') ? 'אפשר להתחיל עד שעתיים לפני תחילת המשמרת.' : 'נסו שוב.');
      return;
    }
    const where = p ? `${distanceLabel(data as number | null)} מהבית` : 'בלי מיקום';
    onChanged(kind === 'check_in' ? `צ׳ק-אין נרשם (${where}). ההורים רואים שהתחלת.` : `צ׳ק-אאוט נרשם (${where}). הסכום נשלח להורים.`);
  }

  async function confirm() {
    setBusy(true);
    const { error } = await supabase.rpc('confirm_paid', { shift_id: s.id });
    setBusy(false);
    if (error) return Alert.alert('לא הצלחנו לעדכן', 'נסו שוב.');
    onChanged('אישרת קבלת תשלום. תודה!');
  }

  function cancel() {
    Alert.alert('ביטול משמרת', 'לבטל את המשמרת?', [
      { text: 'לא', style: 'cancel' },
      {
        text: 'ביטול המשמרת',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('cancel_shift', { shift_id: s.id });
          onChanged(error ? undefined : 'המשמרת בוטלה.');
        },
      },
    ]);
  }

  const verified = (v: boolean | null, d: number | null, at: string | null) =>
    at ? `${clock(at)} · ${v ? `מיקום אומת (${distanceLabel(d)})` : d !== null ? `רחוק מהבית (${distanceLabel(d)})` : 'מיקום לא זמין'}` : null;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ gap: 2, flexShrink: 1 }}>
          <T variant="h3">{title}</T>
          <T variant="muted">
            {fmt(s.starts_at)} · {hoursLabel(mins)}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <T style={{ fontWeight: '700' }}>{nis(s.amount)}</T>
          <Chip tone={tone} label={label} />
        </View>
      </Row>

      {s.check_in_at ? <T variant="small">צ׳ק-אין: {verified(s.check_in_verified, s.check_in_distance_m, s.check_in_at)}</T> : null}
      {s.check_out_at ? <T variant="small">צ׳ק-אאוט: {verified(s.check_out_verified, s.check_out_distance_m, s.check_out_at)}</T> : null}

      {isSitter && s.status === 'scheduled' ? (
        <>
          <Button title="התחלתי · צ׳ק-אין" onPress={() => stamp('check_in')} loading={busy} disabled={!startsSoon} />
          {!startsSoon ? <T variant="muted">הכפתור נפתח שעתיים לפני תחילת המשמרת.</T> : null}
          <T variant="muted">המיקום נדגם פעם אחת בלחיצה, ולא במהלך המשמרת.</T>
        </>
      ) : null}
      {isSitter && s.status === 'in_progress' ? <Button title="סיימתי · צ׳ק-אאוט" onPress={() => stamp('check_out')} loading={busy} /> : null}
      {isSitter && (s.status === 'unpaid' || s.status === 'reported') ? (
        <Button title={s.status === 'reported' ? 'קיבלתי את התשלום' : 'קיבלתי תשלום (גם במזומן)'} onPress={confirm} loading={busy} />
      ) : null}

      {!isSitter && s.status === 'unpaid' ? <Button title={`לתשלום ${nis(s.amount)}`} onPress={() => setPaying(true)} /> : null}
      {!isSitter && (s.status === 'reported' || s.status === 'confirmed') && !s.reviewed ? (
        <Button kind="secondary" title="איך היה? כתיבת ביקורת" onPress={() => router.push({ pathname: '/review/[shiftId]', params: { shiftId: s.id } })} />
      ) : null}
      {s.status === 'scheduled' ? <Button kind="link" title="ביטול המשמרת" onPress={cancel} /> : null}
      {s.status === 'in_progress' && !isSitter ? (
        <T variant="small" style={{ color: t.ok }}>
          {s.sitter_name.split(' ')[0]} במשמרת עכשיו.
        </T>
      ) : null}

      {paying ? (
        <PaySheet
          s={s}
          onClose={() => setPaying(false)}
          onPaid={() => {
            setPaying(false);
            router.push({ pathname: '/review/[shiftId]', params: { shiftId: s.id } });
            onChanged('דיווחת על תשלום. נשמח לביקורת קצרה.');
          }}
        />
      ) : null}
    </Card>
  );
}
