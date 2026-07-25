import {
  evaluateContactAvailability,
  evaluateContextFreshness,
  normalizeGuestName,
  normalizeReservationParty,
  resolvePropertyTimezone,
  resolveStayStage,
  type GuestIdentityStatus,
  type ReservationContext,
  type ReservationStatus,
  type StayStage,
} from "../domain";

export type ReservationContextAccess =
  | "operational-summary"
  | "operational-contact"
  | "privacy-reduced";

export type ReservationContextPrincipal = Readonly<{
  userId: string | null;
  workspaceId: string;
  role: "owner" | "admin" | "cleaner" | "guest";
}>;

export type ReservationContextSource = Readonly<{
  bookingId: string;
  reservationId: string;
  ownerId: string;
  bookingStatus: ReservationStatus;
  bookingSource: string;
  provider: string | null;
  externalReservationId: string | null;
  externalGuestId: string | null;
  guestId: string | null;
  guestIdentityStatus: GuestIdentityStatus | null;
  guestDisplayName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  guestLanguage: string | null;
  partyAdults: number | null;
  partyChildren: number | null;
  partyInfants: number | null;
  partyPets: number | null;
  partyTotal: number | null;
  propertyId: string;
  propertyName: string;
  propertyMarketLabel: string | null;
  propertyTimezone: string | null;
  workspaceTimezone: string | null;
  checkInTime: string;
  checkoutTime: string;
  propertyStatus: string;
  guidebookAvailable: boolean;
  primaryImage: string | null;
  arrivalDate: string;
  departureDate: string;
  platformMessagingAvailable: boolean | null;
  bookingObservedAt: string | null;
  guestObservedAt: string | null;
  propertyObservedAt: string | null;
  providerAvailable: boolean;
}>;

export type ReservationContextFilters = Readonly<{
  query?: string;
  propertyId?: string;
  stayStage?: StayStage;
}>;

export interface ReservationContextRepository {
  list(ownerId: string): Promise<readonly ReservationContextSource[]>;
  get(
    ownerId: string,
    bookingId: string,
  ): Promise<ReservationContextSource | null>;
}

export class ReservationContextAuthorizationError extends Error {
  constructor() {
    super("Reservation context is unavailable.");
    this.name = "ReservationContextAuthorizationError";
  }
}

export function canAccessContactDetails(
  principal: ReservationContextPrincipal,
): boolean {
  return Boolean(principal.userId) &&
    (principal.role === "owner" || principal.role === "admin");
}

export function buildReservationContext(
  source: ReservationContextSource,
  now = new Date(),
): ReservationContext {
  const timezone = resolvePropertyTimezone({
    propertyTimezone: source.propertyTimezone,
    workspaceTimezone: source.workspaceTimezone,
  });
  const window = {
    arrivalDate: source.arrivalDate,
    departureDate: source.departureDate,
    checkInTime: source.checkInTime,
    checkoutTime: source.checkoutTime,
    ...timezone,
  };
  const guestName = normalizeGuestName({ display: source.guestDisplayName });
  const identityStatus =
    source.guestIdentityStatus ??
    (guestName.complete ? "provisional" : "unidentified");
  const contactAvailability = evaluateContactAvailability({
    platformMessaging: source.platformMessagingAvailable,
    email: source.guestEmail,
    phone: source.guestPhone,
  });
  const freshness = evaluateContextFreshness({
    bookingObservedAt: source.bookingObservedAt,
    guestObservedAt: source.guestObservedAt,
    propertyObservedAt: source.propertyObservedAt,
    providerAvailable: source.providerAvailable,
    now,
  });
  const operationalNeeds: ReservationContext["operationalNeeds"][number][] = [];
  if (!guestName.complete || identityStatus === "unidentified")
    operationalNeeds.push("guest-details-incomplete");
  if (contactAvailability.state !== "available")
    operationalNeeds.push("contact-unavailable");
  if (identityStatus === "ambiguous") operationalNeeds.push("identity-review");
  if (timezone.timingConfidence === "reduced")
    operationalNeeds.push("timing-confidence-reduced");
  if (freshness.status !== "current") operationalNeeds.push("context-stale");

  return {
    reservationId: source.reservationId,
    bookingId: source.bookingId,
    workspaceId: source.ownerId,
    guest: {
      identity: {
        guestId: source.guestId ?? `provisional:${source.bookingId}`,
        status: identityStatus,
        providerReferences:
          source.provider && source.externalGuestId
            ? [
                {
                  provider: source.provider,
                  externalGuestId: source.externalGuestId,
                  lastObservedAt:
                    source.guestObservedAt ??
                    source.bookingObservedAt ??
                    new Date(0).toISOString(),
                },
              ]
            : [],
      },
      name: guestName,
      language: source.guestLanguage,
      contactPoints: [
        ...(source.guestEmail
          ? [
              {
                type: "email" as const,
                value: source.guestEmail,
                verified: false,
              },
            ]
          : []),
        ...(source.guestPhone
          ? [
              {
                type: "phone" as const,
                value: source.guestPhone,
                verified: false,
              },
            ]
          : []),
      ],
    },
    party: normalizeReservationParty({
      adults: source.partyAdults,
      children: source.partyChildren,
      infants: source.partyInfants,
      pets: source.partyPets,
      totalGuests: source.partyTotal,
    }),
    property: {
      id: source.propertyId,
      name: source.propertyName,
      marketLabel: source.propertyMarketLabel,
      timezone: timezone.timezone,
      checkInTime: source.checkInTime,
      checkoutTime: source.checkoutTime,
      operationalStatus: source.propertyStatus,
      guidebookAvailable: source.guidebookAvailable,
      primaryImage: source.primaryImage,
    },
    stay: {
      window,
      stage: resolveStayStage({
        status: source.bookingStatus,
        window,
        now,
      }),
    },
    contactAvailability,
    source: {
      bookingSource: source.bookingSource,
      providerLabel: source.provider
        ? "Connected hospitality platform"
        : "Luxe Haven",
    },
    provenance: {
      provider: source.provider,
      externalReservationId: source.externalReservationId,
      externalGuestId: source.externalGuestId,
      lastObservedAt: source.bookingObservedAt,
    },
    freshness,
    operationalNeeds,
  };
}

export function projectReservationContext(
  context: ReservationContext,
  access: ReservationContextAccess,
): ReservationContext {
  if (access === "operational-contact") return context;

  return {
    ...context,
    guest: {
      ...context.guest,
      contactPoints: [],
      identity: {
        ...context.guest.identity,
        providerReferences: [],
      },
    },
    provenance:
      access === "privacy-reduced"
        ? {
            provider: null,
            externalReservationId: null,
            externalGuestId: null,
            lastObservedAt: context.provenance.lastObservedAt,
          }
        : context.provenance,
  };
}

function authorize(
  principal: ReservationContextPrincipal,
  access: ReservationContextAccess,
) {
  if (!principal.userId) throw new ReservationContextAuthorizationError();
  if (
    access === "operational-contact" &&
    !canAccessContactDetails(principal)
  )
    throw new ReservationContextAuthorizationError();
}

export async function getReservationContexts(
  repository: ReservationContextRepository,
  principal: ReservationContextPrincipal,
  filters: ReservationContextFilters = {},
  access: ReservationContextAccess = "operational-summary",
  now = new Date(),
): Promise<readonly ReservationContext[]> {
  authorize(principal, access);
  const sources = await repository.list(principal.workspaceId);
  const query = filters.query?.trim().toLowerCase();

  return sources
    .map((source) => buildReservationContext(source, now))
    .filter(
      (context) =>
        (!filters.propertyId ||
          context.property.id === filters.propertyId) &&
        (!filters.stayStage || context.stay.stage === filters.stayStage) &&
        (!query ||
          [
            context.guest.name.display,
            context.property.name,
            context.reservationId,
          ].some((value) => value.toLowerCase().includes(query))),
    )
    .map((context) => projectReservationContext(context, access));
}

export async function getReservationContext(
  repository: ReservationContextRepository,
  principal: ReservationContextPrincipal,
  bookingId: string,
  access: ReservationContextAccess = "operational-summary",
  now = new Date(),
): Promise<ReservationContext | null> {
  authorize(principal, access);
  const source = await repository.get(principal.workspaceId, bookingId);
  return source
    ? projectReservationContext(buildReservationContext(source, now), access)
    : null;
}

export const searchReservationContexts = getReservationContexts;

export async function getContextsByStage(
  repository: ReservationContextRepository,
  principal: ReservationContextPrincipal,
  stayStage: StayStage,
  now = new Date(),
) {
  return getReservationContexts(
    repository,
    principal,
    { stayStage },
    "operational-summary",
    now,
  );
}

export async function getArrivingGuestContexts(
  repository: ReservationContextRepository,
  principal: ReservationContextPrincipal,
  now = new Date(),
) {
  return getContextsByStage(repository, principal, "arriving-today", now);
}

export async function getInStayGuestContexts(
  repository: ReservationContextRepository,
  principal: ReservationContextPrincipal,
  now = new Date(),
) {
  return getContextsByStage(repository, principal, "in-stay", now);
}

export async function getDepartingGuestContexts(
  repository: ReservationContextRepository,
  principal: ReservationContextPrincipal,
  now = new Date(),
) {
  return getContextsByStage(repository, principal, "departing-today", now);
}

export async function getUpcomingGuestContexts(
  repository: ReservationContextRepository,
  principal: ReservationContextPrincipal,
  now = new Date(),
) {
  const contexts = await getReservationContexts(
    repository,
    principal,
    {},
    "operational-summary",
    now,
  );
  return contexts.filter((context) =>
    ["confirmed", "pre-arrival", "arriving-today"].includes(context.stay.stage),
  );
}

export const resolveGuestIdentity = (
  matches: Readonly<{
    providerReferenceMatches: readonly string[];
    exactEmailMatches: readonly string[];
    exactPhoneMatches: readonly string[];
  }>,
): Readonly<{ status: GuestIdentityStatus; guestId: string | null }> => {
  const strong = new Set([
    ...matches.providerReferenceMatches,
    ...matches.exactEmailMatches,
    ...matches.exactPhoneMatches,
  ]);
  if (strong.size === 1)
    return { status: "resolved", guestId: [...strong][0] };
  if (strong.size > 1) return { status: "ambiguous", guestId: null };
  return { status: "provisional", guestId: null };
};
