import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createRoleAssignment, revokeRoleAssignment } from "./assignments";
import type { PlatformAccessClient } from "./client";

describe("createRoleAssignment", () => {
  it("wraps p_input with snake_case fields and sensible defaults", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "granted", assignmentId: "ra-1", version: 1 }, error: null });
    const client = { rpc } as unknown as PlatformAccessClient;

    const result = await createRoleAssignment(client, {
      subjectId: "subject-1",
      role: "manager",
      workspaceId: "workspace-1",
      module: "guidebooks",
      reason: "onboarding",
      idempotencyKey: "key-1",
    });

    expect(rpc).toHaveBeenCalledWith("create_role_assignment", {
      p_input: {
        subject_id: "subject-1",
        role: "manager",
        workspace_id: "workspace-1",
        module: "guidebooks",
        scope_type: "workspace",
        scope_id: null,
        valid_from: null,
        valid_until: null,
        reason: "onboarding",
        idempotency_key: "key-1",
        correlation_id: null,
      },
    });
    expect(result).toEqual({ status: "granted", assignmentId: "ra-1", version: 1 });
  });

  it("throws on an RPC error", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "PA_ASSIGNMENT_PERMISSION_DENIED" } }) } as unknown as PlatformAccessClient;
    await expect(
      createRoleAssignment(client, { subjectId: "s", role: "viewer", workspaceId: "w", reason: "r", idempotencyKey: "k" }),
    ).rejects.toThrow("PA_ASSIGNMENT_PERMISSION_DENIED");
  });
});

describe("revokeRoleAssignment", () => {
  it("wraps p_input with snake_case fields", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "revoked", assignmentId: "ra-1", version: 2 }, error: null });
    const client = { rpc } as unknown as PlatformAccessClient;

    const result = await revokeRoleAssignment(client, { assignmentId: "ra-1", expectedVersion: 1, reason: "offboarding", idempotencyKey: "key-2" });

    expect(rpc).toHaveBeenCalledWith("revoke_role_assignment", {
      p_input: { assignment_id: "ra-1", expected_version: 1, reason: "offboarding", idempotency_key: "key-2", correlation_id: null },
    });
    expect(result).toEqual({ status: "revoked", assignmentId: "ra-1", version: 2 });
  });
});

describe("PA-001 isolation", () => {
  it("does not import from any other src/features directory (ships unwired)", () => {
    const dir = join(process.cwd(), "src/features/platform-access");
    const files = readdirSync(dir).filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.endsWith(".test.ts"));
    for (const file of files) {
      const contents = readFileSync(join(dir, file), "utf8");
      const imports = [...contents.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec.startsWith("@/features/") && !spec.startsWith("@/features/platform-access")).toBe(false);
      }
    }
  });
});
