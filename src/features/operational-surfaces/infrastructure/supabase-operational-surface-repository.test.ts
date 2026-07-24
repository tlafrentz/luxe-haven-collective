import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  mapOperationalPropertyRows,
  mapOperationalSyncRow,
} from "./supabase-operational-surface-repository";

describe("operational surface persistence mapping", () => {
  it("applies owner scope to property and synchronization reads", () => {
    const source = readFileSync(
      new URL("./supabase-operational-surface-repository.ts", import.meta.url),
      "utf8",
    );
    expect(source.match(/\.eq\("owner_id", ownerId\)/g)).toHaveLength(2);
    expect(source).toContain("principal.workspaceId");
  });

  it("maps owner-scoped properties without provider DTOs", () => {
    const result = mapOperationalPropertyRows([
      {
        id: "property-1",
        owner_id: "owner-1",
        name: "River District Loft",
        city: "Chicago",
        state: "IL",
        status: "active",
        timezone: "America/Chicago",
        guidebook_available: false,
        featured_image: null,
        updated_at: "2026-07-24T10:00:00.000Z",
      },
    ]);
    expect(result[0]).toMatchObject({
      ownerId: "owner-1",
      connectionState: "unknown",
      marketLabel: "Chicago, IL",
    });
    expect(result[0]).not.toHaveProperty("external_properties");
  });

  it("preserves partial synchronization instead of reporting success", () => {
    expect(
      mapOperationalSyncRow({
        status: "partially-succeeded",
        provider: "hospitable",
        records_created: 4,
        records_updated: 5,
        records_unchanged: 0,
        records_failed: 1,
        warnings: ["One reservation was not refreshed."],
        affected_capabilities: ["guest-context"],
        completed_at: "2026-07-24T12:00:00.000Z",
      }),
    ).toMatchObject({
      status: "partially-succeeded",
      failed: 1,
      providerConnected: true,
    });
  });
});
