import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Photo } from '@/components/media';
import { Card, Chip, Row, Segmented, T } from '@/components/ui';
import type { QueueItem } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';


type Filter = 'pending' | 'done';

export default function Admin() {
  const t = useTheme();
  const [filter, setFilter] = useState<Filter>('pending');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState({ listed: 0, messages: 0 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const q = supabase.from('verification_queue').select('*').order('created_at', { ascending: filter === 'pending' }).limit(50);
    const [list, listed, msgs] = await Promise.all([
      filter === 'pending' ? q.eq('status', 'pending') : q.neq('status', 'pending'),
      supabase.from('sitter_cards').select('id', { count: 'exact', head: true }),
      supabase.from('feedback_messages').select('id', { count: 'exact', head: true }),
    ]);
    setItems((list.data as QueueItem[]) ?? []);
    setCounts({ listed: listed.count ?? 0, messages: msgs.count ?? 0 });
    setLoading(false);
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.accent} />}>
        <T variant="h2">ניהול</T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Card soft style={{ flex: 1 }}>
            <T variant="muted">בייביסיטריות בחיפוש</T>
            <T variant="big">{counts.listed}</T>
          </Card>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/about')} accessibilityRole="button">
            <Card soft>
              <T variant="muted">הודעות שהתקבלו</T>
              <T variant="big">{counts.messages}</T>
            </Card>
          </Pressable>
        </View>

        <Segmented<Filter>
          options={[
            ['pending', 'ממתינים לבדיקה'],
            ['done', 'טופלו'],
          ]}
          value={filter}
          onChange={setFilter}
        />

        {items.length === 0 && !loading ? <T variant="muted">{filter === 'pending' ? 'אין בקשות שממתינות. 🎉' : 'עוד לא טופלו בקשות.'}</T> : null}

        {items.map((v) => (
          <Pressable key={v.id} onPress={() => router.push({ pathname: '/admin/[id]', params: { id: v.id } })} accessibilityRole="button">
            <Card>
              <Row>
                <Photo path={v.photo_path} name={v.full_name} size={44} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="h3">{v.full_name}</T>
                  <T variant="muted">
                    {v.kind === 'identity' ? 'אימות זהות' : 'אישור משטרה'} · {new Date(v.created_at).toLocaleDateString('he-IL')}
                  </T>
                </View>
                <Chip
                  tone={v.status === 'pending' ? 'honey' : v.status === 'approved' ? 'ok' : 'warn'}
                  label={v.status === 'pending' ? 'ממתין' : v.status === 'approved' ? 'אושר' : 'נדחה'}
                />
              </Row>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
