import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Card, Chip, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { nis } from '@/lib/sitters';
import { supabase } from '@/lib/supabase';

type Shift = { id: string; starts_at: string; ends_at: string; hourly_rate: number; status: string };

const STATUS: Record<string, [string, 'acc' | 'ok' | 'warn' | 'honey' | 'plain']> = {
  scheduled: ['מתוכננת', 'acc'],
  in_progress: ['בפעילות', 'ok'],
  unpaid: ['ממתין לתשלום', 'warn'],
  reported: ['ההורה דיווח תשלום', 'honey'],
  confirmed: ['שולם ואושר', 'ok'],
  cancelled: ['בוטלה', 'plain'],
};

export default function Shifts() {
  const { session, activeRole } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);

  useFocusEffect(
    useCallback(() => {
      const col = activeRole === 'sitter' ? 'sitter_id' : 'parent_id';
      supabase
        .from('shifts')
        .select('id, starts_at, ends_at, hourly_rate, status')
        .eq(col, session!.user.id)
        .order('starts_at', { ascending: false })
        .limit(50)
        .then(({ data }) => setShifts((data as Shift[]) ?? []));
    }, [activeRole, session]),
  );

  const fmt = (d: string) =>
    new Date(d).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Screen>
      <T variant="h2">המשמרות שלי</T>
      {shifts.length === 0 ? (
        <Card soft>
          <T variant="h3">עוד אין משמרות</T>
          <T variant="muted">
            {activeRole === 'parent'
              ? 'אחרי שבייביסיטר תאשר בקשת שמירה, המשמרות יופיעו כאן.'
              : 'כשתאשרי בקשת שמירה מהורים, המשמרות יופיעו כאן.'}
          </T>
        </Card>
      ) : (
        shifts.map((s) => {
          const [label, tone] = STATUS[s.status] ?? [s.status, 'plain'];
          const hours = (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 36e5;
          return (
            <Card key={s.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <T variant="h3">{fmt(s.starts_at)}</T>
                  <T variant="muted">{hours.toFixed(1)} שעות</T>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <T style={{ fontWeight: '700' }}>{nis(Math.round(hours * s.hourly_rate))}</T>
                  <Chip tone={tone} label={label} />
                </View>
              </Row>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
