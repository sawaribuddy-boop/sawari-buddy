import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components';
import { colors } from '@/theme';

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Icon name={name} color={color} size={size} />;
}

export default function PassengerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green700,
        tabBarInactiveTintColor: colors.ink400,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="book" options={{ title: 'Book', tabBarIcon: tabIcon('rickshaw') }} />
      <Tabs.Screen name="bookings" options={{ title: 'My bookings', tabBarIcon: tabIcon('ticket-confirmation-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('account-circle-outline') }} />

      {/* Stack-pushed screens: hidden from tab bar */}
      <Tabs.Screen name="search-results" options={{ href: null }} />
      <Tabs.Screen name="confirm" options={{ href: null }} />
      <Tabs.Screen name="booking-detail" options={{ href: null }} />
    </Tabs>
  );
}
