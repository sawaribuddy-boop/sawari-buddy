// Centralised query keys prevent typo-induced cache misses and make invalidation explicit.

export const queryKeys = {
  // Passenger
  myActiveBooking: ['my-active-booking'] as const,
  myBookingHistory: (before?: string) => ['my-booking-history', { before }] as const,
  myBooking: (id: string) => ['my-booking', id] as const,
  searchTrips: (origin: string, destination: string) => ['search-trips', { origin, destination }] as const,

  // Driver
  driverHome: ['driver-home'] as const,
  tripManifest: (tripId: string) => ['trip-manifest', tripId] as const,
  driverEarnings: (from?: string, to?: string) => ['driver-earnings', { from, to }] as const,

  // Shared
  platformSettings: ['platform-settings'] as const,
  stops: ['stops'] as const,
  routes: ['routes'] as const,
} as const;
