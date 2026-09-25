import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { routeGuards } from '@/features/auth/routing';
import { queryClient } from '@/lib/queryClient';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Exactly one route group is reachable at a time, based on the session and the role stored in the
// database. When the guard for the current screen turns false (sign in, sign out, suspension),
// expo-router returns to the entry route, which redirects to the right home.
function RootNavigator() {
  const { status, account } = useAuth();
  const guards = routeGuards({ status, role: account?.role ?? null });

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />

        <Stack.Protected guard={guards.auth}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={guards.passenger}>
          <Stack.Screen name="(passenger)" />
        </Stack.Protected>

        <Stack.Protected guard={guards.driver}>
          <Stack.Screen name="(driver)" />
        </Stack.Protected>

        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="dev/components" options={{ headerShown: true, title: 'Design preview' }} />
          <Stack.Screen name="dev/connection" options={{ headerShown: true, title: 'Connection check' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
