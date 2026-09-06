import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  reportRow: { id: "report-1" } as Record<string, unknown> | null,
  shareRow: { id: "investment-report-share-old" } as Record<string, unknown> | null,
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  rpcResult: { data: null as unknown, error: null as { message: string } | null },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
          maybeSingle: async () =>
            table === "investment_report_shares"
              ? { data: state.shareRow, error: null }
              : { data: null, error: null },
        }),
      }),
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      return state.rpcResult;
    },
  }),
}));
vi.mock("./investment-reports", () => ({
  getInvestmentReport: async () => state.reportRow,
}));
vi.mock("@/features/investment-report-sharing", () => ({
  deriveShareStatus: () => "active",
  generateShareCredential: () => ({ digest: "digest", secret: "secret", entropyBits: 256 }),
  validateShareDuration: () => undefined,
}));

import {
  replaceInvestmentReportShareAction,
  revokeInvestmentReportShareAction,
} from "./investment-report-sharing";

describe("revokeInvestmentReportShareAction", () => {
  beforeEach(() => {
    state.userId = "user-1";
    state.reportRow = { id: "report-1" };
    state.rpcCalls = [];
    state.rpcResult = { data: null, error: null };
  });
  afterEach(() => vi.restoreAllMocks());

  it("checks report ownership before calling the RPC (previously had no ownership check at all)", async () => {
    const form = new FormData();
    form.set("shareId", "investment-report-share-1");
    form.set("reportId", "report-1");
    await revokeInvestmentReportShareAction(form);
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0]).toMatchObject({
      name: "revoke_investment_report_share_v1",
      args: { p_share_id: "investment-report-share-1" },
    });
  });

  it("does not call the RPC when the report is not found or not owned by the caller", async () => {
    state.reportRow = null;
    const form = new FormData();
    form.set("shareId", "investment-report-share-1");
    form.set("reportId", "report-1");
    await revokeInvestmentReportShareAction(form);
    expect(state.rpcCalls).toHaveLength(0);
  });
});

describe("replaceInvestmentReportShareAction", () => {
  beforeEach(() => {
    state.userId = "user-1";
    state.shareRow = { id: "investment-report-share-old" };
    state.rpcCalls = [];
    state.rpcResult = { data: { shareId: "investment-report-share-new", expiresAt: "2026-02-01T00:00:00.000Z" }, error: null };
  });
  afterEach(() => vi.restoreAllMocks());

  function form() {
    const data = new FormData();
    data.set("shareId", "investment-report-share-old");
    data.set("durationHours", "168");
    return data;
  }

  it("checks the old share is visible to the caller (RLS-scoped) before calling the RPC (previously had no ownership check at all)", async () => {
    const result = await replaceInvestmentReportShareAction({ ok: false, message: "" }, form());
    expect(result.ok).toBe(true);
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0]).toMatchObject({
      name: "replace_investment_report_share_v1",
      args: { p_old_share_id: "investment-report-share-old" },
    });
  });

  it("fails closed without calling the RPC when the old share is not found or not owned by the caller", async () => {
    state.shareRow = null;
    const result = await replaceInvestmentReportShareAction({ ok: false, message: "" }, form());
    expect(result).toEqual({ ok: false, message: "That share could not be found." });
    expect(state.rpcCalls).toHaveLength(0);
  });
});
