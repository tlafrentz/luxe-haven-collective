import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Response = { data: unknown; error: { code?: string; message: string } | null; count?: number };

function makeCallIndexedTable(responses: readonly Response[]) {
  let call = -1;
  function next(): Response {
    call = Math.min(call + 1, responses.length - 1);
    return responses[call] ?? { data: null, error: null };
  }
  function builder(): Record<string, unknown> {
    const chainMethods = ["select", "eq", "neq", "not", "in", "order", "limit", "gte", "lte"];
    const chain: Record<string, unknown> = {};
    for (const method of chainMethods) chain[method] = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => next());
    chain.single = vi.fn(async () => next());
    chain.then = (resolve: (value: Response) => unknown) => resolve(next());
    return chain;
  }
  return { from: () => builder() };
}

const tableState = new Map<string, ReturnType<typeof makeCallIndexedTable>>();

function configureTable(name: string, responses: readonly Response[]) {
  tableState.set(name, makeCallIndexedTable(responses));
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => (tableState.get(table) ?? makeCallIndexedTable([])).from(),
  }),
}));

const getHospitableReservationDetail = vi.fn();
vi.mock("@/features/integrations/hospitable/lib/reservations", () => ({
  getHospitableReservationDetail: (...args: unknown[]) => getHospitableReservationDetail(...args),
}));

const mapHospitableReservation = vi.fn();
vi.mock("@/features/integrations/hospitable/lib/reservation-mapper", () => ({
  mapHospitableReservation: (...args: unknown[]) => mapHospitableReservation(...args),
}));

const upsertBooking = vi.fn();
vi.mock("@/features/integrations/hospitable/lib/sync-reservations", () => ({
  upsertBooking: (...args: unknown[]) => upsertBooking(...args),
}));

const resolveHospitableMessagingWorkspace = vi.fn();
vi.mock("@/features/integrations/hospitable/lib/messaging-workspace", () => ({
  resolveHospitableMessagingWorkspace: (...args: unknown[]) => resolveHospitableMessagingWorkspace(...args),
}));

const buildBookingExceptionAction = vi.fn();
vi.mock("@/features/integrations/hospitable/lib/booking-exception-action", () => ({
  buildBookingExceptionAction: (...args: unknown[]) => buildBookingExceptionAction(...args),
}));

const platformActionAdd = vi.fn();
vi.mock("@/platform/actions", () => ({
  SupabasePlatformActionRepository: class {
    add(...args: unknown[]) {
      return platformActionAdd(...args);
    }
  },
}));

import { POST } from "./route";

const SECRET = "test-reservations-webhook-secret";

function request(body: Record<string, unknown>, authorization = `Bearer ${SECRET}`) {
  const raw = JSON.stringify(body);
  return new Request("https://luxehavencollective.co/api/webhooks/hospitable/reservations", {
    method: "POST",
    body: raw,
    headers: { authorization },
  });
}

const reservationCreatedBody = {
  event: "reservation.created",
  data: { id: "res-1" },
};

const fakeReservation = { id: "res-1", properties: [{ id: "ext-prop-1" }] };
const fakeMapping = {
  booking: {
    external_reservation_id: "res-1",
    check_in: "2026-10-08",
    check_out: "2026-10-17",
    external_platform: "direct",
    status: "confirmed",
  },
};

describe("Hospitable reservation webhook", () => {
  beforeEach(() => {
    process.env.HOSPITABLE_RESERVATIONS_WEBHOOK_SECRET = SECRET;
    tableState.clear();
    getHospitableReservationDetail.mockReset().mockResolvedValue(fakeReservation);
    mapHospitableReservation.mockReset().mockReturnValue(fakeMapping);
    upsertBooking.mockReset().mockResolvedValue(undefined);
    resolveHospitableMessagingWorkspace.mockReset().mockResolvedValue({ workspaceId: "workspace-1", connectionId: "connection-1" });
    buildBookingExceptionAction.mockReset().mockReturnValue({ id: "action-1" });
    platformActionAdd.mockReset().mockResolvedValue(undefined);

    // Default happy-path table wiring, overridden per test as needed.
    configureTable("hospitable_reservation_events", [
      { data: null, error: null }, // findOrCreateReceipt: no existing receipt
      { data: { id: "receipt-1" }, error: null }, // insert -> new receipt row
      { data: null, error: null }, // final status update ack
    ]);
    configureTable("external_properties", [{ data: { property_id: "local-property-1", connection_id: "connection-1" }, error: null }]);
    configureTable("checkout_attempts", [{ data: null, error: null }]);
  });

  it("rejects a request with no or invalid authorization before touching the database", async () => {
    const response = await POST(request(reservationCreatedBody, "Bearer wrong-secret"));
    expect(response.status).toBe(401);
    expect(getHospitableReservationDetail).not.toHaveBeenCalled();
  });

  it("processes a new reservation.created event end to end", async () => {
    const response = await POST(request(reservationCreatedBody));
    const body = await response.clone().json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accepted: true });
    expect(getHospitableReservationDetail).toHaveBeenCalledWith("res-1");
    expect(upsertBooking).toHaveBeenCalledWith(fakeMapping.booking, "workspace-1");
  });

  it("acks a duplicate delivery of an already-processed event without reprocessing", async () => {
    configureTable("hospitable_reservation_events", [{ data: { id: "receipt-1", status: "processed" }, error: null }]);

    const response = await POST(request(reservationCreatedBody));
    const body = await response.clone().json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accepted: true, code: "duplicate_event" });
    expect(getHospitableReservationDetail).not.toHaveBeenCalled();
    expect(upsertBooking).not.toHaveBeenCalled();
  });

  it("retries processing for a receipt stuck in 'received' rather than treating it as a duplicate", async () => {
    configureTable("hospitable_reservation_events", [
      { data: { id: "receipt-1", status: "received" }, error: null },
      { data: null, error: null }, // final status update ack
    ]);

    const response = await POST(request(reservationCreatedBody));

    expect(response.status).toBe(200);
    expect(getHospitableReservationDetail).toHaveBeenCalledTimes(1);
    expect(upsertBooking).toHaveBeenCalledTimes(1);
  });

  it("routes an unmapped property to the exception queue instead of guessing", async () => {
    configureTable("external_properties", [{ data: null, error: null }]);

    const response = await POST(request(reservationCreatedBody));
    const body = await response.clone().json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({ accepted: true, code: "unmapped_property", reviewRequired: true });
    expect(upsertBooking).not.toHaveBeenCalled();
  });

  it("acks and ignores an event type this route does not handle", async () => {
    const response = await POST(request({ event: "message.received", data: { id: "msg-1" } }));
    const body = await response.clone().json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ accepted: true, code: "event_ignored" });
    expect(getHospitableReservationDetail).not.toHaveBeenCalled();
  });

  it("marks the receipt failed and records an exception when upserting fails, without crashing the response", async () => {
    upsertBooking.mockRejectedValue(new Error("boom"));

    const response = await POST(request(reservationCreatedBody));

    expect(response.status).toBe(503);
    expect(buildBookingExceptionAction).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: "local-property-1", issueType: "reservation_upsert_failed", workspaceId: "workspace-1" }),
    );
    expect(platformActionAdd).toHaveBeenCalledWith({ action: { id: "action-1" } });
  });
});

describe("webhook authentication helper", () => {
  it("also accepts a valid HMAC signature as a fallback to the bearer secret", async () => {
    process.env.HOSPITABLE_RESERVATIONS_WEBHOOK_SECRET = SECRET;
    tableState.clear();
    configureTable("hospitable_reservation_events", [{ data: { id: "receipt-1", status: "processed" }, error: null }]);

    const raw = JSON.stringify(reservationCreatedBody);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", SECRET).update(`${timestamp}.${raw}`).digest("hex");

    const response = await POST(
      new Request("https://luxehavencollective.co/api/webhooks/hospitable/reservations", {
        method: "POST",
        body: raw,
        headers: { "x-luxe-webhook-timestamp": timestamp, "x-luxe-webhook-signature": signature },
      }),
    );

    expect(response.status).toBe(200);
  });
});
