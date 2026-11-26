import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

// Hebrew UI. In store builds the expo-localization plugin forces RTL natively;
// this covers Expo Go during development (takes effect after one reload).
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { loading } = useAuth();
  const t = useTheme();
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);
  if (loading) return null;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.bg },
      }}>
      <Stack.Screen name="sitter/[id]" options={{ headerShown: true, title: '', headerBackTitle: 'חזרה' }} />
      <Stack.Screen name="request/[sitterId]" options={{ headerShown: true, title: 'בקשת שמירה', headerBackTitle: 'חזרה' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <Navigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
