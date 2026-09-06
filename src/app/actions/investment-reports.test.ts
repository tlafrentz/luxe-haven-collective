import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  reportRow: {
    id: "report-1",
    owner_profile_id: "user-1",
    opportunity_id: "investment-opportunity-1",
    analysis_version_id: "analysis-1",
    status: "generated",
    title: "Test Report",
    acquisition_strategy: "purchase",
    generated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    projection_snapshot: {},
  } as Record<string, unknown> | null,
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  rpcError: null as { message: string } | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/investment-reports", () => ({
  buildInvestmentReportView: (record: unknown) => record,
  buildInvestmentReportSnapshot: () => ({}),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.userId ? { id: state.userId } : null } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () =>
                table === "generated_reports"
                  ? { data: state.reportRow, error: null }
                  : { data: null, error: null },
            }),
          }),
        }),
      }),
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      return { data: null, error: state.rpcError };
    },
  }),
}));

import { transitionInvestmentReportAction } from "./investment-reports";

function formData(operation = "archive") {
  const data = new FormData();
  data.set("reportId", "report-1");
  data.set("operation", operation);
  return data;
}

describe("transitionInvestmentReportAction", () => {
  beforeEach(() => {
    state.userId = "user-1";
    state.reportRow = {
      id: "report-1",
      owner_profile_id: "user-1",
      opportunity_id: "investment-opportunity-1",
      analysis_version_id: "analysis-1",
      status: "generated",
      title: "Test Report",
      acquisition_strategy: "purchase",
      generated_at: "2026-01-01T00:00:00.000Z",
      archived_at: null,
      projection_snapshot: {},
    };
    state.rpcCalls = [];
    state.rpcError = null;
  });
  afterEach(() => vi.restoreAllMocks());

  it("checks report ownership before calling the RPC (previously had no ownership check at all)", async () => {
    await expect(transitionInvestmentReportAction(formData())).rejects.toThrow(
      "REDIRECT:/dashboard/reports",
    );
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0]).toMatchObject({
      name: "transition_investment_report_v1",
      args: { p_report_id: "report-1", p_operation: "archive" },
    });
  });

  it("fails closed without calling the RPC when the report is not found or not owned by the caller", async () => {
    state.reportRow = null;
    await expect(transitionInvestmentReportAction(formData())).rejects.toThrow(
      "REDIRECT:/dashboard/reports?error=not-found",
    );
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("fails closed without calling the RPC when unauthenticated", async () => {
    state.userId = null;
    await expect(transitionInvestmentReportAction(formData())).rejects.toThrow(
      "REDIRECT:/dashboard/reports?error=not-found",
    );
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("still rejects an invalid operation before any lookup", async () => {
    await expect(
      transitionInvestmentReportAction(formData("delete")),
    ).rejects.toThrow("REDIRECT:/dashboard/reports?error=invalid-transition");
    expect(state.rpcCalls).toHaveLength(0);
  });
});
