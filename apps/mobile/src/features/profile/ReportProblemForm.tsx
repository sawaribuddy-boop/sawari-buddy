import { errorMessageFor } from '@sawari/constants';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, type RadioOption, RadioList, TextField } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyBookingHistory } from '@/features/booking';
import type { IssueKind } from '@/lib/api';
import { colors, spacing } from '@/theme';

import { useDriverTripHistory } from './useDriverTripHistory';
import { useRaiseIssue } from './useRaiseIssue';

type ReportableKind = Extract<IssueKind, 'BOOKING_ISSUE' | 'DRIVER_BEHAVIOUR' | 'PAYMENT' | 'OTHER'>;

const PASSENGER_KINDS: RadioOption<ReportableKind>[] = [
  { value: 'BOOKING_ISSUE', label: 'Problem with a booking' },
  { value: 'DRIVER_BEHAVIOUR', label: "Driver's behaviour" },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'OTHER', label: 'Something else' },
];

const DRIVER_KINDS: RadioOption<ReportableKind>[] = [
  { value: 'BOOKING_ISSUE', label: 'Problem with a booking or passenger' },
  { value: 'PAYMENT', label: 'Payment or earnings' },
  { value: 'OTHER', label: 'Something else' },
];

const NO_RIDE = 'none';
const RECENT_RIDES = 5;
const MIN_DESCRIPTION = 10;
const MAX_DESCRIPTION = 2000;

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Recent rides to attach, as booking ids (passenger) or trip ids (driver). */
function useRecentRides(isDriver: boolean): RadioOption<string>[] {
  const bookings = useMyBookingHistory({ enabled: !isDriver });
  const trips = useDriverTripHistory({ enabled: isDriver });
  if (isDriver) {
    return (trips.data?.pages[0] ?? []).slice(0, RECENT_RIDES).map((t) => ({
      value: t.id,
      label: `${t.origin} → ${t.destination}`,
      hint: `${shortDate(t.created_at)} · ${t.status === 'COMPLETED' ? 'Completed' : 'Cancelled'}`,
    }));
  }
  const page = bookings.data?.pages[0];
  return (Array.isArray(page) ? (page as Record<string, unknown>[]) : []).slice(0, RECENT_RIDES).map((b) => ({
    value: b.id as string,
    label: `${b.origin as string} → ${b.destination as string}`,
    hint: `${shortDate(b.created_at as string)} · #${b.code as string}`,
  }));
}

export function ReportProblemForm({ onDone }: { onDone: () => void }) {
  const { account } = useAuth();
  const isDriver = account?.role === 'DRIVER';
  const [kind, setKind] = useState<ReportableKind | null>(null);
  const [rideId, setRideId] = useState<string>(NO_RIDE);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const recentRides = useRecentRides(isDriver);
  const mutation = useRaiseIssue();

  function submit() {
    const next: Record<string, string> = {};
    if (!kind) next.kind = 'Choose what the problem is about';
    if (description.trim().length < MIN_DESCRIPTION) next.description = `Tell us a little more (at least ${MIN_DESCRIPTION} characters)`;
    setErrors(next);
    if (!kind || Object.keys(next).length > 0) return;

    const ride = rideId === NO_RIDE ? {} : isDriver ? { tripId: rideId } : { bookingId: rideId };
    mutation.mutate(
      { kind, description: description.trim(), ...ride },
      {
        onSuccess: () => {
          Alert.alert('Thanks for telling us', 'Our support team will look into it and get back to you.');
          onDone();
        },
      },
    );
  }

  return (
    <View style={styles.body}>
      {mutation.isError ? <Banner tone="danger" title="Couldn't send your report" message={errorMessageFor(mutation.error)} /> : null}

      <View style={styles.group}>
        <AppText variant="bodyStrong">What is it about?</AppText>
        <RadioList label="Problem type" options={isDriver ? DRIVER_KINDS : PASSENGER_KINDS} value={kind} onChange={setKind} />
        {errors.kind ? (
          <AppText variant="caption" color={colors.danger}>
            {errors.kind}
          </AppText>
        ) : null}
      </View>

      {recentRides.length > 0 ? (
        <View style={styles.group}>
          <AppText variant="bodyStrong">Which ride? (optional)</AppText>
          <RadioList
            label="Ride"
            options={[{ value: NO_RIDE, label: 'Not about a specific ride' }, ...recentRides]}
            value={rideId}
            onChange={setRideId}
          />
        </View>
      ) : null}

      <TextField
        label="What happened?"
        value={description}
        onChangeText={setDescription}
        error={errors.description}
        placeholder="Describe the problem"
        multiline
        maxLength={MAX_DESCRIPTION}
      />

      <Button label="Send report" icon="send" loading={mutation.isPending} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  group: { gap: spacing.sm },
});
