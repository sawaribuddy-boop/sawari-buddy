import { Alert } from 'react-native';

import { useMyActiveBooking } from '@/features/booking/useMyActiveBooking';

import { passengerBookingNotice, passengerRideEndedNotice, passengerTripStartedNotice, type RideContext } from './notices';
import { useTripChannel } from './useTripChannel';

interface ActiveBooking {
  booking?: { id: string; trip_id: string; total_fare_paise?: number };
  route?: { destination?: string };
  driver?: { first_name?: string };
}

/**
 * The passenger's single subscription: the trip of their active booking, on every passenger
 * screen. Alerts them when the driver, the unreachable sweep or an admin ends their booking, and
 * calls `onNotice` when their ride starts and when it ends.
 */
export function usePassengerTripChannel(onNotice: (text: string) => void) {
  const { data } = useMyActiveBooking();
  const active = data as ActiveBooking | null;
  const booking = active?.booking;
  // Read before the event's refetch clears the active booking (the ride just ended).
  const ride: RideContext = {
    destination: active?.route?.destination,
    driverFirstName: active?.driver?.first_name,
    totalFarePaise: booking?.total_fare_paise,
  };

  useTripChannel(booking?.trip_id, {
    onBookingChanged: (event) => {
      const notice = passengerBookingNotice(event, booking?.id);
      if (notice) Alert.alert(notice.title, notice.message);
      const ended = passengerRideEndedNotice(event, booking?.id, ride);
      if (ended) onNotice(ended);
    },
    onTripChanged: (event) => {
      const started = passengerTripStartedNotice(event, ride);
      if (started) onNotice(started);
    },
  });
}
