// Generated database types (`pnpm db:types`) plus convenience aliases.
import type { Database } from './database';

export type { Database, Json } from './database';

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
export type RpcArgs<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]['Args'];
export type RpcReturns<T extends keyof PublicSchema['Functions']> = PublicSchema['Functions'][T]['Returns'];

export type Trip = Tables<'trips'>;
export type Booking = Tables<'bookings'>;
export type DriverPresence = Tables<'driver_presence'>;
export type Route = Tables<'routes'>;
export type Stop = Tables<'stops'>;
export type Auto = Tables<'autos'>;
export type Profile = Tables<'profiles'>;
