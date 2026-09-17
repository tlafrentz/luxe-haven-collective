import { beforeEach, describe, expect, it, vi } from "vitest";

type Response = { data: unknown; error: { code?: string; message: string } | null };

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

import { startCheckoutAttempt, verifyCheckoutAttempt } from "./direct-booking";

describe("startCheckoutAttempt", () => {
  beforeEach(() => {
    tableState.clear();
    delete process.env.HOSPITABLE_DIRECT_CHECKOUT_URL_TEMPLATE;
  });

  it("refuses when the property does not exist", async () => {
    configureTable("properties", [{ data: null, error: null }]);
    const result = await startCheckoutAttempt({ propertySlug: "not-a-property" });
    expect(result).toEqual({ ok: false, code: "property_not_found" });
  });

  it("refuses when the property is not flagged for direct booking", async () => {
    configureTable("properties", [{ data: { id: "property-1", metadata: {} }, error: null }]);
    const result = await startCheckoutAttempt({ propertySlug: "mesa" });
    expect(result).toEqual({ ok: false, code: "direct_booking_disabled" });
  });

  it("starts a fresh attempt with an unguessable token and a null redirect when checkout isn't configured yet", async () => {
    configureTable("properties", [{ data: { id: "property-1", metadata: { direct_booking_enabled: true } }, error: null }]);
    configureTable("external_properties", [{ data: { external_id: "ext-1" }, error: null }]);
    configureTable("checkout_attempts", [{ data: null, error: null }]);

    const result = await startCheckoutAttempt({ propertySlug: "mesa", arrival: "2026-10-08", departure: "2026-10-17" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attemptToken.length).toBeGreaterThan(20);
    expect(result.redirectUrl).toBeNull();
  });

  it("builds a redirect URL once a checkout template is configured", async () => {
    process.env.HOSPITABLE_DIRECT_CHECKOUT_URL_TEMPLATE = "https://book.hospitable.com/{propertyId}?return={returnUrl}";
    configureTable("properties", [{ data: { id: "property-1", metadata: { direct_booking_enabled: true } }, error: null }]);
    configureTable("external_properties", [{ data: { external_id: "ext-1" }, error: null }]);
    configureTable("checkout_attempts", [{ data: null, error: null }]);

    const result = await startCheckoutAttempt({ propertySlug: "mesa" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.redirectUrl).toContain("https://book.hospitable.com/ext-1");
  });

  it("reuses a still-active existing attempt instead of starting a new one", async () => {
    configureTable("properties", [{ data: { id: "property-1", metadata: { direct_booking_enabled: true } }, error: null }]);
    configureTable("external_properties", [{ data: { external_id: "ext-1" }, error: null }]);
    configureTable("checkout_attempts", [
      { data: { attempt_token: "existing-token", status: "started", expires_at: new Date(Date.now() + 60_000).toISOString() }, error: null },
    ]);

    const result = await startCheckoutAttempt({ propertySlug: "mesa", existingAttemptToken: "existing-token" });

    expect(result).toMatchObject({ ok: true, attemptToken: "existing-token" });
  });
});

describe("verifyCheckoutAttempt", () => {
  beforeEach(() => {
    tableState.clear();
  });

  it("reports not_found for an empty token", async () => {
    expect(await verifyCheckoutAttempt("")).toEqual({ state: "not_found" });
  });

  it("reports not_found when no attempt matches the token", async () => {
    configureTable("checkout_attempts", [{ data: null, error: null }]);
    expect(await verifyCheckoutAttempt("unknown-token")).toEqual({ state: "not_found" });
  });

  it("reports pending when the attempt exists but no verified booking is linked yet", async () => {
    configureTable("checkout_attempts", [
      { data: { id: "attempt-1", property_id: "property-1", external_property_id: "ext-1", arrival: null, departure: null }, error: null },
    ]);
    configureTable("bookings", [{ data: null, error: null }]);

    expect(await verifyCheckoutAttempt("token-1")).toEqual({ state: "pending" });
  });

  it("reports confirmed once a verified booking is linked to the attempt", async () => {
    configureTable("checkout_attempts", [
      { data: { id: "attempt-1", property_id: "property-1", external_property_id: "ext-1", arrival: "2026-10-08", departure: "2026-10-17" }, error: null },
    ]);
    configureTable("bookings", [
      {
        data: {
          booking_code: "LHS-MESA-1042",
          check_in: "2026-10-08",
          check_out: "2026-10-17",
          guests: 2,
          property: { name: "Calm East Valley stay" },
        },
        error: null,
      },
    ]);

    expect(await verifyCheckoutAttempt("token-1")).toEqual({
      state: "confirmed",
      confirmationCode: "LHS-MESA-1042",
      propertyName: "Calm East Valley stay",
      checkIn: "2026-10-08",
      checkOut: "2026-10-17",
      guests: 2,
    });
  });
});
