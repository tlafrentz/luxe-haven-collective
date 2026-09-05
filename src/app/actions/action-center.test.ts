import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function fakeAction() {
  return {
    id: { value: "action-1" },
    version: { value: 1 },
    title: "Test action",
    status: "draft",
    priority: "normal",
    owner: { type: "user", id: "actor-a" },
    scheduleValue: { due: undefined },
    sources: [
      {
        type: "manual",
        capability: "test",
        recordedAt: new Date(),
        recordedBy: { type: "user", id: "actor-a" },
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const state = vi.hoisted(() => ({
  canManage: false,
  provider: {} as Record<string, (...args: unknown[]) => unknown>,
  controls: {} as Record<string, (...args: unknown[]) => unknown>,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("./action-center-runtime", () => ({
  getActionCenterRequestContext: async () => ({
    ok: true as const,
    client: {},
    workspaceId: "workspace-1",
    viewer: {
      actor: { type: "user" as const, id: "actor-a" },
      canManage: state.canManage,
    },
  }),
  createPlatformActionProvider: () => state.provider,
}));

vi.mock("./execute-runtime", () => ({
  composeExecuteRuntime: async () => ({
    ok: true as const,
    runtime: {
      workspaceId: "workspace-1",
      actor: { type: "user" as const, id: "actor-a" },
      controls: state.controls,
    },
  }),
}));

import { mutateActionCenterAction } from "./action-center";

const UNCONTROLLED_OPERATIONS = ["commit", "mark-ready", "cancel", "archive"] as const;
const PROVIDER_METHOD_FOR_OPERATION: Record<
  (typeof UNCONTROLLED_OPERATIONS)[number],
  string
> = {
  commit: "commit",
  "mark-ready": "markReady",
  cancel: "cancel",
  archive: "archive",
};

describe("mutateActionCenterAction permission gating", () => {
  beforeEach(() => {
    state.canManage = false;
    state.provider = {
      commit: vi.fn(async () => fakeAction()),
      markReady: vi.fn(async () => fakeAction()),
      cancel: vi.fn(async () => fakeAction()),
      archive: vi.fn(async () => fakeAction()),
    };
    state.controls = {
      transition: vi.fn(async () => ({ ok: true, value: { action: fakeAction() } })),
      addBlocker: vi.fn(async () => ({ ok: true, value: { action: fakeAction() } })),
      resume: vi.fn(async () => ({ ok: true, value: { action: fakeAction() } })),
    };
  });
  afterEach(() => vi.restoreAllMocks());

  for (const operation of UNCONTROLLED_OPERATIONS) {
    it(`rejects ${operation} for a viewer without canManage`, async () => {
      state.canManage = false;
      const result = await mutateActionCenterAction({
        actionId: "action-1",
        expectedVersion: 1,
        operation,
      });
      expect(result).toEqual({
        ok: false,
        code: "forbidden",
        message: "You do not have permission to change actions in this workspace.",
      });
      const method = state.provider[PROVIDER_METHOD_FOR_OPERATION[operation]];
      expect(method).not.toHaveBeenCalled();
    });

    it(`allows ${operation} for a viewer with canManage`, async () => {
      state.canManage = true;
      const result = await mutateActionCenterAction({
        actionId: "action-1",
        expectedVersion: 1,
        operation,
      });
      expect(result.ok).toBe(true);
      const method = state.provider[PROVIDER_METHOD_FOR_OPERATION[operation]];
      expect(method).toHaveBeenCalledTimes(1);
    });
  }

  it("still routes a controlled operation (start) through executeControlled regardless of canManage", async () => {
    state.canManage = false;
    const result = await mutateActionCenterAction({
      actionId: "action-1",
      expectedVersion: 1,
      operation: "start",
    });
    expect(result.ok).toBe(true);
    expect(state.controls.transition).toHaveBeenCalledTimes(1);
  });
});
