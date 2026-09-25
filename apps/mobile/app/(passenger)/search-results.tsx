import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Screen, type TripCardData, TripCard } from '@/components';
import { useSearchTrips, useStops } from '@/features/trip';
import { colors, spacing } from '@/theme';

export default function SearchResultsScreen() {
  const { originId, destinationId, seatCount: seatCountStr } = useLocalSearchParams<{
    originId: string;
    destinationId: string;
    seatCount: string;
  }>();
  const router = useRouter();
  const seatCount = Number(seatCountStr) || 1;

  const { data: stops } = useStops();
  const { data: trips, isLoading, isError, refetch } = useSearchTrips(originId ?? null, destinationId ?? null);

  const stopsList = Array.isArray(stops) ? (stops as { id: string; name: string }[]) : [];
  const stopsMap = new Map(stopsList.map((s) => [s.id, s.name]));
  const originName = stopsMap.get(originId ?? '') ?? 'Origin';
  const destName = stopsMap.get(destinationId ?? '') ?? 'Destination';

  const tripsList = Array.isArray(trips) ? (trips as TripCardData[]) : [];

  return (
    <Screen edges={['top']} padded={false}>
      <View style={styles.header}>
        <Button
          label="Back"
          variant="ghost"
          icon="arrow-left"
          fullWidth={false}
          size="md"
          onPress={() => router.back()}
        />
        <View style={styles.titleArea}>
          <AppText variant="heading">
            {originName} → {destName}
          </AppText>
          <AppText variant="small" color={colors.ink500}>
            {seatCount} {seatCount === 1 ? 'seat' : 'seats'} · {tripsList.length} {tripsList.length === 1 ? 'auto' : 'autos'} found
          </AppText>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green600} />
          <AppText variant="body" color={colors.ink500}>
            Searching for shared autos...
          </AppText>
        </View>
      ) : isError ? (
        <View style={styles.padded}>
          <Banner tone="danger" title="Could not search" message="Something went wrong. Please try again." />
          <Button label="Retry" variant="secondary" onPress={() => void refetch()} />
        </View>
      ) : tripsList.length === 0 ? (
        <View style={styles.padded}>
          <Banner tone="info" title="No autos available" message="No shared autos are on this route right now. Try again in a moment." />
          <Button label="Refresh" variant="secondary" icon="refresh" onPress={() => void refetch()} />
        </View>
      ) : (
        <FlatList
          data={tripsList}
          keyExtractor={(t) => t.trip_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TripCard
              trip={item}
              seatCount={seatCount}
              onBook={() =>
                router.push({
                  pathname: '/(passenger)/confirm',
                  params: {
                    tripId: item.trip_id,
                    seatCount: String(seatCount),
                    farePaise: String(item.fare_paise),
                    autoRegistration: item.auto_registration,
                    driverFirstName: item.driver_first_name,
                    originId: originId ?? '',
                    destinationId: destinationId ?? '',
                    originName,
                    destName,
                    capacity: String(item.capacity),
                    availableSeats: String(item.available_seats),
                  },
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
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  titleArea: { gap: spacing.xxs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  padded: { paddingHorizontal: spacing.lg, gap: spacing.md },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
});
