import type { BookingStatus } from '@sawari/constants';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText, Banner, type BookingHistoryRowData, BookingHistoryRow, OfflineBanner, Screen } from '@/components';
import { useMyBookingHistory } from '@/features/booking';
import { colors, spacing } from '@/theme';

export default function BookingsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isRefetching } =
    useMyBookingHistory();

  const allBookings: BookingHistoryRowData[] = (data?.pages ?? []).flatMap((page) => {
    if (!Array.isArray(page)) return [];
    return (page as Record<string, unknown>[]).map((b) => ({
      id: b.id as string,
      code: b.code as string,
      status: b.status as BookingStatus,
      origin: b.origin as string,
      destination: b.destination as string,
      createdAt: b.created_at as string,
    }));
  });

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <AppText variant="title">My bookings</AppText>
        <OfflineBanner />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green600} />
        </View>
      ) : isError ? (
        <View style={styles.padded}>
          <Banner tone="danger" title="Could not load bookings" message="Pull down to retry." />
        </View>
      ) : allBookings.length === 0 ? (
        <View style={styles.center}>
          <AppText variant="body" color={colors.ink500}>
            No bookings yet
          </AppText>
          <AppText variant="small" color={colors.ink400}>
            Your booking history will appear here
          </AppText>
        </View>
      ) : (
        <FlatList
          data={allBookings}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.green600} />}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={colors.green600} style={styles.footer} /> : null}
          renderItem={({ item }) => (
            <BookingHistoryRow
              booking={item}
              onPress={() =>
                router.push({
                  pathname: '/(passenger)/booking-detail',
                  params: { bookingId: item.id },
                })
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  padded: { paddingHorizontal: spacing.lg },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  footer: { paddingVertical: spacing.lg },
});
