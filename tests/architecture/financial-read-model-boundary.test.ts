import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("FI-001A financial boundary", () => {
  const domain = readFileSync(resolve("src/features/financial-intelligence/domain/model.ts"), "utf8");
  const application = readFileSync(resolve("src/features/financial-intelligence/application/services.ts"), "utf8");
  it("keeps the canonical domain independent of presentation and providers", () => {
    expect(domain).not.toMatch(/react|next\/|@supabase|presentation|dashboard|provider DTO/i);
    expect(application).not.toMatch(/@supabase|components|presentation|profit.?and.?loss|recommendation/i);
  });
  it("exposes one canonical read and snapshot boundary", () => {
    expect(domain).toContain("export type FinancialReadModel");
    expect(application).toContain("buildFinancialReadModel");
    expect(application).toContain("getFinancialSnapshot");
  });
});
