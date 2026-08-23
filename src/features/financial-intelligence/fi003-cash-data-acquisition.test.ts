import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
describe("FI-003 canonical cash data acquisition", () => {
  it("persists manual and CSV balances through one immutable observation model", () => {
    const migration = source(
        "supabase/migrations/20260822130000_fi003_cash_data_acquisition.sql",
      ),
      actions = source("src/app/actions/cash-data-acquisition.ts");
    expect(migration).toContain("cash_balance_observations");
    expect(migration).toContain("unique(workspace_id,idempotency_key)");
    expect(actions).toContain('rpc("record_manual_cash_balance"');
    expect(actions).toContain('source_type: "csv"');
    expect(actions).toContain('from("cash_balance_observations")');
  });
  it("keeps manual entry and CSV import inside Cash Flow", () => {
    const view = source(
        "src/features/financial-intelligence/presentation/cash-flow-liquidity.tsx",
      ),
      acquisition = source(
        "src/features/financial-intelligence/presentation/cash-data-acquisition.tsx",
      );
    expect(view).toContain("<CashDataAcquisition");
    expect(acquisition).toContain("Enter Cash Balance");
    expect(acquisition).toContain("Import Financial Data");
    expect(acquisition).not.toContain("/dashboard/settings");
    expect(acquisition).not.toContain("connected-systems");
  });
  it("feeds the same canonical records to Cash Flow and Forecast", () => {
    const cash = source("src/app/actions/cash-flow-liquidity-runtime.ts"),
      financial = source(
        "src/features/financial-intelligence/infrastructure/supabase-financial-overview-source.ts",
      );
    expect(cash).toContain("SupabaseCashBalanceReader");
    expect(cash).toContain("SupabaseCashTransactionReader");
    expect(financial).toContain('from("cash_balance_observations")');
    expect(financial).toContain('category:"cash-balance"');
  });
  it("keeps bank sync capability-gated and provides a Cash Flow return target", () => {
    const view = source(
      "src/features/financial-intelligence/presentation/cash-flow-liquidity.tsx",
    );
    expect(view).toMatch(
      /Bank sync will appear only when a supported\s+provider is enabled\./,
    );
    expect(view).toContain(
      "returnTo=%2Fdashboard%2Fobserve%2Ffinancial%2Fcash-flow",
    );
  });
  it("closes both acquisition drawers explicitly without submitting their server-action forms", () => {
    const acquisition = source(
      "src/features/financial-intelligence/presentation/cash-data-acquisition.tsx",
    );
    expect(acquisition).not.toContain('formMethod="dialog"');
    expect(acquisition.match(/ref\.current\?\.close\(\)/g)).toHaveLength(2);
    expect(acquisition.match(/type="button" onClick=\{close\}/g)).toHaveLength(
      4,
    );
  });
  it("writes manual account and balance atomically and idempotently", () => {
    const action = source("src/app/actions/cash-data-acquisition.ts"),
      migration = source(
        "supabase/migrations/20260823013000_fi003a1_manual_cash_balance_boundary.sql",
      );
    expect(action).toContain('rpc("record_manual_cash_balance"');
    expect(migration).toContain("on conflict(workspace_id,code) do update");
    expect(migration).toContain(
      "observation.idempotency_key = p_idempotency_key",
    );
  });
  it("uses current observations for cash position and explains balance-only coverage", () => {
    const adapter = source(
        "src/features/financial-intelligence/infrastructure/cash-flow-projection-adapter.ts",
      ),
      reader = source(
        "src/features/financial-intelligence/infrastructure/supabase-cash-data-source.ts",
      ),
      view = source(
        "src/features/financial-intelligence/presentation/cash-flow-liquidity.tsx",
      );
    expect(adapter).toMatch(/asOf:\s*evaluatedAt\.slice\(0, 10\)/);
    expect(reader).toMatch(/input\.asOf\s*\?\?\s*input\.period\.to/);
    expect(view).toMatch(/Cash-flow history is not yet available/);
  });
});
