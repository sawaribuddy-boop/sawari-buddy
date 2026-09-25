import { Stack } from 'expo-router';

import { colors } from '@/theme';

// Driver mode. Only reachable when the signed-in account's role is DRIVER (see app/_layout.tsx).
export default function DriverLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.green700,
        headerStyle: { backgroundColor: colors.background },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="driver/index" options={{ headerShown: false }} />
      <Stack.Screen name="driver/profile" options={{ title: 'Profile' }} />
    </Stack>
  );
}
