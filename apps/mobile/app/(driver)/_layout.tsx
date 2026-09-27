import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components';
import { colors } from '@/theme';

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Icon name={name} color={color} size={size} />;
}

export default function DriverLayout() {
  const { t } = useTranslation();
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
      <Tabs.Screen name="driver/index" options={{ title: t('tabs.home'), tabBarIcon: tabIcon('rickshaw') }} />
      <Tabs.Screen name="driver/earnings" options={{ title: t('tabs.earnings'), tabBarIcon: tabIcon('cash-multiple') }} />
      <Tabs.Screen name="driver/profile" options={{ title: t('tabs.profile'), tabBarIcon: tabIcon('account-circle-outline') }} />

      {/* Stack-pushed screens: hidden from tab bar */}
      <Tabs.Screen name="driver/trip" options={{ href: null }} />
      <Tabs.Screen name="driver/trip-in-progress" options={{ href: null }} />
    </Tabs>
  );
}
