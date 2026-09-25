// Pure, platform-free helpers shared by mobile and admin. DISPLAY ONLY: authoritative
// rules (availability, fares, fees, state changes) are enforced in the database.

import type { DriverAvailability } from '@sawari/constants';

const EARTH_RADIUS_M = 6_371_008.8;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Straight-line (great-circle) distance in metres. Not road distance. Mirrors private.haversine_m. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

/** "≈ 450 m away" / "≈ 1.2 km away". Always labelled approximate: it is a straight line. */
export function formatApproxDistance(meters: number): string {
  if (meters < 1000) {
    return `≈ ${Math.max(10, Math.round(meters / 10) * 10)} m away`;
  }
  return `≈ ${(meters / 1000).toFixed(1)} km away`;
}

/** Fee preview; mirrors private.platform_fee (integer paise, half-up rounding). */
export function splitFare(totalPaise: number, commissionBps: number): { platformFeePaise: number; driverEarningPaise: number } {
  if (!Number.isInteger(totalPaise) || totalPaise < 0) throw new RangeError('totalPaise must be a non-negative integer');
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10_000) {
    throw new RangeError('commissionBps must be an integer between 0 and 10000');
  }
  const platformFeePaise = Math.floor((totalPaise * commissionBps + 5000) / 10_000);
  return { platformFeePaise, driverEarningPaise: totalPaise - platformFeePaise };
}

/** ₹ display for integer paise: 3000 -> "₹30", 2550 -> "₹25.50". */
export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees.toString() : rupees.toFixed(2)}`;
}

/** Derived availability, same rule as private.driver_is_reachable (the server decides for bookings). */
export function driverAvailability(
  isOnline: boolean,
  lastSeenAt: string | Date | null,
  staleSeconds: number,
  now: Date = new Date(),
): DriverAvailability {
  if (!isOnline) return 'OFFLINE';
  if (lastSeenAt === null) return 'UNREACHABLE';
  const ageMs = now.getTime() - new Date(lastSeenAt).getTime();
  return ageMs <= staleSeconds * 1000 ? 'ONLINE' : 'UNREACHABLE';
}

/** Seconds until a timestamp (0 if passed), e.g. for the no-show countdown. */
export function secondsUntil(target: string | Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(target).getTime() - now.getTime()) / 1000));
}

/** "Good morning" / "Good afternoon" / "Good evening" (driver home greeting, concept D1). */
export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** First word of a full name ("Priya Sharma" -> "Priya"). */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
