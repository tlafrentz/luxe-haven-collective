import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getHospitableReservationMessagePage,
  normalizeHospitableMessage,
  type HospitableMessagePage,
  type NormalizedHospitableMessage,
} from "./messages";
import { resolveHospitableMessagingWorkspace } from "./messaging-workspace";
import { linkProviderThread } from "./provider-thread-link";

export type HospitableMessageHydrationContext = Readonly<{
  workspaceId: string;
  propertyId: string;
  bookingId: string;
  reservationId: string;
  conversationId: string;
}>;

export type HospitableMessageHydrationResult = Readonly<{
  state: "completed" | "partial" | "failed" | "already-completed";
  pages: number;
  observed: number;
  inserted: number;
  duplicates: number;
  rejected: number;
  nextPage?: number;
}>;

export type HospitableMessageHydrationGateway = Readonly<{
  resolve(input: Readonly<{ workspaceId: string; reservationId: string }>): Promise<HospitableMessageHydrationContext>;
  claim(context: HospitableMessageHydrationContext, force: boolean): Promise<Readonly<{
    state: "claimed" | "completed" | "running";
    nextPage: number;
    pages: number;
    observed: number;
    inserted: number;
    duplicates: number;
    rejected: number;
  }>>;
  append(context: HospitableMessageHydrationContext, message: NormalizedHospitableMessage): Promise<"inserted" | "duplicate">;
  checkpoint(context: HospitableMessageHydrationContext, progress: Readonly<{ nextPage?: number; pages: number; observed: number; inserted: number; duplicates: number; rejected: number }>): Promise<void>;
  complete(context: HospitableMessageHydrationContext, progress: Readonly<{ pages: number; observed: number; inserted: number; duplicates: number; rejected: number }>): Promise<void>;
  fail(context: HospitableMessageHydrationContext, progress: Readonly<{ nextPage?: number; pages: number; observed: number; inserted: number; duplicates: number; rejected: number }>, errorCode: string): Promise<void>;
}>;

export type HospitableMessagePageReader = (
  reservationId: string,
  page: number,
  signal?: AbortSignal,
) => Promise<HospitableMessagePage>;

export async function hydrateHospitableReservationMessageHistory(
  input: Readonly<{
    workspaceId: string;
    reservationId: string;
    requestId?: string;
    force?: boolean;
    startPage?: number;
    maxRetries?: number;
    minimumPageIntervalMs?: number;
    signal?: AbortSignal;
  }>,
  dependencies: Readonly<{
    gateway?: HospitableMessageHydrationGateway;
    readPage?: HospitableMessagePageReader;
    sleep?: (milliseconds: number) => Promise<void>;
  }> = {},
): Promise<HospitableMessageHydrationResult> {
  const gateway = dependencies.gateway ?? createSupabaseHospitableMessageHydrationGateway();
  const readPage = dependencies.readPage ?? getHospitableReservationMessagePage;
  const requestId = input.requestId ?? crypto.randomUUID();
  const context = await gateway.resolve({
    workspaceId: input.workspaceId,
    reservationId: input.reservationId,
  });
  const correlation = correlationFields(requestId, context);
  console.info("hospitable_message_hydration_started", correlation);
  const claim = await gateway.claim(context, input.force ?? false);
  if (claim.state === "completed") {
    console.info("hospitable_message_hydration_reused", correlation);
    return Object.freeze({ state: "already-completed", pages: 0, observed: 0, inserted: 0, duplicates: 0, rejected: 0 });
  }
  if (claim.state === "running") throw new Error("message_hydration_already_running");

  const progress = {
    pages: claim.pages,
    observed: claim.observed,
    inserted: claim.inserted,
    duplicates: claim.duplicates,
    rejected: claim.rejected,
  };
  let page = input.startPage ?? claim.nextPage;
  try {
    for (let pageCount = 0; pageCount < 100; pageCount += 1) {
      input.signal?.throwIfAborted();
      const result = await retryPage(
        () => readPage(context.reservationId, page, input.signal),
        input.maxRetries ?? 3,
        input.signal,
        dependencies.sleep,
      );
      progress.pages += 1;
      progress.observed += result.messages.length;
      console.info("hospitable_message_page_retrieved", {
        ...correlation,
        page: result.page,
        count: result.messages.length,
      });
      for (const raw of result.messages) {
        const message = normalizeHospitableMessage(raw, { reservationId: context.reservationId });
        if (!message) {
          progress.rejected += 1;
          console.warn("hospitable_message_rejected", { ...correlation, reason: "provider_payload_invalid" });
          continue;
        }
        const outcome = await gateway.append(context, message);
        if (outcome === "inserted") progress.inserted += 1;
        else progress.duplicates += 1;
        console.info(outcome === "inserted" ? "hospitable_message_inserted" : "hospitable_message_duplicate", {
          ...correlation,
          providerMessageFingerprint: fingerprint(message.providerMessageId),
        });
      }
      if (result.complete) {
        await gateway.complete(context, progress);
        const state = progress.rejected > 0 ? "partial" as const : "completed" as const;
        console.info(state === "completed" ? "hospitable_message_hydration_completed" : "hospitable_message_hydration_partial", { ...correlation, ...progress });
        return Object.freeze({ state, ...progress });
      }
      page = result.nextPage!;
      await gateway.checkpoint(context, { ...progress, nextPage: page });
      const pageInterval = input.minimumPageIntervalMs ?? 550;
      if (pageInterval > 0) {
        await (dependencies.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))))(pageInterval);
      }
    }
    throw new Error("provider_pagination_limit_exceeded");
  } catch (error) {
    const errorCode = hydrationErrorCode(error);
    await gateway.fail(context, { ...progress, nextPage: page }, errorCode);
    console.error("hospitable_message_hydration_failed", { ...correlation, errorCode, ...progress });
    if (progress.observed > 0) {
      return Object.freeze({ state: "partial", ...progress, nextPage: page });
    }
    throw error;
  }
}

export function createSupabaseHospitableMessageHydrationGateway(): HospitableMessageHydrationGateway {
  const admin = createAdminClient();
  return Object.freeze({
    async resolve(input) {
      const { data: booking, error: bookingError } = await admin
        .from("bookings")
        .select("id,property_id,external_reservation_id")
        .eq("external_provider", "hospitable")
        .eq("external_reservation_id", input.reservationId)
        .maybeSingle();
      if (bookingError) throw new Error("message_hydration_booking_lookup_failed");
      if (!booking) throw new Error("message_hydration_booking_not_found");
      const messagingWorkspace = await resolveHospitableMessagingWorkspace({
        workspaceId: input.workspaceId,
        propertyId: String(booking.property_id),
      });
      const { data: links, error: linkError } = await admin
        .from("guest_conversation_reservations")
        .select("conversation_id,booking_id,property_id")
        .eq("booking_id", booking.id)
        .eq("reservation_id", input.reservationId);
      if (linkError) throw new Error("message_hydration_conversation_lookup_failed");
      if ((links ?? []).length !== 1) {
        throw new Error((links ?? []).length ? "message_hydration_conversation_ambiguous" : "message_hydration_conversation_not_found");
      }
      const link = links![0];
      const { data: conversation, error: conversationError } = await admin
        .from("guest_conversations")
        .select("id,workspace_id,property_id")
        .eq("id", link.conversation_id)
        .eq("workspace_id", messagingWorkspace.workspaceId)
        .eq("property_id", booking.property_id)
        .maybeSingle();
      if (conversationError) throw new Error("message_hydration_conversation_lookup_failed");
      if (!conversation || link.property_id !== booking.property_id) throw new Error("message_hydration_scope_mismatch");
      await linkProviderThread({
        workspaceId: messagingWorkspace.workspaceId,
        conversationId: String(conversation.id),
        provider: "hospitable",
        threadId: input.reservationId,
        reservationReference: input.reservationId,
        observedAt: new Date().toISOString(),
      });
      return Object.freeze({
        workspaceId: messagingWorkspace.workspaceId,
        propertyId: String(booking.property_id),
        bookingId: String(booking.id),
        reservationId: String(booking.external_reservation_id),
        conversationId: String(conversation.id),
      });
    },
    async claim(context, force) {
      const { data, error } = await admin.rpc("claim_guest_message_hydration", {
        p_workspace_id: context.workspaceId,
        p_property_id: context.propertyId,
        p_booking_id: context.bookingId,
        p_conversation_id: context.conversationId,
        p_provider: "hospitable",
        p_provider_reservation_id: context.reservationId,
        p_force: force,
      });
      if (error) throw new Error(`message_hydration_claim_failed:${error.code ?? "storage"}`);
      if (!data || typeof data !== "object") throw new Error("message_hydration_claim_invalid");
      const claim = data as Record<string, unknown>;
      return Object.freeze({
        state: String(claim.state) as "claimed" | "completed" | "running",
        nextPage: Number(claim.nextPage ?? 1),
        pages: Number(claim.pages ?? 0),
        observed: Number(claim.observed ?? 0),
        inserted: Number(claim.inserted ?? 0),
        duplicates: Number(claim.duplicates ?? 0),
        rejected: Number(claim.rejected ?? 0),
      });
    },
    async append(context, message) {
      const { data, error } = await admin.rpc("ingest_guest_provider_message", {
        p_workspace_id: context.workspaceId,
        p_property_id: context.propertyId,
        p_booking_id: context.bookingId,
        p_conversation_id: context.conversationId,
        p_provider: message.provider,
        p_provider_message_id: message.providerMessageId,
        p_platform_message_id: message.platformMessageId ?? null,
        p_provider_reservation_id: message.providerReservationId,
        p_provider_conversation_id: message.providerConversationId ?? null,
        p_sender_type: message.senderType,
        p_sender_display_name: message.senderDisplayName,
        p_body: message.body,
        p_content_type: message.contentType,
        p_message_channel: message.platform,
        p_direction: message.direction,
        p_delivery_status: message.deliveryStatus,
        p_occurred_at: message.occurredAt,
        p_ingested_at: message.ingestedAt,
        p_attachments: message.attachments,
        p_metadata: message.metadata,
        p_provenance: message.provenance,
        p_backfill: true,
      });
      if (error) throw new Error(`message_hydration_persistence_failed:${error.code ?? "storage"}`);
      return data ? "inserted" : "duplicate";
    },
    async checkpoint(context, progress) {
      const { error } = await admin
        .from("guest_message_hydrations")
        .update({
          state: "in_progress",
          next_page: progress.nextPage ?? null,
          pages_retrieved: progress.pages,
          messages_observed: progress.observed,
          messages_inserted: progress.inserted,
          duplicates_skipped: progress.duplicates,
          messages_rejected: progress.rejected,
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", context.workspaceId)
        .eq("provider", "hospitable")
        .eq("provider_reservation_id", context.reservationId);
      if (error) throw new Error("message_hydration_checkpoint_failed");
    },
    async complete(context, progress) {
      const { error } = await admin.rpc("complete_guest_message_hydration", {
        p_workspace_id: context.workspaceId,
        p_provider: "hospitable",
        p_provider_reservation_id: context.reservationId,
        p_pages: progress.pages,
        p_observed: progress.observed,
        p_inserted: progress.inserted,
        p_duplicates: progress.duplicates,
        p_rejected: progress.rejected,
      });
      if (error) throw new Error("message_hydration_completion_failed");
    },
    async fail(context, progress, errorCode) {
      const state = progress.observed > 0 ? "partial" : "failed";
      const { error } = await admin
        .from("guest_message_hydrations")
        .update({
          state,
          next_page: progress.nextPage ?? null,
          pages_retrieved: progress.pages,
          messages_observed: progress.observed,
          messages_inserted: progress.inserted,
          duplicates_skipped: progress.duplicates,
          messages_rejected: progress.rejected,
          last_error_code: errorCode,
          completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", context.workspaceId)
        .eq("provider", "hospitable")
        .eq("provider_reservation_id", context.reservationId);
      if (error) console.error("hospitable_message_hydration_state_failed", { errorCode: error.code ?? "storage" });
    },
  });
}

async function retryPage<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  signal?: AbortSignal,
  sleep: (milliseconds: number) => Promise<void> = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    signal?.throwIfAborted();
    try {
      return await operation();
    } catch (error) {
      const retryable = typeof error === "object" && error !== null && "retryable" in error && error.retryable === true;
      if (!retryable || attempt >= maxRetries) throw error;
      const retryAfter = typeof error === "object" && error !== null && "retryAfterMs" in error
        ? Number(error.retryAfterMs)
        : Number.NaN;
      await sleep(Number.isFinite(retryAfter) ? retryAfter : Math.min(250 * 2 ** attempt, 4_000));
    }
  }
}

function correlationFields(requestId: string, context: HospitableMessageHydrationContext) {
  return {
    requestId,
    workspaceId: context.workspaceId,
    propertyId: context.propertyId,
    bookingId: context.bookingId,
    conversationId: context.conversationId,
    reservationFingerprint: fingerprint(context.reservationId),
  };
}

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function hydrationErrorCode(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return "hydration_cancelled";
  if (error instanceof Error) return error.message.split(":")[0].slice(0, 100);
  return "message_hydration_failed";
}
