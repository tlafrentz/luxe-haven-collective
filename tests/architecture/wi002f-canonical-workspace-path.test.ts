import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("WI-002F active Investment Workspace path", () => {
  it("does not construct or select RentCast", () => {
    const action = read("src/app/actions/investment-workspace.ts");
    expect(action).not.toMatch(/RentCast|rentcast/);
  });

  it("coordinates canonical property and STR boundaries", () => {
    const runtime = read("src/features/market-intelligence/str/infrastructure/investment-market-context-runtime.ts");
    expect(runtime).toContain("createRealtyApiPropertyProvider");
    expect(runtime).toContain("AirRoiProvider");
    expect(runtime).toContain("SupabasePropertySnapshotRepository");
    expect(runtime).toContain("SupabaseStrMarketSnapshotRepository");
  });

  it("keeps provider adapters out of Investment Intelligence", () => {
    const action = read("src/app/actions/investment-workspace.ts");
    expect(action).not.toMatch(/infrastructure\/realtyapi|infrastructure\/airroi|RealtyApiClient|AirRoiClient/);
  });

  it("owner-scopes canonical property persistence", () => {
    const migration = read("supabase/migrations/20260730040000_wi002f_property_snapshot_scope.sql");
    expect(migration).toContain("owner_id");
    expect(migration).toContain("workspace_id");
    expect(migration).toContain("owner_id = auth.uid()");
  });
});
