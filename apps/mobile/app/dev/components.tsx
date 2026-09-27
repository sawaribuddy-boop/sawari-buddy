import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  BrandMark,
  Button,
  Card,
  Icon,
  ListRow,
  Screen,
  SeatBar,
  Sheet,
  StatusPill,
  Stepper,
  TextField,
} from '@/components';
import { colors, spacing } from '@/theme';
import { formatApproxDistance, formatRupees } from '@sawari/domain';

// DEVELOPMENT-ONLY design preview of the base components. Everything shown is sample
// content for visual review; nothing here reads or writes data. Not reachable in production builds.
export default function ComponentsPreview() {
  const [seats, setSeats] = useState(1);
  const [occupied, setOccupied] = useState(3);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [walkIns, setWalkIns] = useState(1);

  if (!__DEV__) return <Redirect href="/welcome" />;

  return (
    <Screen scroll edges={['bottom']}>
      <View style={styles.stack}>
        <Section title="Brand (placeholder)">
          <BrandMark />
        </Section>

        <Section title="Typography">
          <AppText variant="display">Display</AppText>
          <AppText variant="title">Title — Where are you going?</AppText>
          <AppText variant="heading">Heading — Station 1 → Dream City</AppText>
          <AppText>Body — Your seat has been reserved.</AppText>
          <AppText variant="small" color={colors.ink500}>
            Small — Driver: Raj
          </AppText>
          <AppText variant="caption" color={colors.ink500}>
            Caption — Location updated 10 s ago
          </AppText>
        </Section>

        <Section title="Buttons">
          <Button label="Book Seat" />
          <Button label="Cancel Booking" variant="secondary" />
          <Button label="Go Offline" variant="dangerSoft" />
          <Button label="Add Walk-in Passenger" variant="ghost" icon="account-plus-outline" />
          <Button label="Loading" loading />
          <Button label="Disabled" disabled />
        </Section>

        <Section title="Status pills">
          <View style={styles.wrapRow}>
            <StatusPill label="Confirmed" tone="success" />
            <StatusPill label="Boarded" tone="success" />
            <StatusPill label="Expected" tone="warning" />
            <StatusPill label="No-show" tone="danger" />
            <StatusPill label="Completed" tone="info" />
            <StatusPill label="Available" tone="neutral" />
          </View>
        </Section>

        <Section title="Stepper + seat bar">
          <View style={styles.between}>
            <AppText variant="bodyStrong">Seats</AppText>
            <Stepper label="Seats" value={seats} min={1} max={3} onChange={setSeats} />
          </View>
          <SeatBar occupied={occupied} capacity={5} />
          <Stepper label="Occupied (preview)" value={occupied} min={0} max={5} onChange={setOccupied} />
        </Section>

        <Section title="Available auto card (sample)">
          <Card>
            <View style={styles.autoRow}>
              <View style={styles.autoIcon}>
                <Icon name="rickshaw" size={34} color={colors.green800} />
              </View>
              <View style={styles.flex}>
                <AppText variant="heading">DL01AB1234</AppText>
                <AppText variant="small" color={colors.ink500}>
                  Driver: Raj · 2 seats available
                </AppText>
                <AppText variant="small" color={colors.green700}>
                  {formatApproxDistance(1234)} (straight line)
                </AppText>
              </View>
              <AppText variant="heading">{formatRupees(3000)}</AppText>
            </View>
            <View style={styles.cardAction}>
              <Button label="Book Seat" size="md" />
            </View>
          </Card>
        </Section>

        <Section title="Banners">
          <Banner tone="warning" title="Driver unreachable" message="No new bookings until the driver reconnects." />
          <Banner tone="success" title="Final call" message="Please board now." />
          <Banner tone="danger" title="No seat available" message="Someone took the last seat. Try another auto." />
          <Banner tone="info" title="You are offline" message="Check your connection." />
        </Section>

        <Section title="List rows">
          <Card padded={false} style={styles.listCard}>
            <ListRow icon="rickshaw" title="My Auto" subtitle="DL01AB1234" onPress={() => undefined} />
            <ListRow icon="map-marker-path" title="Select Route" subtitle="Station 1 → Dream City" onPress={() => undefined} />
            <ListRow
              icon="currency-inr"
              title="Earnings"
              iconBackground={colors.autoYellowSoft}
              iconColor={colors.warning}
              onPress={() => undefined}
            />
          </Card>
        </Section>

        <Section title="Text field">
          <TextField label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
          <TextField label="Password" secureTextEntry error="Password must be at least 8 characters" />
        </Section>

        <Section title="Bottom sheet">
          <Button label="Open sheet" variant="secondary" onPress={() => setSheetOpen(true)} />
        </Section>
      </View>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Add walk-in passenger">
        <View style={styles.between}>
          <AppText variant="bodyStrong">Seats</AppText>
          <Stepper label="Walk-in seats" value={walkIns} min={1} max={4} onChange={setWalkIns} />
        </View>
        <TextField label="Note (optional)" placeholder="e.g. blue shirt" />
        <Button label="Add to trip" onPress={() => setSheetOpen(false)} />
      </Sheet>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="caption" color={colors.ink500} style={styles.sectionTitle}>
        {title.toUpperCase()}
      </AppText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xl, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  sectionTitle: { letterSpacing: 0.8 },
  sectionBody: { gap: spacing.md },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  autoRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  autoIcon: { width: 56, height: 56, borderRadius: 14, backgroundColor: colors.autoYellowSoft, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  cardAction: { marginTop: spacing.md },
  listCard: { paddingHorizontal: spacing.md },
});
