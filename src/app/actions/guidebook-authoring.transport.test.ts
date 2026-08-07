import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  authenticated: false,
  propertyAllowed: false,
  analytics: "zero" as "zero" | "nonzero" | "unavailable",
  propertyRpcCalls: [] as Array<{
    name: string;
    args: Record<string, unknown>;
  }>,
  propertyRpcError: null as Error | null,
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
vi.mock("@/features/workspace", () => ({
  evaluateWorkspacePermission: () => true,
  evaluatePropertyAccess: () => state.propertyAllowed,
  resolveWorkspaceAccessContext: async () => ({
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
    state.analytics = "zero";
    state.propertyRpcCalls.length = 0;
    state.propertyRpcError = null;
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
