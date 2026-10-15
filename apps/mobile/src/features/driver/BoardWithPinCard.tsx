import { errorMessageFor } from '@sawari/constants';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Card, TextField } from '@/components';
import { spacing } from '@/theme';

import { type BoardWithPinResult, useBoardWithPin } from './useBoardWithPin';

function resultBanner(result: BoardWithPinResult) {
  if (result.ok) {
    const name = result.passenger_first_name || 'Passenger';
    const seats = `${result.seat_count} ${result.seat_count === 1 ? 'seat' : 'seats'}`;
    return <Banner tone="success" title={result.already_boarded ? `${name} is already on board` : `${name} boarded (${seats})`} />;
  }
  if (result.reason === 'LOCKED') {
    return (
      <Banner
        tone="danger"
        title="Too many wrong PINs"
        message={`Try again in ${result.retry_after_seconds} seconds. Ask the passenger to check the PIN in their app.`}
      />
    );
  }
  return (
    <Banner
      tone="warning"
      title="PIN doesn't match any passenger on this trip"
      message={result.attempts_left > 0 ? `${result.attempts_left} ${result.attempts_left === 1 ? 'try' : 'tries'} left.` : 'No tries left for a minute.'}
    />
  );
}

/**
 * The driver boards an app passenger by typing the 4-digit PIN the passenger shows. The server
 * finds which passenger on this trip it belongs to (PINs are unique per trip).
 */
export function BoardWithPinCard({ tripId }: { tripId: string }) {
  const [pin, setPin] = useState('');
  const mutation = useBoardWithPin(tripId);

  function submit() {
    if (!/^\d{4}$/.test(pin)) return;
    mutation.mutate(pin, { onSuccess: (r) => r.ok && setPin('') });
  }

  return (
    <Card>
      <View style={styles.body}>
        <AppText variant="heading">Board a passenger</AppText>
        <AppText variant="small">Ask for the 4-digit PIN shown in their SawariBuddy app.</AppText>
        <View style={styles.row}>
          <View style={styles.input}>
            <TextField
              label="Passenger PIN"
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
              placeholder="4-digit PIN"
              keyboardType="number-pad"
              maxLength={4}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          </View>
          <Button
            label="Board"
            icon="check"
            size="md"
            fullWidth={false}
            disabled={pin.length !== 4}
            loading={mutation.isPending}
            onPress={submit}
          />
        </View>
        {mutation.data ? resultBanner(mutation.data) : null}
        {mutation.isError ? <Banner tone="danger" title={errorMessageFor(mutation.error)} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: { flex: 1 },
});
