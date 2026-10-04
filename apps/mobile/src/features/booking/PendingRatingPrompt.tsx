import { errorMessageFor } from '@sawari/constants';
import { useState } from 'react';

import { RateRideSheet } from '@/components';

import { useMyPendingRating } from './useMyPendingRating';
import { useRateBooking } from './useRateBooking';

// Rides the passenger chose "Not now" for. Kept for the app session only: the server stops
// offering a ride 24 hours after it completes, and it can still be rated from booking detail.
const dismissed = new Set<string>();

/**
 * Asks the passenger to rate a ride once it completes. Mounted once in the passenger layout,
 * so it appears over whichever screen they are on when the driver ends the trip, or the next
 * time they open the app if they missed it.
 */
export function PendingRatingPrompt() {
  const { data: pending } = useMyPendingRating();
  const rateMutation = useRateBooking();
  const [, setDismissedCount] = useState(0);

  const visible = pending != null && !dismissed.has(pending.booking_id);

  const close = () => {
    if (!pending) return;
    dismissed.add(pending.booking_id);
    setDismissedCount(dismissed.size);
    rateMutation.reset();
  };

  const alreadyRated = rateMutation.error?.message === 'ALREADY_RATED';

  return (
    <RateRideSheet
      visible={visible}
      onClose={close}
      onSubmit={(stars, comment) => {
        if (!pending) return;
        rateMutation.mutate({ bookingId: pending.booking_id, stars, comment }, { onSuccess: close });
      }}
      origin={pending?.origin ?? ''}
      destination={pending?.destination ?? ''}
      driverFirstName={pending?.driver_first_name ?? ''}
      isLoading={rateMutation.isPending}
      // ALREADY_RATED: rated on another device; the refetch drops this prompt.
      error={rateMutation.isError && !alreadyRated ? errorMessageFor(rateMutation.error) : undefined}
    />
  );
}
