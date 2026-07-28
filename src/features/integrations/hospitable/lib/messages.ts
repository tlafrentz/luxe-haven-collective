import { HospitableApiError, hospitableRequest } from "./client";

type HospitableMessageResponse = Readonly<{
  data?: Readonly<{ id?: string; status?: string }>;
  id?: string;
  status?: string;
}>;

export type HospitableMessageAttachment = Readonly<{
  id?: string | number;
  type?: string;
  filename?: string;
  name?: string;
  url?: string;
  mime_type?: string;
  size?: number;
  [key: string]: unknown;
}>;

export type HospitableReservationMessage = Readonly<{
  id?: unknown;
  platform?: string;
  platform_id?: unknown;
  conversation_id?: unknown;
  reservation_id?: unknown;
  content_type?: string;
  body?: string | null;
  attachments?: readonly HospitableMessageAttachment[];
  sender_type?: string;
  sender_role?: string;
  sender?: Readonly<{ id?: string; first_name?: string; full_name?: string }>;
  user?: Readonly<{ id?: string; email?: string; name?: string }>;
  created_at?: string;
  updated_at?: string;
  source?: string;
  integration?: string;
  sent_reference_id?: unknown;
  reactions?: unknown;
}>;

type HospitableMessagesResponse = Readonly<{
  data?: readonly HospitableReservationMessage[];
  links?: Readonly<{ next?: string | null }>;
  meta?: Readonly<{ current_page?: number; last_page?: number }>;
}>;

export type NormalizedHospitableAttachment = Readonly<{
  providerAttachmentId: string;
  type: string;
  filename?: string;
  mimeType?: string;
  providerUrl?: string;
  sizeBytes?: number;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type NormalizedHospitableMessage = Readonly<{
  provider: "hospitable";
  providerMessageId: string;
  platformMessageId?: string;
  providerReservationId: string;
  providerConversationId?: string;
  body: string;
  contentType: string;
  occurredAt: string;
  ingestedAt: string;
  direction: "inbound" | "outbound" | "system-event" | "unknown";
  senderType: "guest" | "operator" | "system" | "unknown";
  senderDisplayName: string;
  platform: string;
  deliveryStatus: "delivered" | "unknown";
  attachments: readonly NormalizedHospitableAttachment[];
  metadata: Readonly<Record<string, unknown>>;
  provenance: Readonly<{ provider: "hospitable"; source?: string; integration?: string }>;
}>;

export type HospitableMessagePage = Readonly<{
  messages: readonly HospitableReservationMessage[];
  page: number;
  nextPage?: number;
  complete: boolean;
}>;

export type HospitableMessageHistoryOptions = Readonly<{
  startPage?: number;
  maxPages?: number;
  maxRetries?: number;
  signal?: AbortSignal;
  onPage?: (page: HospitableMessagePage) => Promise<void> | void;
  sleep?: (milliseconds: number) => Promise<void>;
}>;

export async function getHospitableReservationMessagePage(
  reservationId: string,
  page = 1,
  signal?: AbortSignal,
): Promise<HospitableMessagePage> {
  if (!reservationId.trim()) throw new Error("provider_reservation_required");
  if (!Number.isInteger(page) || page < 1) throw new Error("provider_page_invalid");
  const response = await hospitableRequest<HospitableMessagesResponse>(
    `/reservations/${encodeURIComponent(reservationId)}/messages`,
    { searchParams: page === 1 ? undefined : { page }, signal },
  );
  const currentPage = response.meta?.current_page ?? page;
  const lastPage = response.meta?.last_page ?? currentPage;
  const linkedPage = pageFromLink(response.links?.next);
  const nextPage = linkedPage ?? (currentPage < lastPage ? currentPage + 1 : undefined);
  return Object.freeze({
    messages: Object.freeze([...(response.data ?? [])]),
    page: currentPage,
    ...(nextPage ? { nextPage } : {}),
    complete: nextPage === undefined,
  });
}

export async function getHospitableReservationMessages(
  reservationId: string,
  options: HospitableMessageHistoryOptions = {},
): Promise<readonly HospitableReservationMessage[]> {
  const messages: HospitableReservationMessage[] = [];
  const maxPages = options.maxPages ?? 100;
  let page = options.startPage ?? 1;
  for (let pagesRead = 0; pagesRead < maxPages; pagesRead += 1) {
    const result = await withRetry(
      () => getHospitableReservationMessagePage(reservationId, page, options.signal),
      options,
    );
    messages.push(...result.messages);
    await options.onPage?.(result);
    if (result.complete) return Object.freeze(messages);
    page = result.nextPage!;
  }
  throw new Error("provider_pagination_limit_exceeded");
}

export function normalizeHospitableMessage(
  message: HospitableReservationMessage,
  input: Readonly<{ reservationId: string; ingestedAt?: string }>,
): NormalizedHospitableMessage | null {
  const providerMessageId =
    normalizeProviderIdentifier(message.id) ??
    normalizeProviderIdentifier(message.sent_reference_id) ??
    normalizeProviderIdentifier(message.platform_id);
  const occurredAt = message.created_at ?? "";
  const providerReservationId =
    normalizeProviderIdentifier(message.reservation_id) ??
    normalizeProviderIdentifier(input.reservationId);
  const messageReservationId = normalizeProviderIdentifier(message.reservation_id);
  const inputReservationId = normalizeProviderIdentifier(input.reservationId);
  const platformMessageId = normalizeProviderIdentifier(message.platform_id);
  const providerConversationId = normalizeProviderIdentifier(message.conversation_id);
  if (!providerMessageId || !providerReservationId || !isTimestamp(occurredAt)) return null;
  if (messageReservationId && messageReservationId !== inputReservationId) return null;
  const body = typeof message.body === "string" ? message.body : "";
  if (body.length > 10_000) return null;
  const sender = classifySender(message.sender_type, message.sender_role, message.source);
  return Object.freeze({
    provider: "hospitable",
    providerMessageId,
    ...(platformMessageId ? { platformMessageId } : {}),
    providerReservationId,
    ...(providerConversationId ? { providerConversationId } : {}),
    body,
    contentType: message.content_type?.trim() || "text/plain",
    occurredAt: new Date(occurredAt).toISOString(),
    ingestedAt: input.ingestedAt ?? new Date().toISOString(),
    direction: sender.direction,
    senderType: sender.senderType,
    senderDisplayName:
      message.sender?.full_name?.trim() ||
      message.user?.name?.trim() ||
      sender.defaultName,
    platform: message.platform?.trim() || message.integration?.trim() || "hospitable",
    deliveryStatus: "delivered",
    attachments: Object.freeze(
      (message.attachments ?? []).map((attachment, index) => normalizeAttachment(attachment, providerMessageId, index)),
    ),
    metadata: Object.freeze({
      ...(message.updated_at ? { providerUpdatedAt: message.updated_at } : {}),
      ...(message.reactions !== undefined ? { reactions: message.reactions } : {}),
    }),
    provenance: Object.freeze({
      provider: "hospitable",
      ...(message.source ? { source: message.source } : {}),
      ...(message.integration ? { integration: message.integration } : {}),
    }),
  });
}

function normalizeProviderIdentifier(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || null;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  return null;
}

/** Provider adapter boundary for Hospitable's reservation conversation API. */
export async function sendHospitableReservationMessage(input: Readonly<{ reservationId: string; body: string }>) {
  const response = await hospitableRequest<HospitableMessageResponse>(
    `/reservations/${encodeURIComponent(input.reservationId)}/messages`,
    { method: "POST", body: { message: input.body } },
  );
  const data = response.data ?? response;
  if (!data.id) throw new Error("provider_invalid_response");
  return Object.freeze({
    providerMessageId: data.id,
    status: data.status === "delivered" ? ("delivered" as const) : ("sent" as const),
  });
}

function classifySender(
  senderType?: string,
  senderRole?: string,
  source?: string,
): Readonly<{
  senderType: NormalizedHospitableMessage["senderType"];
  direction: NormalizedHospitableMessage["direction"];
  defaultName: string;
}> {
  const value = (senderType ?? senderRole ?? "").toLowerCase();
  if (["guest", "traveler", "renter"].includes(value)) {
    return { senderType: "guest", direction: "inbound", defaultName: "Guest" };
  }
  if (["host", "operator", "user"].includes(value)) {
    return { senderType: "operator", direction: "outbound", defaultName: "Host" };
  }
  if (["system", "automated", "automation"].includes(value) || source === "automated") {
    return { senderType: "system", direction: "system-event", defaultName: "Hospitable" };
  }
  return { senderType: "unknown", direction: "unknown", defaultName: "Unknown sender" };
}

function normalizeAttachment(
  attachment: HospitableMessageAttachment,
  messageId: string,
  index: number,
): NormalizedHospitableAttachment {
  const providerAttachmentId = String(attachment.id ?? `${messageId}:attachment:${index}`);
  return Object.freeze({
    providerAttachmentId,
    type: attachment.type?.trim() || "unknown",
    ...(attachment.filename ?? attachment.name ? { filename: String(attachment.filename ?? attachment.name) } : {}),
    ...(attachment.mime_type ? { mimeType: attachment.mime_type } : {}),
    ...(attachment.url ? { providerUrl: attachment.url } : {}),
    ...(Number.isFinite(attachment.size) ? { sizeBytes: Number(attachment.size) } : {}),
    metadata: Object.freeze(
      Object.fromEntries(
        Object.entries(attachment).filter(
          ([key]) => !["id", "type", "filename", "name", "mime_type", "url", "size"].includes(key),
        ),
      ),
    ),
  });
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: Pick<HospitableMessageHistoryOptions, "maxRetries" | "signal" | "sleep">,
): Promise<T> {
  const retries = options.maxRetries ?? 3;
  for (let attempt = 0; ; attempt += 1) {
    options.signal?.throwIfAborted();
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof HospitableApiError) || !error.retryable || attempt >= retries) throw error;
      const delay = error.retryAfterMs ?? Math.min(250 * 2 ** attempt, 4_000);
      await (options.sleep ?? sleep)(delay, options.signal);
    }
  }
}

function pageFromLink(link?: string | null): number | undefined {
  if (!link) return undefined;
  try {
    const value = Number(new URL(link).searchParams.get("page"));
    return Number.isInteger(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function isTimestamp(value: string) {
  return value.length > 0 && !Number.isNaN(Date.parse(value));
}

function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(signal.reason);
    }, { once: true });
  });
}
