import type { ReservationContext } from "@/features/reservation-context";
import {
  buildSynchronizationHealth,
  buildWorkspaceOperationalDataHealth,
  evaluateBookingQuality,
  type OperationalDataQuality,
  type SynchronizationHealth,
  type SynchronizationRunStatus,
  type WorkspaceOperationalDataHealth,
} from "@/platform/operational-data-quality";

export type OperationalPropertySource = Readonly<{
  id: string;
  ownerId: string;
  name: string;
  marketLabel: string | null;
  status: string;
  timezone: string | null;
  lastSynchronizedAt: string | null;
  connectionState: "connected" | "disconnected" | "unknown";
  guidebookAvailable: boolean;
  primaryImage: string | null;
  updatedAt: string;
}>;

export type OperationalSyncSource = Readonly<{
  status: SynchronizationRunStatus;
  providerLabel: string;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  warnings: readonly string[];
  affectedCapabilities: readonly string[];
  lastSuccessfulAt: string | null;
  providerConnected: boolean;
}>;

export type OperationalActivity = Readonly<{
  id: string;
  type:
    | "reservation-arriving"
    | "reservation-updated"
    | "guest-departed"
    | "property-updated"
    | "synchronization-completed";
  title: string;
  description: string;
  occurredAt: string;
  propertyId: string | null;
  bookingId: string | null;
  qualityStatus: OperationalDataQuality["status"] | null;
}>;

export type OperationalPropertySummary = Readonly<{
  property: OperationalPropertySource;
  upcomingArrivals: number;
  currentGuests: number;
  upcomingDepartures: number;
  reservations: readonly ReservationContext[];
  quality: WorkspaceOperationalDataHealth;
}>;

export type OperationalSurfaceProjection = Readonly<{
  workspace: Readonly<{ id: string; label: string }>;
  contexts: readonly ReservationContext[];
  properties: readonly OperationalPropertySummary[];
  qualityByBookingId: Readonly<Record<string, OperationalDataQuality>>;
  quality: WorkspaceOperationalDataHealth;
  synchronization: SynchronizationHealth;
  providerLabel: string;
  home: Readonly<{
    arrivalsToday: number;
    guestsInStay: number;
    departuresToday: number;
    openOperationalIssues: number;
  }>;
  activity: readonly OperationalActivity[];
  selectors: Readonly<{
    properties: readonly Readonly<{ id: string; label: string }>[];
  }>;
}>;

function bookingStatus(context: ReservationContext) {
  if (context.stay.stage === "cancelled") return "cancelled" as const;
  if (["post-stay", "closed"].includes(context.stay.stage))
    return "completed" as const;
  return "confirmed" as const;
}

function evaluateContext(
  workspaceId: string,
  context: ReservationContext,
  now: Date,
) {
  return evaluateBookingQuality(
    {
      workspaceId,
      bookingId: context.bookingId,
      propertyId: context.property.id,
      propertyWorkspaceId: workspaceId,
      arrival: context.stay.window.arrivalDate,
      departure: context.stay.window.departureDate,
      status: bookingStatus(context),
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
    },
    now,
  );
}

function buildActivity(
  contexts: readonly ReservationContext[],
  properties: readonly OperationalPropertySource[],
  qualityByBookingId: Readonly<Record<string, OperationalDataQuality>>,
  sync: OperationalSyncSource,
): readonly OperationalActivity[] {
  const reservationEvents = contexts.map((context): OperationalActivity => {
    const arriving = context.stay.stage === "arriving-today";
    const departed = ["post-stay", "closed"].includes(context.stay.stage);
    return {
      id: `reservation:${context.bookingId}:${context.freshness.bookingObservedAt ?? "unknown"}`,
      type: arriving
        ? "reservation-arriving"
        : departed
          ? "guest-departed"
          : "reservation-updated",
      title: arriving
        ? "Guest arriving"
        : departed
          ? "Guest departed"
          : "Reservation updated",
      description: `${context.guest.name.display} · ${context.property.name} · ${context.stay.stage.replaceAll("-", " ")}`,
      occurredAt:
        context.freshness.bookingObservedAt ??
        context.stay.window.arrivalDate,
      propertyId: context.property.id,
      bookingId: context.bookingId,
      qualityStatus: qualityByBookingId[context.bookingId]?.status ?? null,
    };
  });
  const propertyEvents = properties.map(
    (property): OperationalActivity => ({
      id: `property:${property.id}:${property.updatedAt}`,
      type: "property-updated",
      title: "Property updated",
      description: `${property.name} · ${property.status}`,
      occurredAt: property.updatedAt,
      propertyId: property.id,
      bookingId: null,
      qualityStatus: null,
    }),
  );
  const syncEvents: OperationalActivity[] = sync.lastSuccessfulAt
    ? [
        {
          id: `sync:${sync.lastSuccessfulAt}`,
          type: "synchronization-completed",
          title: "Synchronization completed",
          description: `${sync.providerLabel} · ${sync.created} created · ${sync.updated} updated`,
          occurredAt: sync.lastSuccessfulAt,
          propertyId: null,
          bookingId: null,
          qualityStatus: null,
        },
      ]
    : [];
  return [...reservationEvents, ...propertyEvents, ...syncEvents]
    .sort(
      (left, right) =>
        Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
    )
    .slice(0, 12);
}

export function buildOperationalSurfaceProjection(input: Readonly<{
  workspaceId: string;
  workspaceLabel: string;
  contexts: readonly ReservationContext[];
  properties: readonly OperationalPropertySource[];
  sync: OperationalSyncSource;
  now?: Date;
}>): OperationalSurfaceProjection {
  const now = input.now ?? new Date();
  const qualityByBookingId = Object.fromEntries(
    input.contexts.map((context) => [
      context.bookingId,
      evaluateContext(input.workspaceId, context, now),
    ]),
  );
  const quality = buildWorkspaceOperationalDataHealth(
    Object.values(qualityByBookingId).map((recordQuality) => ({
      product: "bookings",
      quality: recordQuality,
    })),
    now,
  );
  const synchronization = buildSynchronizationHealth(input.sync);
  const summaries = input.properties.map(
    (property): OperationalPropertySummary => {
      const reservations = input.contexts.filter(
        (context) => context.property.id === property.id,
      );
      return {
        property,
        upcomingArrivals: reservations.filter((context) =>
          ["pre-arrival", "arriving-today"].includes(context.stay.stage),
        ).length,
        currentGuests: reservations.filter(
          ({ stay }) => stay.stage === "in-stay",
        ).length,
        upcomingDepartures: reservations.filter(
          ({ stay }) =>
            stay.stage === "in-stay" || stay.stage === "departing-today",
        ).length,
        reservations,
        quality: buildWorkspaceOperationalDataHealth(
          reservations.map((context) => ({
            product: "bookings",
            quality: qualityByBookingId[context.bookingId],
          })),
          now,
        ),
      };
    },
  );
  return {
    workspace: { id: input.workspaceId, label: input.workspaceLabel },
    contexts: input.contexts,
    properties: summaries,
    qualityByBookingId,
    quality,
    synchronization,
    providerLabel: input.sync.providerLabel,
    home: {
      arrivalsToday: input.contexts.filter(
        ({ stay }) => stay.stage === "arriving-today",
      ).length,
      guestsInStay: input.contexts.filter(
        ({ stay }) => stay.stage === "in-stay",
      ).length,
      departuresToday: input.contexts.filter(
        ({ stay }) => stay.stage === "departing-today",
      ).length,
      openOperationalIssues:
        quality.openIssues.warning + quality.openIssues.critical,
    },
    activity: buildActivity(
      input.contexts,
      input.properties,
      qualityByBookingId,
      input.sync,
    ),
    selectors: {
      properties: input.properties
        .map(({ id, name }) => ({ id, label: name }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    },
  };
}

export function filterOperationalProjection(
  projection: OperationalSurfaceProjection,
  filters: Readonly<{
    propertyId?: string;
    startDate?: string;
    endDate?: string;
  }>,
): OperationalSurfaceProjection {
  const contexts = projection.contexts.filter(
    (context) =>
      (!filters.propertyId || context.property.id === filters.propertyId) &&
      (!filters.startDate ||
        context.stay.window.departureDate >= filters.startDate) &&
      (!filters.endDate || context.stay.window.arrivalDate <= filters.endDate),
  );
  return buildOperationalSurfaceProjection({
    workspaceId: projection.workspace.id,
    workspaceLabel: projection.workspace.label,
    contexts,
    properties: projection.properties
      .map(({ property }) => property)
      .filter(
        ({ id }) => !filters.propertyId || id === filters.propertyId,
      ),
    sync: {
      status: projection.synchronization.status,
      providerLabel: projection.providerLabel,
      created: projection.synchronization.succeeded.created,
      updated: projection.synchronization.succeeded.updated,
      unchanged: projection.synchronization.succeeded.unchanged,
      failed: projection.synchronization.failed.records,
      warnings: projection.synchronization.warnings,
      affectedCapabilities: projection.synchronization.failed.capabilities,
      lastSuccessfulAt: projection.synchronization.lastSuccessfulAt,
      providerConnected:
        projection.synchronization.recommendedAction !==
        "Reconnect the source in Workspace.",
    },
  });
}
