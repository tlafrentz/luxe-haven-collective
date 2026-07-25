import { requireUser } from "@/lib/auth/session";
import {
  getBooking,
  getBookings,
  SupabaseBookingReadRepository,
  type BookingFilters,
  type BookingLifecycleStatus,
} from "@/features/bookings";
import { BookingWorkspace } from "@/features/bookings/presentation/booking-workspace";
import {
  getReservationContext,
  getReservationContexts,
  SupabaseReservationContextRepository,
} from "@/features/reservation-context";
import {
  buildWorkspaceOperationalDataHealth,
  evaluateBookingQuality,
} from "@/platform/operational-data-quality";

type BookingsPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const statuses = new Set<BookingLifecycleStatus>([
  "upcoming",
  "arriving-today",
  "checked-in",
  "in-stay",
  "checking-out-today",
  "completed",
  "cancelled",
]);

export default async function BookingsPage({
  searchParams,
}: BookingsPageProps) {
  const { user, profile } = await requireUser();
  const params = await searchParams;
  const statusValue = first(params.status);
  const filters: BookingFilters = {
    propertyId: first(params.property) || undefined,
    source: first(params.source) || undefined,
    arrivalFrom: first(params.arrivalFrom) || first(params.start) || undefined,
    departureTo: first(params.departureTo) || first(params.end) || undefined,
    query: first(params.query) || undefined,
    status:
      statusValue && statuses.has(statusValue as BookingLifecycleStatus)
        ? (statusValue as BookingLifecycleStatus)
        : undefined,
  };
  const repository = new SupabaseBookingReadRepository();
  const model = await getBookings(repository, user.id, filters);
  const selectedId = first(params.booking);
  const selectedBooking = selectedId
    ? await getBooking(repository, user.id, selectedId)
    : model.bookings[0] ?? null;
  const contextRepository = new SupabaseReservationContextRepository();
  const principal = {
    userId: user.id,
    workspaceId: user.id,
    role: profile?.role ?? ("guest" as const),
  };
  const contexts = await getReservationContexts(
    contextRepository,
    principal,
    {},
    "operational-summary",
  );
  const selectedContext = selectedBooking
    ? await getReservationContext(
        contextRepository,
        principal,
        selectedBooking.id,
        profile?.role === "owner" || profile?.role === "admin"
          ? "operational-contact"
          : "operational-summary",
      )
    : null;
  const qualityByBookingId = Object.fromEntries(
    contexts.map((context) => [
      context.bookingId,
      evaluateBookingQuality({
        workspaceId: user.id,
        bookingId: context.bookingId,
        propertyId: context.property.id,
        propertyWorkspaceId: user.id,
        arrival: context.stay.window.arrivalDate,
        departure: context.stay.window.departureDate,
        status:
          context.stay.stage === "cancelled"
            ? "cancelled"
            : ["post-stay", "closed"].includes(context.stay.stage)
              ? "completed"
              : "confirmed",
        stayStage: context.stay.stage,
        observedAt: context.freshness.bookingObservedAt,
        provider: context.provenance.provider,
        externalReservationId: context.provenance.externalReservationId,
        guestId: context.guest.identity.guestId,
        guestIdentityStatus: context.guest.identity.status,
        contactAvailable: context.contactAvailability.state === "available",
        partyInconsistent: context.party.inconsistent,
        partyTotal:
          context.party.totalGuests === null
            ? { state: "unknown" }
            : { state: "known", value: context.party.totalGuests },
        propertyTimezoneConfidence: context.stay.window.timingConfidence,
        urgency: ["arriving-today", "in-stay"].includes(context.stay.stage)
          ? (context.stay.stage as "arriving-today" | "in-stay")
          : "default",
        providerConnected: context.freshness.providerAvailable,
        mappingVersion: context.provenance.provider
          ? "hospitable-reservation-v1"
          : null,
        profile: "booking-list",
      }),
    ]),
  );
  const qualitySummary = buildWorkspaceOperationalDataHealth(
    Object.values(qualityByBookingId).map((quality) => ({
      product: "bookings",
      quality,
    })),
  );

  return (
    <BookingWorkspace
      model={model}
      filters={filters}
      selectedBooking={selectedBooking}
      selectedContext={selectedContext}
      qualityByBookingId={qualityByBookingId}
      qualitySummary={qualitySummary}
      contextValue={{
        workspaceId: user.id,
        workspaceLabel: profile?.full_name
          ? `${profile.full_name}'s Workspace`
          : "Luxe Haven Workspace",
        propertyId: filters.propertyId,
        startDate: filters.arrivalFrom,
        endDate: filters.departureTo,
      }}
    />
  );
}
