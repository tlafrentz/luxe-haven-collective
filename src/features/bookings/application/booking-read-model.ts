import type {
  Booking,
  BookingLifecycleStatus,
  SynchronizationStatus,
} from "../domain";

export type BookingFilters = Readonly<{
  propertyId?: string;
  status?: BookingLifecycleStatus;
  source?: string;
  arrivalFrom?: string;
  departureTo?: string;
  query?: string;
}>;

export type BookingHealth = Readonly<{
  upcoming: number;
  arrivingToday: number;
  inStay: number;
  checkingOutToday: number;
  synchronizationStatus: SynchronizationStatus;
  lastSuccessfulSync: string | null;
}>;

export type BookingReadModel = Readonly<{
  bookings: readonly Booking[];
  health: BookingHealth;
  properties: readonly Readonly<{ id: string; name: string }>[];
  sources: readonly string[];
}>;

export interface BookingReadRepository {
  list(ownerId: string): Promise<readonly Booking[]>;
  get(ownerId: string, bookingId: string): Promise<Booking | null>;
}

function matchesFilters(
  booking: Booking,
  filters: BookingFilters,
): boolean {
  const query = filters.query?.trim().toLowerCase();

  return (
    (!filters.propertyId || booking.property.id === filters.propertyId) &&
    (!filters.status || booking.status === filters.status) &&
    (!filters.source || booking.provider.source === filters.source) &&
    (!filters.arrivalFrom || booking.stay.arrival >= filters.arrivalFrom) &&
    (!filters.departureTo || booking.stay.departure <= filters.departureTo) &&
    (!query ||
      [
        booking.guest.name,
        booking.property.name,
        booking.confirmationCode ?? "",
      ].some((value) => value.toLowerCase().includes(query)))
  );
}

export async function getBookings(
  repository: BookingReadRepository,
  ownerId: string,
  filters: BookingFilters = {},
): Promise<BookingReadModel> {
  const allBookings = await repository.list(ownerId);
  const bookings = allBookings.filter((booking) =>
    matchesFilters(booking, filters),
  );
  const lastSuccessfulSync =
    allBookings
      .map((booking) => booking.provider.lastSynchronizedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  const synchronizationStatus =
    allBookings.find(
      (booking) =>
        booking.provider.synchronizationStatus === "sync-in-progress",
    )?.provider.synchronizationStatus ??
    allBookings.find(
      (booking) => booking.provider.synchronizationStatus === "failed",
    )?.provider.synchronizationStatus ??
    allBookings.find(
      (booking) =>
        booking.provider.lastSynchronizedAt === lastSuccessfulSync,
    )?.provider.synchronizationStatus ??
    "never-synchronized";

  return {
    bookings,
    health: {
      upcoming: allBookings.filter((booking) => booking.status === "upcoming")
        .length,
      arrivingToday: allBookings.filter(
        (booking) => booking.status === "arriving-today",
      ).length,
      inStay: allBookings.filter(
        (booking) =>
          booking.status === "in-stay" || booking.status === "checked-in",
      ).length,
      checkingOutToday: allBookings.filter(
        (booking) => booking.status === "checking-out-today",
      ).length,
      synchronizationStatus,
      lastSuccessfulSync,
    },
    properties: Array.from(
      new Map(
        allBookings.map((booking) => [booking.property.id, booking.property]),
      ).values(),
    ).sort((left, right) => left.name.localeCompare(right.name)),
    sources: Array.from(
      new Set(allBookings.map((booking) => booking.provider.source)),
    ).sort(),
  };
}

export async function getBooking(
  repository: BookingReadRepository,
  ownerId: string,
  bookingId: string,
): Promise<Booking | null> {
  return repository.get(ownerId, bookingId);
}

export const searchBookings = getBookings;

export async function getUpcomingBookings(
  repository: BookingReadRepository,
  ownerId: string,
): Promise<BookingReadModel> {
  return getBookings(repository, ownerId, { status: "upcoming" });
}

export async function getArrivalsToday(
  repository: BookingReadRepository,
  ownerId: string,
): Promise<BookingReadModel> {
  return getBookings(repository, ownerId, { status: "arriving-today" });
}

export async function getDeparturesToday(
  repository: BookingReadRepository,
  ownerId: string,
): Promise<BookingReadModel> {
  return getBookings(repository, ownerId, {
    status: "checking-out-today",
  });
}
