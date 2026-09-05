import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AutomationCommandResult } from "./automation-workspace";

const state = vi.hoisted(() => ({
  access: {
    workspaceId: "workspace-1",
    role: "administrator" as string,
    status: "active" as string,
    propertyAccess: {
      type: "selected" as const,
      propertyIds: ["property-1"],
    },
  },
  flags: {
    workspace: true,
    readOnly: false,
    authoring: true,
    approvals: true,
    runControls: true,
    templates: true,
  },
  transitionResult: { ok: true, value: {} } as Record<string, unknown>,
  transitionCalls: [] as Record<string, unknown>[],
  decideApprovalResult: { ok: true, value: {} } as Record<string, unknown>,
  decideApprovalCalls: [] as Record<string, unknown>[],
  cancelResult: { ok: true, value: {} } as Record<string, unknown>,
  cancelCalls: [] as Record<string, unknown>[],
  approval: {
    id: "approval-1",
    tenantId: "workspace-1",
    runId: "run-1",
    version: 2,
  } as Record<string, unknown> | null,
  run: {
    id: "run-1",
    tenantId: "workspace-1",
    version: 5,
  } as Record<string, unknown> | null,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
}));
vi.mock("@/features/workspace", () => ({
  SupabaseTeamAccessRepository: class {
    async resolve() {
      return state.access;
    }
    async properties() {
      return [{ id: "property-1" }];
    }
  },
}));
vi.mock(
  "@/features/automation-workspace/application/automation-workspace-composition",
  () => ({
    automationExperienceFlags: () => state.flags,
  }),
);
vi.mock("@/platform/automations", () => ({
  SupabaseAutomationFoundationRepository: class {},
  createAutomationFoundationService: () => ({
    async transition(input: Record<string, unknown>) {
      state.transitionCalls.push(input);
      return state.transitionResult;
    },
  }),
  SupabaseAutomationGovernedExecutionRepository: class {
    async getApproval() {
      return state.approval;
    }
    async getRun() {
      return state.run;
    }
  },
  createGovernedExecutionService: () => ({
    async decideApproval(input: Record<string, unknown>) {
      state.decideApprovalCalls.push(input);
      return state.decideApprovalResult;
    },
    async requestCancellation(input: Record<string, unknown>) {
      state.cancelCalls.push(input);
      return state.cancelResult;
    },
  }),
}));

import { revalidatePath } from "next/cache";
import { executeAutomationWorkspaceCommand } from "./automation-workspace";

const initial: AutomationCommandResult = { ok: false, message: "" };

function fields(overrides: Partial<Record<string, string>> = {}) {
  return {
    command: "pause",
    targetId: "automation-1",
    expectedVersion: "3",
    idempotencyKey: "au001d:pause:automation-1:v3",
    ...overrides,
  };
}
function submit(overrides: Partial<Record<string, string>> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields(overrides)))
    data.set(key, value);
  return executeAutomationWorkspaceCommand(initial, data);
}

describe("executeAutomationWorkspaceCommand", () => {
  beforeEach(() => {
    state.access = {
      workspaceId: "workspace-1",
      role: "administrator",
      status: "active",
      propertyAccess: { type: "selected", propertyIds: ["property-1"] },
    };
    state.flags = {
      workspace: true,
      readOnly: false,
      authoring: true,
      approvals: true,
      runControls: true,
      templates: true,
    };
    state.transitionResult = { ok: true, value: {} };
    state.transitionCalls = [];
    state.decideApprovalResult = { ok: true, value: {} };
    state.decideApprovalCalls = [];
    state.cancelResult = { ok: true, value: {} };
    state.cancelCalls = [];
    state.approval = {
      id: "approval-1",
      tenantId: "workspace-1",
      runId: "run-1",
      version: 2,
    };
    state.run = { id: "run-1", tenantId: "workspace-1", version: 5 };
  });
  afterEach(() => vi.clearAllMocks());

  describe("already-working definition transitions (regression)", () => {
    it("still dispatches submit-review/activate/pause/resume/retire through the foundation service", async () => {
      for (const command of [
        "submit-review",
        "activate",
        "pause",
        "resume",
        "retire",
      ]) {
        state.transitionCalls = [];
        const result = await submit({
          command,
          idempotencyKey: `au001d:${command}:automation-1:v3`,
        });
        expect(result).toEqual({ ok: true });
        expect(state.transitionCalls).toHaveLength(1);
      }
    });
    it("revalidates the automations paths on success", async () => {
      await submit();
      expect(revalidatePath).toHaveBeenCalledWith("/dashboard/automations");
      expect(revalidatePath).toHaveBeenCalledWith(
        "/dashboard/automations/definitions/automation-1",
      );
    });
    it("surfaces the foundation service's failure message instead of silently no-oping", async () => {
      state.transitionResult = {
        ok: false,
        code: "AUTOMATION_VERSION_CONFLICT",
        message: "Automation changed after it was loaded.",
      };
      const result = await submit();
      expect(result).toEqual({
        ok: false,
        message: "Automation changed after it was loaded.",
      });
    });
    it("gates definition transitions on the authoring flag", async () => {
      state.flags = { ...state.flags, authoring: false };
      const result = await submit();
      expect(result.ok).toBe(false);
      expect(state.transitionCalls).toHaveLength(0);
    });
  });

  describe("approval commands (previously silently dead)", () => {
    it("dispatches approve to decideApproval with the run's current version, not a stale client-supplied one", async () => {
      const result = await submit({
        command: "approve",
        targetId: "approval-1",
        expectedVersion: "2",
        idempotencyKey: "au001d:approve:approval-1:v2",
      });
      expect(result).toEqual({ ok: true });
      expect(state.decideApprovalCalls).toHaveLength(1);
      expect(state.decideApprovalCalls[0]).toMatchObject({
        tenantId: "workspace-1",
        approvalId: "approval-1",
        expectedApprovalVersion: 2,
        expectedRunVersion: 5,
        disposition: "approve",
      });
    });
    it.each([
      ["reject", "reject"],
      ["defer", "defer"],
      ["request-revision", "request_revision"],
    ])("maps command %s to disposition %s", async (command, disposition) => {
      await submit({
        command,
        targetId: "approval-1",
        expectedVersion: "2",
        idempotencyKey: `au001d:${command}:approval-1:v2`,
        reason: "Needs more context",
      });
      expect(state.decideApprovalCalls[0]).toMatchObject({ disposition });
    });
    it("returns an error instead of silently no-oping when the approval no longer exists", async () => {
      state.approval = null;
      const result = await submit({
        command: "approve",
        targetId: "approval-1",
        expectedVersion: "2",
        idempotencyKey: "au001d:approve:approval-1:v2",
      });
      expect(result).toEqual({
        ok: false,
        message: "The approval request was not found.",
      });
      expect(state.decideApprovalCalls).toHaveLength(0);
    });
    it("surfaces the governed execution service's failure message", async () => {
      state.decideApprovalResult = {
        ok: false,
        code: "APPROVAL_EXPIRED",
        message: "The approval is no longer actionable.",
      };
      const result = await submit({
        command: "approve",
        targetId: "approval-1",
        expectedVersion: "2",
        idempotencyKey: "au001d:approve:approval-1:v2",
      });
      expect(result).toEqual({
        ok: false,
        message: "The approval is no longer actionable.",
      });
    });
    it("is gated on the approvals flag and never reaches decideApproval when disabled", async () => {
      state.flags = { ...state.flags, approvals: false };
      const result = await submit({
        command: "approve",
        targetId: "approval-1",
        expectedVersion: "2",
        idempotencyKey: "au001d:approve:approval-1:v2",
      });
      expect(result.ok).toBe(false);
      expect(state.decideApprovalCalls).toHaveLength(0);
    });
    it("revalidates the approval, run, and workspace paths on success", async () => {
      await submit({
        command: "approve",
        targetId: "approval-1",
        expectedVersion: "2",
        idempotencyKey: "au001d:approve:approval-1:v2",
      });
      expect(revalidatePath).toHaveBeenCalledWith(
        "/dashboard/automations/approvals/approval-1",
      );
      expect(revalidatePath).toHaveBeenCalledWith(
        "/dashboard/automations/runs/run-1",
      );
    });
  });

  describe("cancel command (previously silently dead)", () => {
    it("dispatches to requestCancellation with the run id and reason", async () => {
      const result = await submit({
        command: "cancel",
        targetId: "run-1",
        expectedVersion: "5",
        idempotencyKey: "au001d:cancel:run-1:v5",
        reason: "Duplicate run",
      });
      expect(result).toEqual({ ok: true });
      expect(state.cancelCalls).toHaveLength(1);
      expect(state.cancelCalls[0]).toMatchObject({
        tenantId: "workspace-1",
        runId: "run-1",
        expectedRunVersion: 5,
        reason: "Duplicate run",
      });
    });
    it("is gated on the runControls flag and never reaches requestCancellation when disabled", async () => {
      state.flags = { ...state.flags, runControls: false };
      const result = await submit({
        command: "cancel",
        targetId: "run-1",
        expectedVersion: "5",
        idempotencyKey: "au001d:cancel:run-1:v5",
        reason: "Duplicate run",
      });
      expect(result.ok).toBe(false);
      expect(state.cancelCalls).toHaveLength(0);
    });
    it("surfaces the governed execution service's failure message instead of silently no-oping", async () => {
      state.cancelResult = {
        ok: false,
        code: "CONCURRENT_MODIFICATION",
        message: "The automation run changed concurrently.",
      };
      const result = await submit({
        command: "cancel",
        targetId: "run-1",
        expectedVersion: "5",
        idempotencyKey: "au001d:cancel:run-1:v5",
        reason: "Duplicate run",
      });
      expect(result).toEqual({
        ok: false,
        message: "The automation run changed concurrently.",
      });
    });
  });

  describe("unrecognized or disabled commands", () => {
    it("returns an explicit error for a command with no dispatch mapping, instead of silently no-oping", async () => {
      const result = await submit({
        command: "retry",
        idempotencyKey: "au001d:retry:automation-1:v3",
      });
      expect(result).toEqual({
        ok: false,
        message: "This command is not recognized.",
      });
    });
    it("returns an explicit error when the workspace is disabled", async () => {
      state.flags = { ...state.flags, workspace: false };
      const result = await submit();
      expect(result.ok).toBe(false);
    });
    it("returns an explicit error when the idempotency key is malformed", async () => {
      const result = await submit({ idempotencyKey: "not-a-valid-key" });
      expect(result.ok).toBe(false);
    });
    it("returns an explicit error when workspace access cannot be verified", async () => {
      state.access = { ...state.access, status: "revoked" };
      const result = await submit();
      expect(result.ok).toBe(false);
    });
  });
});
