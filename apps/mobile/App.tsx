// Phase 1 skeleton only: proves the app builds for Android + iOS and consumes shared workspace packages.
// Passenger and driver screens arrive in Phases 3 and 4.
import { BOOKING_STATUS } from '@sawari/constants';
import { formatApproxDistance, formatRupees } from '@sawari/domain';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SawariBuddy</Text>
      <Text style={styles.subtitle}>Development skeleton — no screens yet</Text>
      <Text style={styles.meta}>
        Shared packages linked: {formatRupees(3000)} · {formatApproxDistance(1234)} · {BOOKING_STATUS.CONFIRMED}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#15803d' },
  subtitle: { marginTop: 8, fontSize: 16, color: '#374151' },
  meta: { marginTop: 16, fontSize: 12, color: '#6b7280', textAlign: 'center' },
});
