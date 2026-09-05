import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ACTOR_ID = "actor-1";
const WORKSPACE_ID = "workspace-1";
const OPPORTUNITY_ID = "investment-opportunity-test-1";
const IDEMPOTENCY_KEY = "11111111-1111-4111-8111-111111111111";
const ANALYSIS_ID = "opportunity-analysis-test-1";

const state = vi.hoisted(() => ({
  authenticated: true,
  role: "owner" as string,
  status: "active" as string,
  propertyId: null as string | null,
  opportunity: {
    workspace_id: "workspace-1",
    property_id: null as string | null,
    archived_at: null as string | null,
  } as Record<string, unknown> | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.authenticated ? { id: ACTOR_ID } : null },
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "investment_opportunities"
              ? { data: state.opportunity, error: null }
              : { data: null, error: null },
        }),
      }),
    }),
  }),
}));
vi.mock("@/features/workspace", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/workspace")>();
  return {
    ...actual,
    resolveWorkspaceAccessContext: async () => ({
      profileId: ACTOR_ID,
      workspaceId: WORKSPACE_ID,
      ownerId: WORKSPACE_ID,
      role: state.role,
      status: state.status,
      permissions: actual.permissionsForRole(state.role as import("@/features/workspace").WorkspaceRole),
      propertyAccess: state.propertyId
        ? { type: "selected" as const, propertyIds: [state.propertyId] }
        : { type: "all" as const },
    }),
    SupabaseTeamAccessRepository: class {},
  };
});

import { createProductionAcquisitionServerCommandBoundary } from "./acquisition-workspace-command-runtime";

function activateCommand(overrides: Partial<{ opportunityId: string }> = {}) {
  return {
    commandType: "activate-pipeline" as const,
    envelope: {
      opportunityId: overrides.opportunityId ?? OPPORTUNITY_ID,
      expectedOpportunityVersion: 1,
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    analysisId: ANALYSIS_ID,
    analysisVersion: 1,
    route: "purchase" as const,
  };
}

describe("PA-004-followup acquisition command boundary authorization", () => {
  beforeEach(() => {
    state.authenticated = true;
    state.role = "owner";
    state.status = "active";
    state.propertyId = null;
    state.opportunity = {
      workspace_id: WORKSPACE_ID,
      property_id: null,
      archived_at: null,
    };
  });
  afterEach(() => vi.restoreAllMocks());

  it("fails closed as not-authenticated when there is no session", async () => {
    state.authenticated = false;
    const result = await createProductionAcquisitionServerCommandBoundary().execute(
      activateCommand(),
    );
    expect(result).toMatchObject({ code: "ACQUISITION_COMMAND_NOT_AUTHENTICATED" });
  });

  it("fails closed when the target opportunity does not exist", async () => {
    state.opportunity = null;
    const result = await createProductionAcquisitionServerCommandBoundary().execute(
      activateCommand(),
    );
    expect(result.status).not.toBe("succeeded");
    expect(result).toMatchObject({ code: "ACQUISITION_COMMAND_NOT_AUTHORIZED" });
  });

  it("fails closed for a cross-tenant opportunity (different workspace)", async () => {
    state.opportunity = {
      workspace_id: "some-other-workspace",
      property_id: null,
      archived_at: null,
    };
    const result = await createProductionAcquisitionServerCommandBoundary().execute(
      activateCommand(),
    );
    expect(result).toMatchObject({ code: "ACQUISITION_COMMAND_NOT_AUTHORIZED" });
  });

  it("fails closed for a same-workspace actor without manage authority (viewer)", async () => {
    state.role = "viewer";
    const result = await createProductionAcquisitionServerCommandBoundary().execute(
      activateCommand(),
    );
    expect(result).toMatchObject({ code: "ACQUISITION_COMMAND_NOT_AUTHORIZED" });
  });

  it.each(["owner", "administrator"])(
    "clears authorization for a %s in the opportunity's own workspace (still unavailable behind the fail-closed deployment registry)",
    async (role) => {
      state.role = role;
      const result = await createProductionAcquisitionServerCommandBoundary().execute(
        activateCommand(),
      );
      // The deployment registry marks every acquisition command
      // "not-verified" today, so a request that clears authorization still
      // can't succeed -- but it must fail for THAT reason, not
      // NOT_AUTHORIZED, proving the broken tautological check is gone.
      expect(result).toMatchObject({ code: "ACQUISITION_COMMAND_NOT_VERIFIED" });
    },
  );

  it.each(["operator", "contributor"])(
    "clears authorization for a %s with access to the opportunity's property (still unavailable behind the fail-closed deployment registry)",
    async (role) => {
      state.role = role;
      state.propertyId = "property-allowed";
      state.opportunity = {
        workspace_id: WORKSPACE_ID,
        property_id: "property-allowed",
        archived_at: null,
      };
      const result = await createProductionAcquisitionServerCommandBoundary().execute(
        activateCommand(),
      );
      expect(result).toMatchObject({ code: "ACQUISITION_COMMAND_NOT_VERIFIED" });
    },
  );

  it("respects property-scoped access for an operator without access to this opportunity's property", async () => {
    state.role = "operator";
    state.propertyId = "property-allowed";
    state.opportunity = {
      workspace_id: WORKSPACE_ID,
      property_id: "property-different",
      archived_at: null,
    };
    const result = await createProductionAcquisitionServerCommandBoundary().execute(
      activateCommand(),
    );
    expect(result).toMatchObject({ code: "ACQUISITION_COMMAND_NOT_AUTHORIZED" });
  });
});
