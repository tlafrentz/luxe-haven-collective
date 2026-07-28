import { describe, expect, it, vi } from "vitest";
import {
  hydrateHospitableReservationMessageHistory,
  type HospitableMessageHydrationContext,
  type HospitableMessageHydrationGateway,
} from "./hydrate-messages";
import type { HospitableMessagePage, NormalizedHospitableMessage } from "./messages";

const context: HospitableMessageHydrationContext = Object.freeze({
  workspaceId: "workspace-1",
  propertyId: "property-1",
  bookingId: "booking-1",
  reservationId: "reservation-1",
  conversationId: "conversation-1",
});

describe("GM-001B historical message hydration", () => {
  it("hydrates every page, preserves provider chronology, and completes once", async () => {
    const harness = gateway();
    const pages = new Map<number, HospitableMessagePage>([
      [1, page(1, [{ id: "message-1", body: "First", sender_type: "guest", created_at: "2026-07-01T01:00:00Z" }], 2)],
      [2, page(2, [{ id: "message-2", body: "Second", sender_type: "host", created_at: "2026-07-01T02:00:00Z" }])],
    ]);
    const result = await hydrateHospitableReservationMessageHistory(
      { workspaceId: context.workspaceId, reservationId: context.reservationId, requestId: "request-1" },
      { gateway: harness.value, readPage: async (_reservation, number) => pages.get(number)!, sleep: async () => undefined },
    );

    expect(result).toEqual({ state: "completed", pages: 2, observed: 2, inserted: 2, duplicates: 0, rejected: 0 });
    expect(harness.messages.map(message => message.providerMessageId)).toEqual(["message-1", "message-2"]);
    expect(harness.messages.map(message => message.direction)).toEqual(["inbound", "outbound"]);
    expect(harness.complete).toHaveBeenCalledOnce();
  });

  it("performs near-zero work when the reservation is already complete", async () => {
    const harness = gateway({ claim: "completed" });
    const readPage = vi.fn();
    await expect(hydrateHospitableReservationMessageHistory(
      { workspaceId: context.workspaceId, reservationId: context.reservationId },
      { gateway: harness.value, readPage },
    )).resolves.toMatchObject({ state: "already-completed", observed: 0, inserted: 0 });
    expect(readPage).not.toHaveBeenCalled();
  });

  it("deduplicates a webhook message encountered by later history hydration", async () => {
    const harness = gateway({ existing: ["message-1"] });
    const result = await hydrateHospitableReservationMessageHistory(
      { workspaceId: context.workspaceId, reservationId: context.reservationId },
      { gateway: harness.value, readPage: async () => page(1, [{ id: "message-1", body: "Existing", sender_type: "guest", created_at: "2026-07-01T01:00:00Z" }]) },
    );
    expect(result).toMatchObject({ inserted: 0, duplicates: 1, state: "completed" });
    expect(harness.messages).toHaveLength(0);
  });

  it("records resumable partial state when a later page remains unavailable", async () => {
    const harness = gateway();
    const failure = Object.assign(new Error("provider unavailable"), { retryable: true });
    const readPage = vi.fn(async (_reservation: string, number: number) => {
      if (number === 1) return page(1, [{ id: "message-1", body: "Saved", sender_type: "guest", created_at: "2026-07-01T01:00:00Z" }], 2);
      throw failure;
    });
    const result = await hydrateHospitableReservationMessageHistory(
      { workspaceId: context.workspaceId, reservationId: context.reservationId, maxRetries: 1 },
      { gateway: harness.value, readPage, sleep: async () => undefined },
    );
    expect(result).toMatchObject({ state: "partial", inserted: 1, nextPage: 2 });
    expect(harness.fail).toHaveBeenCalledWith(context, expect.objectContaining({ nextPage: 2 }), "provider unavailable");
  });

  it("resumes at the persisted page with cumulative progress", async () => {
    const harness = gateway({
      claim: { state: "claimed", nextPage: 2, pages: 1, observed: 1, inserted: 1, duplicates: 0, rejected: 0 },
    });
    const readPage = vi.fn(async (_reservation: string, number: number) =>
      page(number, [{ id: "message-2", body: "Resumed", sender_type: "guest", created_at: "2026-07-01T02:00:00Z" }]),
    );
    const result = await hydrateHospitableReservationMessageHistory(
      { workspaceId: context.workspaceId, reservationId: context.reservationId },
      { gateway: harness.value, readPage },
    );
    expect(readPage).toHaveBeenCalledWith(context.reservationId, 2, undefined);
    expect(result).toMatchObject({ state: "completed", pages: 2, observed: 2, inserted: 2 });
  });

  it("rejects missing and ambiguous canonical conversation resolution before provider access", async () => {
    const readPage = vi.fn();
    for (const code of ["message_hydration_conversation_not_found", "message_hydration_conversation_ambiguous"]) {
      const harness = gateway();
      harness.resolve.mockRejectedValueOnce(new Error(code));
      await expect(hydrateHospitableReservationMessageHistory(
        { workspaceId: context.workspaceId, reservationId: context.reservationId },
        { gateway: harness.value, readPage },
      )).rejects.toThrow(code);
    }
    expect(readPage).not.toHaveBeenCalled();
  });

  it("marks malformed observations partial without inventing a message", async () => {
    const harness = gateway();
    const result = await hydrateHospitableReservationMessageHistory(
      { workspaceId: context.workspaceId, reservationId: context.reservationId },
      { gateway: harness.value, readPage: async () => page(1, [{ body: "No identity", created_at: "2026-07-01T01:00:00Z" }]) },
    );
    expect(result).toMatchObject({ state: "partial", rejected: 1, inserted: 0 });
    expect(harness.messages).toHaveLength(0);
  });
});

function page(
  number: number,
  messages: HospitableMessagePage["messages"],
  nextPage?: number,
): HospitableMessagePage {
  return Object.freeze({ page: number, messages: Object.freeze(messages), ...(nextPage ? { nextPage } : {}), complete: nextPage === undefined });
}

type Claim = Awaited<ReturnType<HospitableMessageHydrationGateway["claim"]>>;

function gateway(options: Readonly<{ claim?: Claim | Claim["state"]; existing?: readonly string[] }> = {}) {
  const messages: NormalizedHospitableMessage[] = [];
  const existing = new Set(options.existing ?? []);
  const resolve = vi.fn(async () => context);
  const complete = vi.fn(async () => undefined);
  const fail = vi.fn(async () => undefined);
  const value: HospitableMessageHydrationGateway = {
    resolve,
    claim: vi.fn(async () => typeof options.claim === "string"
      ? claim(options.claim)
      : options.claim ?? claim("claimed")),
    append: vi.fn(async (_context, message) => {
      if (existing.has(message.providerMessageId)) return "duplicate";
      existing.add(message.providerMessageId);
      messages.push(message);
      return "inserted";
    }),
    checkpoint: vi.fn(async () => undefined),
    complete,
    fail,
  };
  return { value, messages, resolve, complete, fail };
}

function claim(state: Claim["state"]): Claim {
  return { state, nextPage: 1, pages: 0, observed: 0, inserted: 0, duplicates: 0, rejected: 0 };
}
