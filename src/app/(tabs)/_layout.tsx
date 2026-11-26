import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

type Icon = ComponentProps<typeof Ionicons>['name'];
function icon(name: Icon) {
  return function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  const t = useTheme();
  const { session, profile, activeRole } = useAuth();
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile) return <Redirect href="/welcome" />;

  const parent = activeRole === 'parent';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}>
      <Tabs.Screen name="search" options={{ title: 'חיפוש', tabBarIcon: icon('search'), href: parent ? undefined : null }} />
      <Tabs.Screen name="shifts" options={{ title: 'משמרות', tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'פרופיל', tabBarIcon: icon('person-circle-outline') }} />
      <Tabs.Screen name="about" options={{ title: 'אודות', tabBarIcon: icon('information-circle-outline') }} />
    </Tabs>
  );
}
