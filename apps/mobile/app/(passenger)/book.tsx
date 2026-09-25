import { firstName, formatRupees } from '@sawari/domain';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Card, Icon, Screen, Stepper, StopPicker } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyActiveBooking } from '@/features/booking';
import { usePlatformSettings, useRoutes, useStops } from '@/features/trip';
import { colors, spacing } from '@/theme';

export default function BookScreen() {
  const { account } = useAuth();
  const router = useRouter();

  const { data: stops, isLoading: stopsLoading } = useStops();
  const { data: routes } = useRoutes();
  const { data: settings } = usePlatformSettings();
  const { data: activeBooking } = useMyActiveBooking();

  const [originId, setOriginId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [seatCount, setSeatCount] = useState(1);

  const maxSeats = (settings as Record<string, unknown> | null)?.max_seats_per_booking as number | undefined ?? 4;
  const stopsList = Array.isArray(stops) ? (stops as { id: string; name: string }[]) : [];

  const handleSwap = useCallback(() => {
    setOriginId((prev) => {
      setDestinationId(originId);
      return destinationId;
    });
  }, [originId, destinationId]);

  const handleSearch = () => {
    if (!originId || !destinationId) return;
    router.push({
      pathname: '/(passenger)/search-results',
      params: { originId, destinationId, seatCount: String(seatCount) },
    });
  };

  const hasActiveBooking = activeBooking != null;
  const activeBookingData = activeBooking as Record<string, unknown> | null;

  const routesList = Array.isArray(routes) ? (routes as { id: string; origin_stop_id: string; destination_stop_id: string; fare_paise: number }[]) : [];
  const stopsMap = new Map(stopsList.map((s) => [s.id, s.name]));

  return (
    <Screen scroll edges={['top']}>
      <View style={styles.body}>
        <AppText variant="small" color={colors.ink500}>
          Hi {account ? firstName(account.fullName) : 'there'}
        </AppText>
        <AppText variant="title">Where are you going?</AppText>

        {hasActiveBooking ? (
          <>
            <Banner tone="info" title="You have an active booking" message="Tap below to view it." />
            <Button
              label="View my booking"
              variant="secondary"
              icon="ticket-confirmation-outline"
              onPress={() => {
                const bId = (activeBookingData?.booking as Record<string, unknown> | undefined)?.id as string | undefined;
                const tId = (activeBookingData?.booking as Record<string, unknown> | undefined)?.trip_id as string | undefined;
                if (bId) {
                  router.push({ pathname: '/(passenger)/booking-detail', params: { bookingId: bId, tripId: tId ?? '' } });
                }
              }}
            />
          </>
        ) : null}

        <View style={styles.pickersRow}>
          <View style={styles.pickers}>
            <StopPicker
              label="From"
              stops={stopsLoading ? [] : stopsList}
              selectedId={originId}
              onSelect={setOriginId}
            />
            <StopPicker
              label="To"
              stops={stopsLoading ? [] : stopsList}
              selectedId={destinationId}
              onSelect={setDestinationId}
            />
          </View>
          <Pressable
            onPress={handleSwap}
            accessibilityRole="button"
            accessibilityLabel="Swap origin and destination"
            style={styles.swapBtn}
          >
            <Icon name="swap-vertical" color={colors.green700} size={24} />
          </Pressable>
        </View>

        <Card>
          <View style={styles.seatRow}>
            <AppText variant="bodyStrong">Passengers</AppText>
            <Stepper value={seatCount} min={1} max={maxSeats} onChange={setSeatCount} label="Passengers" />
          </View>
        </Card>

        <Button
          label="Find Shared Auto"
          variant="primary"
          icon="magnify"
          onPress={handleSearch}
          disabled={!originId || !destinationId || originId === destinationId || hasActiveBooking}
        />

        {routesList.length > 0 ? (
          <View style={styles.popularSection}>
            <AppText variant="heading">Popular Routes</AppText>
            {routesList.map((r) => {
              const origin = stopsMap.get(r.origin_stop_id);
              const dest = stopsMap.get(r.destination_stop_id);
              if (!origin || !dest) return null;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    setOriginId(r.origin_stop_id);
                    setDestinationId(r.destination_stop_id);
                  }}
                  style={({ pressed }) => [styles.routeRow, pressed && styles.routeRowPressed]}
                >
                  <View style={styles.routeInfo}>
                    <AppText variant="body">
                      {origin} → {dest}
                    </AppText>
                    <AppText variant="small" color={colors.ink500}>
                      {formatRupees(r.fare_paise)}/seat
                    </AppText>
                  </View>
                  <Icon name="chevron-right" color={colors.ink400} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  pickersRow: { flexDirection: 'row', gap: spacing.sm },
  pickers: { flex: 1, gap: spacing.sm },
  swapBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  seatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  popularSection: { gap: spacing.sm, marginTop: spacing.md },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  routeRowPressed: { backgroundColor: colors.green50 },
  routeInfo: { flex: 1, gap: spacing.xxs },
});
