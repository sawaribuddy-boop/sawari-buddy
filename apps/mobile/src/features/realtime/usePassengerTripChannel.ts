import { Alert } from 'react-native';

import { useMyActiveBooking } from '@/features/booking/useMyActiveBooking';

import { passengerBookingNotice } from './notices';
import { useTripChannel } from './useTripChannel';

/**
 * The passenger's single subscription: the trip of their active booking, on every passenger
 * screen. Alerts them when the driver, the unreachable sweep or an admin ends their booking.
 */
export function usePassengerTripChannel() {
  const { data } = useMyActiveBooking();
  const booking = (data as { booking?: { id: string; trip_id: string } } | null)?.booking;

  useTripChannel(booking?.trip_id, {
    onBookingChanged: (event) => {
      const notice = passengerBookingNotice(event, booking?.id);
      if (notice) Alert.alert(notice.title, notice.message);
    },
  });
}
