import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

import type {
  HospitableReservation,
} from "../types";

import {
  getAllHospitableReservations,
  getHospitableReservationDetail,
} from "./reservations";
import {
  mapHospitableReservation,
} from "./reservation-mapper";
import { runInBatches } from "./run-in-batches";

const PROVIDER = "hospitable";
const CONNECTION_NAME = "Hospitable Primary";
const DEFAULT_BATCH_SIZE = 5;
const MAX_RUNNING_SYNC_AGE_MINUTES = 30;

export const SYNC_ALREADY_RUNNING_ERROR =
  "A Hospitable reservation sync is already running.";

type ConnectionRow = {
  id: string;
};

type ExternalPropertyRow = {
  external_id: string;
  property_id: string | null;
};

type ReservationDetailResult =
  | {
      success: true;
      reservation: HospitableReservation;
    }
  | {
      success: false;
      reservationId: string;
      error: string;
    };

export type ReservationSyncOptions = {
  startDate: string;
  endDate: string;
  batchSize?: number;
};

export type ReservationSyncResult = {
  connectionId: string;
  startDate: string;
  endDate: string;
  discovered: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
};

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validateSyncOptions({
  startDate,
  endDate,
  batchSize = DEFAULT_BATCH_SIZE,
}: ReservationSyncOptions): void {
  if (
    !isValidDateString(startDate) ||
    !isValidDateString(endDate)
  ) {
    throw new Error(
      "Reservation sync dates must use YYYY-MM-DD format.",
    );
  }

  if (endDate < startDate) {
    throw new Error(
      "Reservation sync end date must be on or after the start date.",
    );
  }

  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 10
  ) {
    throw new Error(
      "Reservation sync batch size must be between 1 and 10.",
    );
  }
}

async function getConnection(): Promise<ConnectionRow> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("integration_connections")
    .select("id")
    .eq("provider", PROVIDER)
    .eq("name", CONNECTION_NAME)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load Hospitable connection: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "Hospitable connection was not found. Run the property sync first.",
    );
  }

  return data;
}

async function getLinkedProperties(
  connectionId: string,
): Promise<ExternalPropertyRow[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("external_properties")
    .select("external_id, property_id")
    .eq("connection_id", connectionId)
    .eq("provider", PROVIDER)
    .not("property_id", "is", null);

  if (error) {
    throw new Error(
      `Unable to load linked Hospitable properties: ${error.message}`,
    );
  }

  return (data ?? []) as ExternalPropertyRow[];
}

async function expireStaleSyncRuns({
  connectionId,
}: {
  connectionId: string;
}): Promise<void> {
  const supabase = createAdminClient();

  const staleBefore = new Date(
    Date.now() -
      MAX_RUNNING_SYNC_AGE_MINUTES *
        60 *
        1000,
  ).toISOString();

  const completedAt = new Date().toISOString();

  const { error } = await supabase
    .from("integration_sync_runs")
    .update({
      status: "failed",
      completed_at: completedAt,
      error_message:
        "Sync automatically failed after exceeding the maximum running time.",
    })
    .eq("connection_id", connectionId)
    .eq("sync_type", "reservations")
    .eq("status", "running")
    .lt("started_at", staleBefore);

  if (error) {
    throw new Error(
      `Unable to expire stale reservation syncs: ${error.message}`,
    );
  }
}

async function startSyncRun({
  connectionId,
  startDate,
  endDate,
}: {
  connectionId: string;
  startDate: string;
  endDate: string;
}): Promise<string> {
  await expireStaleSyncRuns({
    connectionId,
  });

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("integration_sync_runs")
    .insert({
      connection_id: connectionId,
      sync_type: "reservations",
      status: "running",
      metadata: {
        start_date: startDate,
        end_date: endDate,
      },
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        SYNC_ALREADY_RUNNING_ERROR,
      );
    }

    throw new Error(
      `Unable to start reservation sync: ${error.message}`,
    );
  }

  return data.id;
}

async function finishSyncRun({
  syncRunId,
  result,
}: {
  syncRunId: string;
  result: ReservationSyncResult;
}): Promise<void> {
  const supabase = createAdminClient();

  const status =
    result.failed === 0
      ? "completed"
      : result.processed === 0
        ? "failed"
        : "partial";

  const { error } = await supabase
    .from("integration_sync_runs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      records_processed: result.processed,
      records_created: result.created,
      records_updated: result.updated,
      records_failed: result.failed,
      error_message:
        result.errors.length > 0
          ? result.errors.join("\n")
          : null,
      metadata: {
        start_date: result.startDate,
        end_date: result.endDate,
        discovered: result.discovered,
        skipped: result.skipped,
      },
    })
    .eq("id", syncRunId);

  if (error) {
    throw new Error(
      `Unable to finish reservation sync: ${error.message}`,
    );
  }
}

async function updateConnectionStatus({
  connectionId,
  status,
  errorMessage,
}: {
  connectionId: string;
  status: "active" | "error";
  errorMessage?: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const timestamp = new Date().toISOString();

  const {
    data: connection,
    error: selectError,
  } = await supabase
    .from("integration_connections")
    .select("metadata")
    .eq("id", connectionId)
    .single();

  if (selectError) {
    throw new Error(
      `Unable to load connection metadata: ${selectError.message}`,
    );
  }

  const currentMetadata =
    connection.metadata &&
    typeof connection.metadata === "object" &&
    !Array.isArray(connection.metadata)
      ? connection.metadata
      : {};

  const metadata = {
    ...currentMetadata,
    last_reservation_sync_error:
      errorMessage ?? null,
  };

  const connectionUpdate =
    status === "active"
      ? {
          status,
          last_synced_at: timestamp,
          updated_at: timestamp,
          metadata,
        }
      : {
          status,
          updated_at: timestamp,
          metadata,
        };

  const { error } = await supabase
    .from("integration_connections")
    .update(connectionUpdate)
    .eq("id", connectionId);

  if (error) {
    throw new Error(
      `Unable to update Hospitable connection: ${error.message}`,
    );
  }
}

async function getExistingReservationIds(
  reservationIds: string[],
): Promise<Set<string>> {
  if (reservationIds.length === 0) {
    return new Set();
  }

  const supabase = createAdminClient();
  const existingIds = new Set<string>();
  const chunkSize = 100;

  for (
    let index = 0;
    index < reservationIds.length;
    index += chunkSize
  ) {
    const chunk = reservationIds.slice(
      index,
      index + chunkSize,
    );

    const { data, error } = await supabase
      .from("bookings")
      .select("external_reservation_id")
      .eq("external_provider", PROVIDER)
      .in("external_reservation_id", chunk);

    if (error) {
      throw new Error(
        `Unable to inspect existing reservations: ${error.message}`,
      );
    }

    for (const row of data ?? []) {
      if (row.external_reservation_id) {
        existingIds.add(
          row.external_reservation_id,
        );
      }
    }
  }

  return existingIds;
}

async function fetchReservationDetails({
  reservationIds,
  batchSize,
}: {
  reservationIds: string[];
  batchSize: number;
}): Promise<ReservationDetailResult[]> {
  return runInBatches({
    items: reservationIds,
    batchSize,
    handler: async (
      reservationId,
    ): Promise<ReservationDetailResult> => {
      try {
        const reservation =
          await getHospitableReservationDetail(
            reservationId,
          );

        return {
          success: true,
          reservation,
        };
      } catch (error) {
        return {
          success: false,
          reservationId,
          error:
            error instanceof Error
              ? error.message
              : "Unknown reservation detail error.",
        };
      }
    },
  });
}

async function upsertBooking(
  booking: ReturnType<
    typeof mapHospitableReservation
  >["booking"],
): Promise<void> {
  const supabase = createAdminClient();
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("owner_id, owner:owners!inner(profile_id)")
    .eq("id", booking.property_id)
    .single();

  const ownerRelation = property?.owner as unknown as
    | { profile_id: string }
    | readonly { profile_id: string }[]
    | undefined;
  const ownerProfile = Array.isArray(ownerRelation)
    ? ownerRelation[0]
    : ownerRelation;
  if (propertyError || !property?.owner_id || !ownerProfile?.profile_id) {
    throw new Error(
      `Unable to resolve the reservation owner for property "${booking.property_id}".`,
    );
  }

  const ownerProfileId = ownerProfile.profile_id;
  const identityKey = booking.external_guest_id
    ? `${ownerProfileId}:${booking.external_provider}:${booking.external_guest_id}`
    : `booking:${booking.external_reservation_id}`;
  const digest = createHash("md5").update(identityKey).digest("hex");
  const primaryGuestId = [
    digest.slice(0, 8),
    digest.slice(8, 12),
    digest.slice(12, 16),
    digest.slice(16, 20),
    digest.slice(20),
  ].join("-");
  const identityStatus = booking.external_guest_id
    ? "resolved"
    : booking.guest_full_name
      ? "provisional"
      : "unidentified";

  const { error: guestError } = await supabase.from("guests").upsert(
    {
      id: primaryGuestId,
      owner_id: ownerProfileId,
      identity_status: identityStatus,
      display_name: booking.guest_full_name ?? "Guest",
      normalized_name: booking.guest_full_name?.trim().toLowerCase() ?? null,
      email: booking.guest_email,
      phone: booking.guest_phone,
      language: booking.guest_language,
      last_observed_at: booking.guest_context_synced_at,
      updated_at: booking.guest_context_synced_at,
    },
    { onConflict: "id" },
  );

  if (guestError) {
    throw new Error(
      `Unable to enrich reservation guest context: ${guestError.message}`,
    );
  }

  if (booking.external_guest_id) {
    const { error: referenceError } = await supabase
      .from("provider_guest_references")
      .upsert(
        {
          guest_id: primaryGuestId,
          owner_id: ownerProfileId,
          provider: booking.external_provider,
          external_guest_id: booking.external_guest_id,
          last_observed_at: booking.guest_context_synced_at,
          updated_at: booking.guest_context_synced_at,
        },
        {
          onConflict: "owner_id,provider,external_guest_id",
        },
      );

    if (referenceError) {
      throw new Error(
        `Unable to retain reservation guest provenance: ${referenceError.message}`,
      );
    }
  }

  const { data: persistedBooking,error } = await supabase
    .from("bookings")
    .upsert({ ...booking, primary_guest_id: primaryGuestId }, {
      onConflict:
        "external_provider,external_reservation_id",
    }).select("id").single();

  if (error) {
    throw new Error(
      `Unable to upsert reservation "${booking.external_reservation_id}": ${error.message}`,
    );
  }
  const synchronizedAt=booking.last_synced_at??new Date().toISOString();
  const{data:existingConversation,error:conversationLookupError}=await supabase.from("guest_conversations").select("id").eq("workspace_id",ownerProfileId).eq("guest_id",primaryGuestId).eq("property_id",booking.property_id).neq("status","archived").order("last_activity_at",{ascending:false}).limit(1).maybeSingle();
  if(conversationLookupError)throw new Error(`Unable to resolve the guest relationship conversation: ${conversationLookupError.message}`);
  const conversationId=existingConversation?.id??`guest-conversation-${crypto.randomUUID()}`;
  if(!existingConversation){
    const{error:createError}=await supabase.from("guest_conversations").insert({id:conversationId,workspace_id:ownerProfileId,reservation_id:booking.external_reservation_id,active_reservation_id:booking.external_reservation_id,booking_id:persistedBooking.id,guest_id:primaryGuestId,property_id:booking.property_id,channel:"internal",status:"open",waiting_on:"none",priority:"normal",unread_count:0,last_activity_at:synchronizedAt,revision:1,created_at:synchronizedAt,updated_at:synchronizedAt});
    if(createError)throw new Error(`Unable to initialize the guest relationship conversation: ${createError.message}`);
    await Promise.all([
      supabase.from("guest_conversation_participants").insert({id:`guest-participant-${conversationId}`,conversation_id:conversationId,participant_type:"guest",guest_id:primaryGuestId,display_name:booking.guest_full_name??"Guest",joined_at:synchronizedAt}),
      supabase.from("guest_conversation_activity").insert({id:`conversation-created-${conversationId}`,conversation_id:conversationId,workspace_id:ownerProfileId,event_type:"conversation-created",safe_summary:"Conversation created from synchronized reservation context.",occurred_at:synchronizedAt}),
    ]);
  }
  await supabase.from("guest_conversation_reservations").update({active:false,unlinked_at:synchronizedAt}).eq("conversation_id",conversationId).eq("active",true).neq("reservation_id",booking.external_reservation_id);
  const[{error:linkError},{error:threadError}]=await Promise.all([
    supabase.from("guest_conversation_reservations").upsert({conversation_id:conversationId,reservation_id:booking.external_reservation_id,booking_id:persistedBooking.id,property_id:booking.property_id,active:true,linked_at:synchronizedAt},{onConflict:"conversation_id,reservation_id",ignoreDuplicates:true}),
    supabase.from("guest_conversation_provider_threads").upsert({id:`provider-thread-${conversationId}-${booking.external_reservation_id}`,conversation_id:conversationId,workspace_id:ownerProfileId,provider:"hospitable",thread_id:booking.external_reservation_id,reservation_reference:booking.external_reservation_id,last_observed_at:synchronizedAt},{onConflict:"workspace_id,provider,thread_id",ignoreDuplicates:true}),
  ]);
  if(linkError||threadError)throw new Error(`Unable to link provider context to the guest conversation: ${(linkError??threadError)?.message}`);
  const{error:activateLinkError}=await supabase.from("guest_conversation_reservations").update({booking_id:persistedBooking.id,property_id:booking.property_id,active:true,unlinked_at:null}).eq("conversation_id",conversationId).eq("reservation_id",booking.external_reservation_id);
  if(activateLinkError)throw new Error(`Unable to activate reservation context for the guest conversation: ${activateLinkError.message}`);
  await supabase.from("guest_conversations").update({reservation_id:booking.external_reservation_id,active_reservation_id:booking.external_reservation_id,booking_id:persistedBooking.id,last_activity_at:synchronizedAt,updated_at:synchronizedAt}).eq("id",conversationId);
}

async function safelyFinalizeFailedSync({
  syncRunId,
  connectionId,
  result,
}: {
  syncRunId: string;
  connectionId: string;
  result: ReservationSyncResult;
}): Promise<void> {
  try {
    await finishSyncRun({
      syncRunId,
      result,
    });
  } catch (finalizationError) {
    console.error(
      "Unable to finalize failed Hospitable sync run",
      {
        syncRunId,
        error:
          finalizationError instanceof Error
            ? finalizationError.message
            : "Unknown sync finalization error.",
      },
    );
  }

  try {
    await updateConnectionStatus({
      connectionId,
      status: "error",
      errorMessage:
        result.errors.join("\n"),
    });
  } catch (connectionError) {
    console.error(
      "Unable to mark Hospitable connection as failed",
      {
        connectionId,
        error:
          connectionError instanceof Error
            ? connectionError.message
            : "Unknown connection update error.",
      },
    );
  }
}

async function persistOperationalSyncSummaries({
  syncRunId,
  connectionId,
  result,
}: {
  syncRunId: string;
  connectionId: string;
  result: ReservationSyncResult;
}): Promise<void> {
  const supabase = createAdminClient();
  const { data: links, error: linksError } = await supabase
    .from("external_properties")
    .select("properties!inner(owner:owners!inner(profile_id))")
    .eq("connection_id", connectionId)
    .not("property_id", "is", null);
  if (linksError) throw new Error("Unable to resolve sync summary owners.");
  const ownerIds = new Set(
    (links ?? []).flatMap((link) => {
      const relation = link.properties as unknown as
        | {
            owner:
              | { profile_id: string }
              | readonly { profile_id: string }[];
          }
        | readonly {
            owner:
              | { profile_id: string }
              | readonly { profile_id: string }[];
          }[];
      const property = Array.isArray(relation) ? relation[0] : relation;
      const owner = property
        ? Array.isArray(property.owner)
          ? property.owner[0]
          : property.owner
        : undefined;
      return owner?.profile_id ? [owner.profile_id] : [];
    }),
  );
  const status =
    result.failed === 0
      ? "succeeded"
      : result.processed > 0
        ? "partially-succeeded"
        : "failed";
  const completedAt = new Date().toISOString();
  if (!ownerIds.size) return;
  const { error } = await supabase.from("operational_sync_summaries").insert(
    [...ownerIds].map((ownerId) => ({
      owner_id: ownerId,
      connection_id: connectionId,
      sync_run_id: syncRunId,
      provider: PROVIDER,
      status,
      completed_at: completedAt,
      records_discovered: result.discovered,
      records_created: result.created,
      records_updated: result.updated,
      records_unchanged: 0,
      records_skipped: result.skipped,
      records_failed: result.failed,
      warnings: result.errors,
      affected_capabilities:
        result.failed > 0 ? ["bookings", "guest-context"] : [],
    })),
  );
  if (error) throw new Error("Unable to persist operational sync summary.");
}

async function safelyPersistOperationalSyncSummaries(
  input: Parameters<typeof persistOperationalSyncSummaries>[0],
): Promise<void> {
  try {
    await persistOperationalSyncSummaries(input);
  } catch {
    console.error("Unable to persist redacted operational sync summary", {
      syncRunId: input.syncRunId,
      connectionId: input.connectionId,
      failed: input.result.failed,
    });
  }
}

export async function syncHospitableReservations({
  startDate,
  endDate,
  batchSize = DEFAULT_BATCH_SIZE,
}: ReservationSyncOptions): Promise<ReservationSyncResult> {
  validateSyncOptions({
    startDate,
    endDate,
    batchSize,
  });

  const connection = await getConnection();

  const result: ReservationSyncResult = {
    connectionId: connection.id,
    startDate,
    endDate,
    discovered: 0,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const syncRunId = await startSyncRun({
    connectionId: connection.id,
    startDate,
    endDate,
  });

  try {
    const linkedProperties =
      await getLinkedProperties(connection.id);

    if (linkedProperties.length === 0) {
      throw new Error(
        "No linked Hospitable properties were found. Run the property sync and link a local property first.",
      );
    }

    const propertyMap = new Map<
      string,
      string
    >();

    for (const property of linkedProperties) {
      if (property.property_id) {
        propertyMap.set(
          property.external_id,
          property.property_id,
        );
      }
    }

    const reservationSummaries =
      await getAllHospitableReservations({
        propertyIds: Array.from(
          propertyMap.keys(),
        ),
        startDate,
        endDate,
      });

    result.discovered =
      reservationSummaries.length;

    const reservationIds =
      reservationSummaries.map(
        (reservation) => reservation.id,
      );

    const existingReservationIds =
      await getExistingReservationIds(
        reservationIds,
      );

    const detailResults =
      await fetchReservationDetails({
        reservationIds,
        batchSize,
      });

    for (const detailResult of detailResults) {
      if (!detailResult.success) {
        result.failed += 1;
        result.errors.push(
          `Reservation "${detailResult.reservationId}": ${detailResult.error}`,
        );

        continue;
      }

      const reservation =
        detailResult.reservation;

      const externalPropertyId =
        reservation.properties?.[0]?.id;

      if (!externalPropertyId) {
        result.skipped += 1;
        result.errors.push(
          `Reservation "${reservation.id}" was skipped because it has no Hospitable property ID.`,
        );

        continue;
      }

      const localPropertyId =
        propertyMap.get(externalPropertyId);

      if (!localPropertyId) {
        result.skipped += 1;
        result.errors.push(
          `Reservation "${reservation.id}" was skipped because Hospitable property "${externalPropertyId}" is not linked to a local property.`,
        );

        continue;
      }

      try {
        const mapping =
          mapHospitableReservation({
            reservation,
            localPropertyId,
          });

        await upsertBooking(mapping.booking);

        result.processed += 1;

        if (
          existingReservationIds.has(
            reservation.id,
          )
        ) {
          result.updated += 1;
        } else {
          result.created += 1;
        }
      } catch (error) {
        result.failed += 1;
        result.errors.push(
          error instanceof Error
            ? error.message
            : `Unknown sync error for reservation "${reservation.id}".`,
        );
      }
    }

    await finishSyncRun({
      syncRunId,
      result,
    });

    await updateConnectionStatus({
      connectionId: connection.id,
      status:
        result.failed > 0
          ? "error"
          : "active",
      errorMessage:
        result.errors.length > 0
          ? result.errors.join("\n")
          : undefined,
    });

    await safelyPersistOperationalSyncSummaries({
      syncRunId,
      connectionId: connection.id,
      result,
    });

    return result;
  } catch (error) {
    const primaryError =
      error instanceof Error
        ? error
        : new Error(
            "Unknown Hospitable reservation sync error.",
          );

    result.failed = Math.max(
      result.failed,
      1,
    );

    if (
      !result.errors.includes(
        primaryError.message,
      )
    ) {
      result.errors.push(
        primaryError.message,
      );
    }

    await safelyFinalizeFailedSync({
      syncRunId,
      connectionId: connection.id,
      result,
    });

    await safelyPersistOperationalSyncSummaries({
      syncRunId,
      connectionId: connection.id,
      result,
    });

    throw primaryError;
  }
}
