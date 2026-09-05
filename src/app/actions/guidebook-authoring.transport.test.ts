import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  authenticated: false,
  propertyAllowed: false,
  legacyAllowed: true,
  privilegeAllowed: false,
  analytics: "zero" as "zero" | "nonzero" | "unavailable",
  propertyRpcCalls: [] as Array<{
    name: string;
    args: Record<string, unknown>;
  }>,
  propertyRpcError: null as Error | null,
  platformRpcCalls: [] as Array<{
    name: string;
    args: Record<string, unknown>;
  }>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getSessionProfile: async () => ({
    user: state.authenticated ? { id: "actor-a" } : null,
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.propertyRpcCalls.push({ name, args });
      return state.propertyRpcError
        ? { data: null, error: state.propertyRpcError }
        : {
            data: [{ property_id: "property-a", duplicate_property_id: null }],
            error: null,
          };
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.platformRpcCalls.push({ name, args });
      return {
        data: [
          {
            allowed: state.privilegeAllowed,
            reason_code: state.privilegeAllowed
              ? "PA_ALLOW"
              : "PA_DENY_NO_GRANT",
            matching_assignment_ids: [],
          },
        ],
        error: null,
      };
    },
    from: () => ({
      upsert: () => ({ error: null }),
    }),
  }),
}));
vi.mock("@/features/workspace", () => ({
  evaluateWorkspacePermission: () => state.legacyAllowed,
  evaluatePropertyAccess: () => state.propertyAllowed,
  resolveWorkspaceAccessContext: async () => ({
    profileId: "actor-a",
    workspaceId: "owner-a",
    ownerId: "owner-a",
  }),
  SupabaseTeamAccessRepository: class {},
}));
vi.mock("@/features/guidebook-studio", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/guidebook-studio")>();
  return {
    ...actual,
    SupabaseGuidebookDraftRepository: class {
      async load() {
        return {
          guidebookId: "foreign-guidebook",
          workspaceId: "owner-a",
          propertyId: "foreign-property",
          schemaVersion: "guidebook-draft.v1",
          revision: 9,
          title: "Private title",
          description: "Private content",
          persistedAt: "2026-07-31T00:00:00.000Z",
          persistedBy: "foreign-owner",
          sections: [],
        };
      }
    },
    SupabaseGuidebookCommandReceiptRepository: class {},
    SupabaseGuidebookPropertyProjectionRepository: class {},
    SupabasePublishedGuidebookVersionRepository: class {},
    SupabaseGuidebookAnalyticsRepository: class {
      async summary() {
        if (state.analytics === "unavailable")
          throw Object.assign(new Error("raw analytics"), {
            code: "ANALYTICS_UNAVAILABLE",
          });
        return state.analytics === "zero"
          ? { events: [], uniqueVisitors: 0, viewsByDay: [] }
          : {
              events: [{ eventType: "view", count: 2 }],
              uniqueVisitors: 1,
              viewsByDay: [],
            };
      }
    },
    SupabaseGuidebookAuthoringObserver: class {
      record() {}
    },
  };
});
import {
  createGuidebookPropertyAction,
  guidebookAuthoringCommandAction,
  loadGuidebookAnalyticsSummaryAction,
  publishCanonicalGuidebookAction,
} from "./guidebook-authoring";
const command = {
  workspaceId: "owner-a",
  guidebookId: "foreign-guidebook",
  expectedRevision: 9,
  commandId: "command",
  command: { type: "create-section" as const, name: "Arrival" },
};
const safe = (result: unknown) => {
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    "foreign-guidebook",
    "foreign-property",
    "Private title",
    "Private content",
    "foreign-owner",
    "revision",
    "receipt",
    "analytics",
  ])
    expect(serialized).not.toContain(forbidden);
};
describe("GB-001B.3 direct authoring transport authorization", () => {
  const warnings: unknown[][] = [];
  beforeEach(() => {
    state.authenticated = false;
    state.propertyAllowed = false;
    state.legacyAllowed = true;
    state.privilegeAllowed = false;
    state.analytics = "zero";
    state.propertyRpcCalls.length = 0;
    state.propertyRpcError = null;
    state.platformRpcCalls.length = 0;
    warnings.length = 0;
    vi.spyOn(console, "warn").mockImplementation((...args) => {
      warnings.push(args);
    });
  });
  afterEach(() => vi.restoreAllMocks());
  it("fails closed for anonymous authoring, publication, and analytics", async () => {
    for (const result of [
      await guidebookAuthoringCommandAction(command),
      await publishCanonicalGuidebookAction(command),
      await loadGuidebookAnalyticsSummaryAction({
        workspaceId: "owner-a",
        guidebookId: "foreign-guidebook",
      }),
    ]) {
      expect(result).toMatchObject({
        ok: false,
        code: "GUIDEBOOK_UNAUTHORIZED",
      });
      safe(result);
    }
  });
  it("fails closed without existence disclosure for another owner", async () => {
    state.authenticated = true;
    for (const result of [
      await guidebookAuthoringCommandAction(command),
      await publishCanonicalGuidebookAction(command),
      await loadGuidebookAnalyticsSummaryAction({
        workspaceId: "owner-a",
        guidebookId: "foreign-guidebook",
      }),
    ]) {
      expect(result).toMatchObject({
        ok: false,
        code: "GUIDEBOOK_UNAUTHORIZED",
      });
      safe(result);
    }
  });
  it("returns owner-scoped confirmed-zero, nonzero, and unavailable analytics projections", async () => {
    state.authenticated = true;
    state.propertyAllowed = true;
    await expect(
      loadGuidebookAnalyticsSummaryAction({
        workspaceId: "owner-a",
        guidebookId: "foreign-guidebook",
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: { available: true, events: [] },
    });
    state.analytics = "nonzero";
    await expect(
      loadGuidebookAnalyticsSummaryAction({
        workspaceId: "owner-a",
        guidebookId: "foreign-guidebook",
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: { events: [{ eventType: "view", count: 2 }] },
    });
    state.analytics = "unavailable";
    await expect(
      loadGuidebookAnalyticsSummaryAction({
        workspaceId: "owner-a",
        guidebookId: "foreign-guidebook",
      }),
    ).resolves.toMatchObject({ ok: false, code: "ANALYTICS_UNAVAILABLE" });
  });
  it("emits sanitized entered and denied analytics transport observations", async () => {
    await loadGuidebookAnalyticsSummaryAction({
      workspaceId: "owner-a",
      guidebookId: "foreign-guidebook",
    });
    expect(
      warnings.map((call) => (call[1] as { outcome: string }).outcome),
    ).toEqual(["entered", "denied"]);
    const serialized = JSON.stringify(warnings);
    for (const forbidden of [
      "foreign-guidebook",
      "foreign-property",
      "Private title",
      "Private content",
      "publicSlug",
      "https://",
      "address",
      "phone",
      "snapshot",
    ])
      expect(serialized).not.toContain(forbidden);
  });
  it("creates guidebook-flow properties with the request-scoped authenticated client", async () => {
    state.authenticated = true;
    await expect(
      createGuidebookPropertyAction({
        workspaceId: "owner-a",
        name: "Mesa",
        address: "1248 S Vineyard Rd",
        city: "Mesa",
        state: "Arizona",
        postalCode: "85210",
        country: "US",
        propertyType: "apartment",
        timezone: "America/Phoenix",
        guestCapacity: 4,
        commandId: "property-command",
      }),
    ).resolves.toMatchObject({
      ok: true,
      property: { id: "property-a", name: "Mesa" },
    });
    expect(state.propertyRpcCalls).toHaveLength(1);
    expect(state.propertyRpcCalls[0]).toMatchObject({
      name: "create_guidebook_flow_property",
      args: { p_workspace_id: "owner-a", p_command_id: "property-command" },
    });
  });
});

describe("PA-003 additive privilege gating", () => {
  beforeEach(() => {
    state.authenticated = true;
    state.propertyAllowed = true;
    state.legacyAllowed = true;
    state.privilegeAllowed = false;
    state.analytics = "zero";
    state.platformRpcCalls.length = 0;
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps today's legacy-contributor access unchanged and never calls evaluate_privilege", async () => {
    state.legacyAllowed = true;
    await expect(
      loadGuidebookAnalyticsSummaryAction({
        workspaceId: "owner-a",
        guidebookId: "foreign-guidebook",
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(state.platformRpcCalls).toHaveLength(0);
  });

  it("lets a PA-001-only grant succeed where the legacy check alone would have failed", async () => {
    state.legacyAllowed = false;
    state.privilegeAllowed = true;
    await expect(
      loadGuidebookAnalyticsSummaryAction({
        workspaceId: "owner-a",
        guidebookId: "foreign-guidebook",
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(state.platformRpcCalls).toHaveLength(1);
    expect(state.platformRpcCalls[0]).toMatchObject({
      name: "evaluate_privilege",
      args: expect.objectContaining({
        p_privilege_id: "guidebooks.guidebook.view",
        p_workspace_id: "owner-a",
      }),
    });
  });

  it("fails closed when both the legacy check and the PA-001 grant deny", async () => {
    state.legacyAllowed = false;
    state.privilegeAllowed = false;
    await expect(
      loadGuidebookAnalyticsSummaryAction({
        workspaceId: "owner-a",
        guidebookId: "foreign-guidebook",
      }),
    ).resolves.toMatchObject({ ok: false, code: "GUIDEBOOK_UNAUTHORIZED" });
    expect(state.platformRpcCalls).toHaveLength(1);
  });
});
