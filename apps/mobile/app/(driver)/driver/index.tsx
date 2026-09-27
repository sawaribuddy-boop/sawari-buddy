import { TRIP_STATUS } from '@sawari/constants';
import { firstName, formatRupees, greeting } from '@sawari/domain';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Card, Icon, ListRow, OfflineBanner, Screen, SeatBar, StatusPill } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  useCancelTrip,
  useDriverHome,
  useGoOffline,
  useGoOnline,
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
  earnings: { earnings_paise: number; fares_collected_paise: number; completed_trips: number; settlement_balance_paise: number } | null;
  server_time: string;
};

const DRIVER_STATUS_NOTICE = {
  PENDING_VERIFICATION: {
    titleKey: 'driver.verifyPendingTitle',
    messageKey: 'driver.verifyPendingMessage',
  },
  SUSPENDED: {
    titleKey: 'driver.suspendedTitle',
    messageKey: 'driver.suspendedMessage',
  },
} as const;

export default function DriverHomeScreen() {
  const { t } = useTranslation();
  const { account } = useAuth();
  const { data: rawHome, isLoading, refetch } = useDriverHome();
  const { data: routes } = useRoutes();
  const { data: stops } = useStops();
  const openTripMutation = useOpenTrip();
  const goOfflineMutation = useGoOffline();
  const goOnlineMutation = useGoOnline();
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

  const handleGoOnline = useCallback(() => {
    goOnlineMutation.mutate();
  }, [goOnlineMutation]);

  const handleCancelTrip = useCallback(() => {
    if (!home?.active_trip) return;
    cancelTripMutation.mutate({ tripId: home.active_trip.trip.id, reason: 'DRIVER_CANCELLED' });
  }, [home?.active_trip, cancelTripMutation]);

  if (!account) return null;

  const isMutating = openTripMutation.isPending || goOfflineMutation.isPending || goOnlineMutation.isPending || cancelTripMutation.isPending;

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
            {isOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.flex}>
            <AppText variant="small" color={colors.ink500}>
              {greeting()},
            </AppText>
            <AppText variant="heading">{firstName(account.fullName)}</AppText>
          </View>
          <StatusPill
            label={isOnline ? t('common.online') : t('common.offline')}
            tone={isOnline ? 'success' : 'neutral'}
          />
        </View>

        <OfflineBanner />

        {restriction ? (
          <Banner tone="danger" title={t(restriction.titleKey)} message={t(restriction.messageKey)} />
        ) : null}

        {/* Heartbeat warning */}
        {heartbeat.isUnreachable ? (
          <Banner
            tone="warning"
            title={t('driver.connectionIssue')}
            message={t('driver.connectionMessage')}
          />
        ) : null}

        {heartbeat.hasLocationPermission === false && hasActiveTrip ? (
          <Banner
            tone="info"
            title={t('driver.locationDenied')}
            message={t('driver.locationMessage')}
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
                  label={t('driver.manageTrip')}
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
                  label={t('driver.manageTrip')}
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
                <Banner tone="danger" title={t('driver.tripSuspendedTitle')} message={t('driver.tripSuspendedMessage')} />
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
                title={t('driver.noAutoTitle')}
                message={t('driver.noAutoMessage')}
              />
            ) : (
              <Card>
                <AppText variant="heading" style={styles.sectionTitle}>
                  {t('driver.openTrip')}
                </AppText>
                <AppText variant="small" color={colors.ink500} style={styles.sectionHint}>
                  {t('driver.selectRoute', { registration: auto.registration_number })}
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
                  label={t('driver.openTripButton')}
                  variant="primary"
                  icon="play-circle-outline"
                  loading={openTripMutation.isPending}
                  disabled={!selectedRouteId || isMutating}
                  onPress={handleOpenTrip}
                />
                {openTripMutation.isError ? (
                  <Banner tone="danger" title={t('driver.couldNotOpen')} message={openTripMutation.error.message} />
                ) : null}
              </Card>
            )}
          </>
        ) : null}

        {/* Go online / Go offline */}
        {!isOnline && !hasActiveTrip && !restriction ? (
          <Button
            label={t('driver.goOnline')}
            variant="primary"
            icon="power"
            loading={goOnlineMutation.isPending}
            onPress={handleGoOnline}
          />
        ) : null}
        {isOnline && !hasActiveTrip ? (
          <Button
            label={t('driver.goOffline')}
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
            label={t('driver.cancelTrip')}
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
                  {t('driver.todaysEarnings')}
                </AppText>
                <AppText variant="heading" color={colors.green700}>
                  {formatRupees((home.earnings as Record<string, unknown>).earnings_paise as number)}
                </AppText>
              </View>
              <AppText variant="small" color={colors.ink500}>
                {t('driver.trips', { count: (home.earnings as Record<string, unknown>).completed_trips as number })}
              </AppText>
            </View>
          </Card>
        ) : null}
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
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  flex: { flex: 1 },
  tripHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  tripActions: { marginTop: spacing.md, gap: spacing.sm },
  sectionTitle: { marginBottom: spacing.xs },
  sectionHint: { marginBottom: spacing.md },
  earningsRow: { flexDirection: 'row', alignItems: 'center' },
});
