import { describe, expect, it, vi } from "vitest";
import { SupabaseGuidebookPropertyProjectionRepository } from "./supabase-authoring-repositories";

describe("SupabaseGuidebookPropertyProjectionRepository", () => {
  it("loads publication context using only canonical property columns", async () => {
    let selected = "";
    const response = {
      data: {
        id: "property-1",
        name: "Mesa Modern",
        address_line_1: "1248 S Vineyard Rd",
        city: "Mesa",
        state: "AZ",
        timezone: "America/Phoenix",
        check_in_time: "4:00 PM",
        check_out_time: "11:00 AM",
        amenities: [],
        house_rules: [],
        featured_image: null,
        updated_at: "2026-08-14T00:00:00Z",
      },
      error: null,
    };
    const query: Record<string, unknown> = {};
    query.select = vi.fn((columns: string) => {
      selected = columns;
      return query;
    });
    query.eq = vi.fn(() => query);
    query.maybeSingle = vi.fn(async () => response);
    const client = { from: vi.fn(() => query) };

    const result = await new SupabaseGuidebookPropertyProjectionRepository(
      client as never,
    ).load({
      workspaceId: "workspace-1",
      propertyId: "property-1",
      actorId: "actor-1",
    });

    expect(selected.split(",")).toContain("address_line_1");
    expect(selected.split(",")).not.toContain("address");
    expect(result).toMatchObject({
      propertyId: "property-1",
      address: "1248 S Vineyard Rd",
    });
  });
});
