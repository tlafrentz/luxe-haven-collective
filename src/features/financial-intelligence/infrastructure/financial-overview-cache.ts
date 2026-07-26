import type { FinancialOverview, FinancialOverviewCache } from "../application";

export class InMemoryFinancialOverviewCache implements FinancialOverviewCache {
  private readonly values = new Map<string, FinancialOverview>();
  async get(key: string) { return this.values.get(key) ?? null; }
  async put(key: string, value: FinancialOverview) { this.values.set(key, value); }
  async invalidate(input: Readonly<{ workspaceId: string; from?: string; reason: "backdated-entry" | "reclassification" | "source-sync" | "plan-update" | "permission-change" }>) {
    for (const [key, overview] of this.values) {
      if (overview.identity.workspaceId !== input.workspaceId) continue;
      if (!input.from || overview.period.to >= input.from) this.values.delete(key);
    }
  }
  size() { return this.values.size; }
}
