import { Stack } from 'expo-router';

import { colors } from '@/theme';

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
      <Stack.Screen name="driver/trip" options={{ headerShown: false }} />
      <Stack.Screen name="driver/trip-in-progress" options={{ headerShown: false }} />
      <Stack.Screen name="driver/earnings" options={{ headerShown: false }} />
      <Stack.Screen name="driver/profile" options={{ title: 'Profile' }} />
    </Stack>
  );
}
