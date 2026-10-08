import { formatRupees } from '@sawari/domain';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Banner, Card, Icon, StatusPill } from '@/components';
import { colors, spacing } from '@/theme';

import { type DriverTripHistoryItem, useDriverTripHistory } from './useDriverTripHistory';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function TripRow({ trip }: { trip: DriverTripHistoryItem }) {
  const completed = trip.status === 'COMPLETED';
  const earned = trip.fare_paise - trip.platform_fee_paise;
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.topLine}>
          <AppText variant="caption" color={colors.ink500}>
            {formatDateTime(trip.completed_at ?? trip.cancelled_at ?? trip.created_at)}
          </AppText>
          <StatusPill label={completed ? 'Completed' : 'Cancelled'} tone={completed ? 'neutral' : 'danger'} />
        </View>
        <View style={styles.route}>
          <AppText variant="bodyStrong">{trip.origin}</AppText>
          <Icon name="arrow-right" color={colors.ink400} size={14} />
          <AppText variant="bodyStrong">{trip.destination}</AppText>
        </View>
        {completed ? (
          <View style={styles.figures}>
            <AppText variant="small" color={colors.ink500}>
              {trip.passenger_count} {trip.passenger_count === 1 ? 'passenger' : 'passengers'} · {trip.seat_count}{' '}
              {trip.seat_count === 1 ? 'seat' : 'seats'}
            </AppText>
            <AppText variant="bodyStrong" color={colors.green700}>
              {formatRupees(earned)}
            </AppText>
          </View>
        ) : (
          <AppText variant="small" color={colors.ink500}>
            {trip.auto_registration}
          </AppText>
        )}
        {completed && (trip.unpaid_count > 0 || trip.payment_pending_count > 0) ? (
          <AppText variant="small" color={colors.warning}>
            {[
              trip.unpaid_count > 0 ? `${trip.unpaid_count} not paid` : null,
              trip.payment_pending_count > 0 ? `${trip.payment_pending_count} payment to mark` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

/** The driver's past trips with what they earned on each (fare minus platform fee). */
export function DriverTripHistoryList() {
  const { data, isLoading, isError, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useDriverTripHistory();
  const trips = (data?.pages ?? []).flat();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green600} />
      </View>
    );
  }

  return (
    <FlatList
      data={trips}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.green600} />}
      ListHeaderComponent={isError ? <Banner tone="danger" title="Could not load your trips" message="Pull down to retry." /> : null}
      ListEmptyComponent={
        isError ? null : (
          <View style={styles.center}>
            <AppText variant="body" color={colors.ink500}>
              No trips yet
            </AppText>
            <AppText variant="small" color={colors.ink400}>
              Completed and cancelled trips will appear here
            </AppText>
          </View>
        )
      }
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.green600} style={styles.footer} /> : null}
      renderItem={({ item }) => <TripRow trip={item} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  row: { gap: spacing.xs },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  route: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  figures: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footer: { paddingVertical: spacing.lg },
});
