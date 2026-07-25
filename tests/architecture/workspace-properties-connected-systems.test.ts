import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260725130000_workspace_properties_connected_systems.sql", "utf8");

describe("Sprint 4D architecture", () => {
  it("preserves canonical ownership and deterministic provider references", () => {
    expect(migration).toContain("property.owner_id");
    expect(migration).toContain("external_properties_workspace_provider_external_key");
    expect(migration).not.toMatch(/similar.*name/i);
    expect(migration).toContain("Active property exists without a valid workspace owner");
  });

  it("keeps credentials out of the workspace projection", () => {
    const repository = readFileSync("src/features/workspace/infrastructure/supabase-properties-systems-repository.ts", "utf8");
    expect(repository).not.toMatch(/token|secret|raw_payload/);
  });

  it("enforces membership authorization and idempotent commands", () => {
    expect(migration).toContain("active_workspace_role");
    expect(migration).toContain("workspace_property_system_activity_command_key");
    expect(migration).toContain("'replayed',true");
  });
});
