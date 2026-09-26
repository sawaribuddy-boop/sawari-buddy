import { TRIP_STATUS } from '@sawari/constants';
import { firstName, formatRupees, greeting } from '@sawari/domain';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Card, Icon, ListRow, Screen, SeatBar, StatusPill } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useCancelTrip,
  useDriverHome,
  useGoOffline,
  useHeartbeat,
  useOpenTrip,
} from '@/features/driver';
import { useRoutes, useStops } from '@/features/trip';
import { colors, radius, spacing } from '@/theme';

type DriverHomeData = {
  presence: { is_online: boolean; last_seen_at: string | null };
  active_trip: {
    trip: {
      id: string;
      status: string;
      capacity: number;
      fare_paise: number;
      final_call_at: string | null;
      no_show_eligible_at: string | null;
      started_at: string | null;
      opened_at: string;
    };
    occupied_seats: number;
    available_seats: number;
    route: { id: string; origin: string; destination: string };
    bookings: Array<Record<string, unknown>>;
  } | null;
  auto: { id: string; registration_number: string; model: string; colour: string; capacity: number } | null;
  earnings: { total_fare_paise: number; total_platform_fee_paise: number; net_earnings_paise: number; trip_count: number } | null;
  server_time: string;
};

const DRIVER_STATUS_NOTICE = {
  PENDING_VERIFICATION: {
    title: 'Verification pending',
    message: 'Your driver account is being verified. You can go online once SawariBuddy approves it.',
  },
  SUSPENDED: {
    title: 'Driver account suspended',
    message: 'You cannot go online. Please contact SawariBuddy support.',
  },
} as const;

export default function DriverHomeScreen() {
  const { account } = useAuth();
  const { data: rawHome, isLoading, refetch } = useDriverHome();
  const { data: routes } = useRoutes();
  const { data: stops } = useStops();
  const openTripMutation = useOpenTrip();
  const goOfflineMutation = useGoOffline();
  const cancelTripMutation = useCancelTrip();

  const home = rawHome as DriverHomeData | null;
  const hasActiveTrip = !!home?.active_trip;
  const tripStatus = home?.active_trip?.trip.status;

  const heartbeat = useHeartbeat(hasActiveTrip && tripStatus !== 'COMPLETED' && tripStatus !== 'CANCELLED');

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const restriction =
    account?.driverStatus && account.driverStatus !== 'ACTIVE'
      ? DRIVER_STATUS_NOTICE[account.driverStatus as keyof typeof DRIVER_STATUS_NOTICE]
      : null;

  const auto = home?.auto;
  const isOnline = home?.presence.is_online ?? false;

  const routeList = Array.isArray(routes)
    ? (routes as Array<{ id: string; origin_stop_id: string; destination_stop_id: string; fare_paise: number }>)
    : [];
  const stopsMap = new Map(
    Array.isArray(stops) ? (stops as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]) : [],
  );

  const handleOpenTrip = useCallback(() => {
    if (!auto || !selectedRouteId) return;
    openTripMutation.mutate(
      { autoId: auto.id, routeId: selectedRouteId },
      {
        onSuccess: () => {
          setSelectedRouteId(null);
        },
      },
    );
  }, [auto, selectedRouteId, openTripMutation]);

  const handleGoOffline = useCallback(() => {
    goOfflineMutation.mutate();
  }, [goOfflineMutation]);

  const handleCancelTrip = useCallback(() => {
    if (!home?.active_trip) return;
    cancelTripMutation.mutate({ tripId: home.active_trip.trip.id, reason: 'DRIVER_CANCELLED' });
  }, [home?.active_trip, cancelTripMutation]);

  if (!account) return null;

  const isMutating = openTripMutation.isPending || goOfflineMutation.isPending || cancelTripMutation.isPending;

  return (
    <Screen
      scroll
      edges={['top']}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refetch()} />}
    >
      <View style={styles.body}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Icon name="account" size={28} color={colors.green700} />
          </View>
          <View style={styles.flex}>
            <AppText variant="small" color={colors.ink500}>
              {greeting()},
            </AppText>
            <AppText variant="heading">{firstName(account.fullName)}</AppText>
          </View>
          <StatusPill
            label={isOnline ? 'Online' : 'Offline'}
            tone={isOnline ? 'success' : 'neutral'}
          />
        </View>

        {restriction ? (
          <Banner tone="danger" title={restriction.title} message={restriction.message} />
        ) : null}

        {/* Heartbeat warning */}
        {heartbeat.isUnreachable ? (
          <Banner
            tone="warning"
            title="Connection issue"
            message="Repeated heartbeat failures. Your trip may be suspended if this continues."
          />
        ) : null}

        {heartbeat.hasLocationPermission === false && hasActiveTrip ? (
          <Banner
            tone="info"
            title="Location permission denied"
            message="Passengers cannot see your location. Grant location access for a better experience."
          />
        ) : null}

        {/* Active trip card */}
        {home?.active_trip ? (
          <Card>
            <View style={styles.tripHeader}>
              <Icon name="rickshaw" color={colors.autoYellow} size={28} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">
                  {home.active_trip.route.origin} → {home.active_trip.route.destination}
                </AppText>
                <AppText variant="small" color={colors.ink500}>
                  {auto?.registration_number} · {formatRupees(home.active_trip.trip.fare_paise)}/seat
                </AppText>
              </View>
              <StatusPill
                label={home.active_trip.trip.status}
                tone={
                  tripStatus === TRIP_STATUS.IN_PROGRESS
                    ? 'info'
                    : tripStatus === TRIP_STATUS.BOARDING
                      ? 'warning'
                      : tripStatus === TRIP_STATUS.SUSPENDED
                        ? 'danger'
                        : 'success'
                }
              />
            </View>

            <SeatBar
              occupied={home.active_trip.occupied_seats}
              capacity={home.active_trip.trip.capacity}
            />

            <View style={styles.tripActions}>
              {tripStatus === TRIP_STATUS.IN_PROGRESS ? (
                <Button
                  label="Manage Trip"
                  variant="primary"
                  icon="steering"
                  onPress={() =>
                    router.push({
                      pathname: '/driver/trip-in-progress',
                      params: { tripId: home.active_trip!.trip.id },
                    })
                  }
                />
              ) : tripStatus === TRIP_STATUS.OPEN || tripStatus === TRIP_STATUS.BOARDING ? (
                <Button
                  label="Manage Trip"
                  variant="primary"
                  icon="clipboard-list-outline"
                  onPress={() =>
                    router.push({
                      pathname: '/driver/trip',
                      params: { tripId: home.active_trip!.trip.id },
                    })
                  }
                />
              ) : tripStatus === TRIP_STATUS.SUSPENDED ? (
                <Banner tone="danger" title="Trip suspended" message="You were unreachable. Resume connectivity to continue." />
              ) : null}
            </View>
          </Card>
        ) : null}

        {/* Go online / pick route */}
        {!hasActiveTrip && !restriction ? (
          <>
            {!auto ? (
              <Banner
                tone="warning"
                title="No auto assigned"
                message="Contact SawariBuddy to assign an auto to your account."
              />
            ) : (
              <Card>
                <AppText variant="heading" style={styles.sectionTitle}>
                  Open a Trip
                </AppText>
                <AppText variant="small" color={colors.ink500} style={styles.sectionHint}>
                  Select a route to start accepting passengers on {auto.registration_number}
                </AppText>

                {routeList.map((r) => {
                  const origin = stopsMap.get(r.origin_stop_id);
                  const dest = stopsMap.get(r.destination_stop_id);
                  if (!origin || !dest) return null;
                  const selected = selectedRouteId === r.id;
                  return (
                    <ListRow
                      key={r.id}
                      icon={selected ? 'radiobox-marked' : 'radiobox-blank'}
                      title={`${origin} → ${dest}`}
                      subtitle={`${formatRupees(r.fare_paise)}/seat`}
                      onPress={() => setSelectedRouteId(r.id)}
                    />
                  );
                })}

                <Button
                  label="Open Trip"
                  variant="primary"
                  icon="play-circle-outline"
                  loading={openTripMutation.isPending}
                  disabled={!selectedRouteId || isMutating}
                  onPress={handleOpenTrip}
                />
                {openTripMutation.isError ? (
                  <Banner tone="danger" title="Could not open trip" message={openTripMutation.error.message} />
                ) : null}
              </Card>
            )}
          </>
        ) : null}

        {/* Go offline */}
        {isOnline && !hasActiveTrip ? (
          <Button
            label="Go Offline"
            variant="ghost"
            icon="power"
            loading={goOfflineMutation.isPending}
            onPress={handleGoOffline}
          />
        ) : null}

        {/* Cancel trip (only OPEN/BOARDING with no passengers) */}
        {hasActiveTrip &&
        (tripStatus === TRIP_STATUS.OPEN || tripStatus === TRIP_STATUS.BOARDING) &&
        home.active_trip!.occupied_seats === 0 ? (
          <Button
            label="Cancel Trip"
            variant="ghost"
            icon="close-circle-outline"
            loading={cancelTripMutation.isPending}
            onPress={handleCancelTrip}
          />
        ) : null}

        {/* Today's earnings */}
        {home?.earnings ? (
          <Card>
            <View style={styles.earningsRow}>
              <View style={styles.flex}>
                <AppText variant="small" color={colors.ink500}>
                  Today's earnings
                </AppText>
                <AppText variant="heading" color={colors.green700}>
                  {formatRupees((home.earnings as Record<string, unknown>).net_earnings_paise as number)}
                </AppText>
              </View>
              <AppText variant="small" color={colors.ink500}>
                {(home.earnings as Record<string, unknown>).trip_count as number} trips
              </AppText>
            </View>
            <Button
              label="View Earnings"
              variant="ghost"
              size="md"
              fullWidth={false}
              onPress={() => router.push('/driver/earnings')}
            />
          </Card>
        ) : null}

        {/* Profile */}
        <Card padded={false} style={styles.listCard}>
          <ListRow
            icon="account-circle-outline"
            title="Profile"
            subtitle="Account and sign out"
            onPress={() => router.push('/driver/profile')}
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.green50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  tripHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  tripActions: { marginTop: spacing.md, gap: spacing.sm },
  sectionTitle: { marginBottom: spacing.xs },
  sectionHint: { marginBottom: spacing.md },
  earningsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  listCard: { paddingHorizontal: spacing.md },
});
