import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import {
  OperationalReadError,
} from "./owner-identity";
import { SupabaseReservationContextRepository } from "./supabase-reservation-context-repository";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

type Result = Readonly<{ data: unknown; error: unknown }>;

class Query {
  private readonly filters = new Map<string, unknown>();

  constructor(
    private readonly table: string,
    private readonly executeQuery: (
      table: string,
      filters: ReadonlyMap<string, unknown>,
      single: boolean,
    ) => Result,
  ) {}

  select() { return this; }
  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }
  order() { return this; }
  maybeSingle() {
    return Promise.resolve(this.executeQuery(this.table, this.filters, true));
  }
  then(resolve: (result: Result) => unknown) {
    return Promise.resolve(
      this.executeQuery(this.table, this.filters, false),
    ).then(resolve);
  }
}

function contextRow(id: string) {
  return {
    id,
    property_id: "mesa-property",
    status: "confirmed",
    source: "Airbnb",
    external_provider: "hospitable",
    external_reservation_id: `external-${id}`,
    external_guest_id: `guest-${id}`,
    booking_code: id,
    guest_full_name: "Mesa Guest",
    guest_email: null,
    guest_phone: null,
    guest_language: "en",
    guests: 2,
    party_adults: 2,
    party_children: 0,
    party_infants: 0,
    party_pets: 0,
    check_in: "2026-07-25",
    check_out: "2026-07-27",
    last_synced_at: "2026-07-24T14:00:00.000Z",
    guest_context_synced_at: "2026-07-24T14:00:00.000Z",
    primary_guest_id: `canonical-${id}`,
    canonical_guest: {
      id: `canonical-${id}`,
      identity_status: "resolved",
      display_name: "Mesa Guest",
      email: null,
      phone: null,
      language: "en",
      last_observed_at: "2026-07-24T14:00:00.000Z",
    },
    property: {
      id: "mesa-property",
      owner_id: "owner-mesa",
      name: "The Mesa",
      city: "Mesa",
      state: "AZ",
      timezone: "America/Phoenix",
      check_in_time: "4:00 PM",
      check_out_time: "10:00 AM",
      status: "active",
      guidebook_available: true,
      featured_image: null,
      updated_at: "2026-07-24T13:00:00.000Z",
    },
  };
}

function client(
  userId: string | null,
  handler: (
    table: string,
    filters: ReadonlyMap<string, unknown>,
    single: boolean,
  ) => Result,
) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      })),
    },
    from: (table: string) => new Query(table, handler),
  };
}

describe("Supabase reservation context repository integration contract", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
  });

  it("resolves profiles.id to owners.id and returns both Mesa reservations", async () => {
    const seen = new Map<string, unknown>();
    vi.mocked(createClient).mockResolvedValue(client("profile-mesa", (table, filters) => {
      for (const [key, value] of filters) seen.set(`${table}.${key}`, value);
      if (table === "owners")
        return { data: { id: "owner-mesa", profile_id: "profile-mesa" }, error: null };
      return { data: [contextRow("MESA-1"), contextRow("MESA-2")], error: null };
    }) as never);

    const result = await new SupabaseReservationContextRepository().list("profile-mesa");

    expect(result).toHaveLength(2);
    expect(result.map(({ propertyName }) => propertyName)).toEqual(["The Mesa", "The Mesa"]);
    expect(seen.get("owners.profile_id")).toBe("profile-mesa");
    expect(seen.get("bookings.property.owner_id")).toBe("owner-mesa");
  });

  it("returns an empty collection for another owner and for an owner with no records", async () => {
    vi.mocked(createClient).mockResolvedValue(client("profile-other", (table) =>
      table === "owners"
        ? { data: { id: "owner-other", profile_id: "profile-other" }, error: null }
        : { data: [], error: null },
    ) as never);
    await expect(
      new SupabaseReservationContextRepository().list("profile-other"),
    ).resolves.toEqual([]);

    vi.mocked(createClient).mockResolvedValue(client("profile-empty", (table) =>
      table === "owners"
        ? { data: null, error: null }
        : { data: [], error: null },
    ) as never);
    await expect(
      new SupabaseReservationContextRepository().list("profile-empty"),
    ).resolves.toEqual([]);
  });

  it("denies anonymous and cross-owner access", async () => {
    vi.mocked(createClient).mockResolvedValue(client(null, () => ({ data: null, error: null })) as never);
    await expect(
      new SupabaseReservationContextRepository().list("profile-mesa"),
    ).rejects.toMatchObject({ state: "permission" });

    vi.mocked(createClient).mockResolvedValue(client("profile-other", () => ({ data: null, error: null })) as never);
    await expect(
      new SupabaseReservationContextRepository().list("profile-mesa"),
    ).rejects.toMatchObject({ state: "permission" });
  });

  it("preserves Supabase diagnostics and classifies inaccessible reads", async () => {
    const diagnostic = {
      code: "42501",
      message: "permission denied for table bookings",
      details: "RLS policy rejected the row",
      hint: "Verify the authenticated profile",
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(createClient).mockResolvedValue(client("profile-mesa", (table) =>
      table === "owners"
        ? { data: { id: "owner-mesa", profile_id: "profile-mesa" }, error: null }
        : { data: null, error: diagnostic },
    ) as never);

    const failure = await new SupabaseReservationContextRepository()
      .list("profile-mesa")
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(OperationalReadError);
    expect(failure).toMatchObject({
      state: "permission",
      cause: diagnostic,
      diagnostic,
    });
    expect(console.error).toHaveBeenCalledWith(
      "Operational Supabase read failed.",
      expect.objectContaining({ code: "42501", details: diagnostic.details }),
    );
  });

  it("reports malformed joined data as degraded instead of an empty result", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(createClient).mockResolvedValue(client("profile-mesa", (table) =>
      table === "owners"
        ? { data: { id: "owner-mesa", profile_id: "profile-mesa" }, error: null }
        : { data: [{ ...contextRow("MESA-1"), property: null }], error: null },
    ) as never);

    await expect(
      new SupabaseReservationContextRepository().list("profile-mesa"),
    ).rejects.toMatchObject({ state: "degraded" });
  });
});
