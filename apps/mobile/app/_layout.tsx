import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/theme';

// Root navigator. Step 3 adds the session provider and role-protected (passenger)/(driver) groups here.
export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="dev/components" options={{ headerShown: true, title: 'Design preview' }} />
      </Stack>
    </>
  );
}
