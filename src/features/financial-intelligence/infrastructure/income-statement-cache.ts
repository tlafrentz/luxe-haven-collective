import type { IncomeStatement, IncomeStatementCache } from "../application";

export class InMemoryIncomeStatementCache implements IncomeStatementCache {
  private readonly values = new Map<string, IncomeStatement>();
  async get(key: string) { return this.values.get(key) ?? null; }
  async put(key: string, value: IncomeStatement) { this.values.set(key, value); }
  async invalidate(input: Readonly<{ workspaceId: string; from?: string; reason: "backdated-entry" | "reclassification" | "source-sync" | "permission-change" }>) {
    for (const [key, statement] of this.values) {
      if (statement.identity.workspaceId === input.workspaceId && (!input.from || statement.period.to >= input.from)) this.values.delete(key);
    }
  }
  size() { return this.values.size; }
}
