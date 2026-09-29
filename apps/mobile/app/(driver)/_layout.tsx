import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Toast, type ToastMessage } from '@/components';
import { useDriverTripChannel } from '@/features/realtime';
import { colors } from '@/theme';

export default function DriverLayout() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showNotice = useCallback((text: string) => {
    setToast({ id: `${Date.now()}`, text, icon: 'account-remove-outline' });
  }, []);
  useDriverTripChannel(showNotice);

  return (
    <View style={{ flex: 1 }}>
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
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </View>
  );
}
