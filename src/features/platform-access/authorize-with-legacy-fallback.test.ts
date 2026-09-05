import { describe, expect, it, vi } from "vitest";
import { authorizeWithLegacyFallback } from "./authorize-with-legacy-fallback";
import type { PlatformAccessClient } from "./client";

describe("authorizeWithLegacyFallback", () => {
  it("returns true immediately when the legacy check already allows, without calling evaluate_privilege", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as PlatformAccessClient;

    const result = await authorizeWithLegacyFallback({
      client,
      subjectId: "subject-1",
      workspaceId: "workspace-1",
      privilegeId: "guidebooks.guidebook.publish",
      legacyAllowed: true,
    });

    expect(result).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("falls through to evaluate_privilege when the legacy check denies, and returns its allowed flag", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ allowed: true, reason_code: "PA_ALLOW", matching_assignment_ids: ["a1"] }], error: null });
    const client = { rpc } as unknown as PlatformAccessClient;

    const result = await authorizeWithLegacyFallback({
      client,
      subjectId: "subject-1",
      workspaceId: "workspace-1",
      privilegeId: "guidebooks.guidebook.publish",
      scopeType: "property",
      scopeId: "property-1",
      legacyAllowed: false,
    });

    expect(result).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      "evaluate_privilege",
      expect.objectContaining({ p_subject_id: "subject-1", p_workspace_id: "workspace-1", p_privilege_id: "guidebooks.guidebook.publish", p_scope_type: "property", p_scope_id: "property-1" }),
    );
  });

  it("fails closed when both the legacy check and evaluate_privilege deny", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ allowed: false, reason_code: "PA_DENY_NO_GRANT", matching_assignment_ids: [] }], error: null });
    const client = { rpc } as unknown as PlatformAccessClient;

    const result = await authorizeWithLegacyFallback({
      client,
      subjectId: "subject-1",
      workspaceId: "workspace-1",
      privilegeId: "guidebooks.guidebook.publish",
      legacyAllowed: false,
    });

    expect(result).toBe(false);
  });
});
