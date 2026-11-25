import { Redirect } from 'expo-router';

import { Card, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { isConfigured } from '@/lib/supabase';

export default function Index() {
  const { session, profile, activeRole } = useAuth();

  if (!isConfigured) {
    return (
      <Screen>
        <T variant="title">סמוכים</T>
        <Card>
          <T variant="h3">האפליקציה עוד לא מחוברת לשרת</T>
          <T variant="muted">
            צרו קובץ .env לפי .env.example עם הכתובת והמפתח של פרויקט ה-Supabase, והפעילו מחדש.
          </T>
        </Card>
      </Screen>
    );
  }
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile) return <Redirect href="/welcome" />;
  return <Redirect href={activeRole === 'sitter' ? '/shifts' : '/search'} />;
}
