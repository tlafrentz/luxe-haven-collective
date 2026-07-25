export const bookingLifecycleStatuses = [
  "upcoming",
  "arriving-today",
  "checked-in",
  "in-stay",
  "checking-out-today",
  "completed",
  "cancelled",
] as const;

export type BookingLifecycleStatus =
  (typeof bookingLifecycleStatuses)[number];

export type StoredBookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

export type SynchronizationStatus =
  | "current"
  | "failed"
  | "never-synchronized"
  | "sync-in-progress"
  | "stale";

export type StayPeriod = Readonly<{
  arrival: string;
  departure: string;
  nights: number;
}>;

export type BookingGuestSummary = Readonly<{
  name: string;
  email: string | null;
  phone: string | null;
  partySize: number;
}>;

export type BookingFinancialSummary = Readonly<{
  total: number;
  currency: string | null;
}>;

export type BookingProviderMetadata = Readonly<{
  provider: string;
  source: string;
  lastSynchronizedAt: string | null;
  synchronizationStatus: SynchronizationStatus;
}>;

export type Booking = Readonly<{
  id: string;
  confirmationCode: string | null;
  property: Readonly<{ id: string; name: string }>;
  guest: BookingGuestSummary;
  stay: StayPeriod;
  status: BookingLifecycleStatus;
  financial: BookingFinancialSummary;
  provider: BookingProviderMetadata;
}>;

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function calculateStayNights(
  arrival: string,
  departure: string,
): number {
  const start = Date.parse(`${arrival}T00:00:00.000Z`);
  const end = Date.parse(`${departure}T00:00:00.000Z`);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("A booking departure must be after its arrival.");
  }

  return Math.round((end - start) / 86_400_000);
}

export function resolveBookingLifecycle({
  storedStatus,
  arrival,
  departure,
  now = new Date(),
  checkedIn = false,
}: Readonly<{
  storedStatus: StoredBookingStatus;
  arrival: string;
  departure: string;
  now?: Date;
  checkedIn?: boolean;
}>): BookingLifecycleStatus {
  if (storedStatus === "cancelled") return "cancelled";
  if (storedStatus === "completed") return "completed";

  const today = dateOnly(now);

  if (departure < today) return "completed";
  if (departure === today) return "checking-out-today";
  if (arrival === today) return checkedIn ? "checked-in" : "arriving-today";
  if (arrival < today && departure > today) return "in-stay";

  return "upcoming";
}

export function resolveSynchronizationStatus({
  lastSynchronizedAt,
  running = false,
  failed = false,
  now = new Date(),
  staleAfterHours = 24,
}: Readonly<{
  lastSynchronizedAt: string | null;
  running?: boolean;
  failed?: boolean;
  now?: Date;
  staleAfterHours?: number;
}>): SynchronizationStatus {
  if (running) return "sync-in-progress";
  if (failed) return "failed";
  if (!lastSynchronizedAt) return "never-synchronized";

  const synchronizedAt = Date.parse(lastSynchronizedAt);
  if (!Number.isFinite(synchronizedAt)) return "failed";

  return now.getTime() - synchronizedAt >
    staleAfterHours * 60 * 60 * 1_000
    ? "stale"
    : "current";
}
