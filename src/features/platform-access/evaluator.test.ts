import { describe, expect, it, vi } from "vitest";
import { evaluatePrivilege } from "./evaluator";
import type { PlatformAccessClient } from "./client";

describe("evaluatePrivilege", () => {
  it("calls evaluate_privilege with snake_case params and defaults scope to workspace", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ allowed: true, reason_code: "PA_ALLOW", matching_assignment_ids: ["a1"] }], error: null });
    const client = { rpc } as unknown as PlatformAccessClient;

    const result = await evaluatePrivilege(client, {
      subjectId: "subject-1",
      workspaceId: "workspace-1",
      privilegeId: "guidebooks.guidebook.publish",
    });

    expect(rpc).toHaveBeenCalledWith("evaluate_privilege", {
      p_subject_id: "subject-1",
      p_workspace_id: "workspace-1",
      p_privilege_id: "guidebooks.guidebook.publish",
      p_scope_type: "workspace",
      p_scope_id: null,
    });
    expect(result).toEqual({ allowed: true, reasonCode: "PA_ALLOW", matchingAssignmentIds: ["a1"] });
  });

  it("passes an explicit narrower scope through unchanged", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ allowed: false, reason_code: "PA_DENY_NO_GRANT", matching_assignment_ids: [] }], error: null });
    const client = { rpc } as unknown as PlatformAccessClient;

    await evaluatePrivilege(client, {
      subjectId: "subject-1",
      workspaceId: "workspace-1",
      privilegeId: "furnishing.package.package_edit",
      scopeType: "property",
      scopeId: "property-9",
    });

    expect(rpc).toHaveBeenCalledWith("evaluate_privilege", expect.objectContaining({ p_scope_type: "property", p_scope_id: "property-9" }));
  });

  it("throws on an RPC error rather than returning a false allow", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }) } as unknown as PlatformAccessClient;
    await expect(evaluatePrivilege(client, { subjectId: "s", workspaceId: "w", privilegeId: "workspace.roles.roles_view" })).rejects.toThrow("boom");
  });
});
