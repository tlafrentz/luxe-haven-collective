import { createClient } from "@/lib/supabase/server";
import {
  getReservationContexts,
  SupabaseReservationContextRepository,
  type ReservationContextPrincipal,
} from "@/features/reservation-context";
import {
  resolveOwnerIdentity,
  throwOperationalReadError,
} from "@/features/reservation-context/infrastructure/owner-identity";

import {
  buildOperationalSurfaceProjection,
  type OperationalPropertySource,
  type OperationalSurfaceProjection,
  type OperationalSyncSource,
} from "../application";

type PropertyRow = Readonly<{
  id: string;
  owner_id: string;
  owner?:
    | Readonly<{ profile_id: string }>
    | readonly Readonly<{ profile_id: string }>[];
  name: string;
  city: string;
  state: string;
  status: string;
  timezone: string | null;
  guidebook_available: boolean;
  featured_image: string | null;
  updated_at: string;
}>;

export async function getOperationalProperties(
  profileId: string,
): Promise<readonly OperationalPropertySource[]> {
  const supabase = await createClient();
  const identity = await resolveOwnerIdentity(supabase, profileId);
  if (!identity.ownerId) return [];
  const { data: configurations, error: configurationError } = await supabase
    .from("property_workspace_configuration")
    .select("property_id")
    .eq("workspace_id", identity.ownerId)
    .eq("inclusion", "included");
  if (configurationError) {
    throwOperationalReadError("Workspace property inclusion", configurationError);
  }
  const includedPropertyIds = (configurations ?? []).map(({ property_id }) => property_id);
  if (!includedPropertyIds.length) return [];
  let query = supabase
    .from("properties")
    .select(
      "id, owner_id, name, city, state, status, timezone, guidebook_available, featured_image, updated_at",
    )
    .eq("owner_id", identity.ownerId)
    .in("id", includedPropertyIds);
  if (identity.accessiblePropertyIds) {
    if (!identity.accessiblePropertyIds.length) return [];
    query = query.in("id", [...identity.accessiblePropertyIds]);
  }
  const { data, error } = await query.order("name", { ascending: true });
  if (error) throwOperationalReadError("Operational property list", error);
  return mapOperationalPropertyRows(
    (data ?? []) as unknown as PropertyRow[],
    identity.ownerProfileId,
  );
}

export function mapOperationalPropertyRows(
  rows: readonly PropertyRow[],
  profileId?: string,
): readonly OperationalPropertySource[] {
  return rows.map((row) => {
    const owner = Array.isArray(row.owner) ? row.owner[0] : row.owner;
    const resolvedProfileId = profileId ?? owner?.profile_id;
    if (!resolvedProfileId)
      throw new Error(`Property "${row.id}" has no owner profile.`);
    return {
      id: row.id,
      ownerId: resolvedProfileId,
      name: row.name,
      marketLabel: [row.city, row.state].filter(Boolean).join(", ") || null,
      status: row.status,
      timezone: row.timezone,
      lastSynchronizedAt: null,
      connectionState: "unknown",
      guidebookAvailable: row.guidebook_available,
      primaryImage: row.featured_image,
      updatedAt: row.updated_at,
    };
  });
}

type SyncRow = Readonly<{
  status: OperationalSyncSource["status"];
  provider: string;
  records_created: number;
  records_updated: number;
  records_unchanged: number;
  records_failed: number;
  warnings: unknown;
  affected_capabilities: string[];
  completed_at: string | null;
}>;

export async function getOperationalSynchronization(
  ownerId: string,
): Promise<OperationalSyncSource> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operational_sync_summaries")
    .select(
      "status, provider, records_created, records_updated, records_unchanged, records_failed, warnings, affected_capabilities, completed_at",
    )
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwOperationalReadError("Synchronization health", error);
  return mapOperationalSyncRow(data as unknown as SyncRow | null);
}

export function mapOperationalSyncRow(
  row: SyncRow | null,
): OperationalSyncSource {
  if (!row)
    return {
      status: "never-run",
      providerLabel: "Connected hospitality platform",
      created: 0,
      updated: 0,
      unchanged: 0,
      failed: 0,
      warnings: [],
      affectedCapabilities: [],
      lastSuccessfulAt: null,
      providerConnected: false,
    };
  return {
    status: row.status,
    providerLabel: "Connected hospitality platform",
    created: row.records_created,
    updated: row.records_updated,
    unchanged: row.records_unchanged,
    failed: row.records_failed,
    warnings: Array.isArray(row.warnings)
      ? row.warnings.filter((value): value is string => typeof value === "string")
      : [],
    affectedCapabilities: row.affected_capabilities ?? [],
    lastSuccessfulAt:
      row.status === "succeeded" || row.status === "partially-succeeded"
        ? row.completed_at
        : null,
    providerConnected: true,
  };
}

export async function getOperationalSurfaceProjection(input: Readonly<{
  principal: ReservationContextPrincipal;
  workspaceLabel: string;
  now?: Date;
}>): Promise<OperationalSurfaceProjection> {
  if (!input.principal.userId) {
    throw new Error("Operational workspace authentication is required.");
  }
  const supabase = await createClient();
  const identity = await resolveOwnerIdentity(
    supabase,
    input.principal.userId,
  );
  const [contexts, propertyRecords, sync] = await Promise.all([
    getReservationContexts(
      new SupabaseReservationContextRepository(),
      input.principal,
      {},
      "operational-summary",
      input.now,
    ),
    // getOperationalProperties resolves identity via resolveOwnerIdentity,
    // which checks this value against the caller's own auth.uid() -- it
    // must be the calling profile's id, not the workspace id.
    getOperationalProperties(input.principal.userId),
    getOperationalSynchronization(identity.ownerProfileId),
  ]);
  const properties = propertyRecords.map((property) => {
    const lastSynchronizedAt =
      contexts
        .filter((context) => context.property.id === property.id)
        .map((context) => context.freshness.bookingObservedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? sync.lastSuccessfulAt;
    return {
      ...property,
      lastSynchronizedAt,
      connectionState:
        sync.status === "never-run"
          ? "unknown" as const
          : sync.providerConnected
            ? "connected" as const
            : "disconnected" as const,
    };
  });
  return buildOperationalSurfaceProjection({
    workspaceId: identity.workspaceId ?? input.principal.workspaceId,
    workspaceLabel: input.workspaceLabel,
    contexts,
    properties,
    sync,
    now: input.now,
  });
}
