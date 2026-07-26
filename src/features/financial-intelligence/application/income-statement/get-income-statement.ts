import { buildIncomeStatement } from "./build-income-statement";
import type { BuildIncomeStatementInput, GetIncomeStatementQuery, IncomeStatement, IncomeStatementCache, IncomeStatementReader } from "./contracts";

export class IncomeStatementError extends Error {
  constructor(readonly code: "permission" | "currency" | "accounting_basis" | "data_quality" | "unavailable" | "unexpected", message: string) { super(message); this.name = "IncomeStatementError"; }
}
export function incomeStatementCacheKey(input: BuildIncomeStatementInput) {
  return ["income-statement", input.current.identity.workspaceId, input.scope.type, [...input.scope.propertyIds].sort().join(","),
    `${input.canViewRevenueDetail ? "revenue-detail" : "revenue-summary"}:${input.canViewExpenseDetail ? "expense-detail" : "expense-summary"}`,
    input.current.period.from, input.current.period.to, input.comparisonType ?? "none", input.current.identity.accountingMethod,
    input.current.identity.reportingCurrency, input.projectionVersion ?? "v1", input.current.evidence.sourceIds.join(",")].join("|");
}
export async function getIncomeStatement(reader: IncomeStatementReader, query: GetIncomeStatementQuery, cache?: IncomeStatementCache): Promise<IncomeStatement> {
  let input: BuildIncomeStatementInput;
  try { input = await reader.read(query); }
  catch (error) {
    if (error instanceof IncomeStatementError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (message.includes("CURRENCY")) throw new IncomeStatementError("currency", "Income Statement values use incompatible currencies.");
    if (message.includes("BASIS")) throw new IncomeStatementError("accounting_basis", "Income Statement periods use incompatible accounting bases.");
    if (/access|permission|Denied|Authentication/i.test(message)) throw new IncomeStatementError("permission", "Profitability access is not permitted.");
    throw new IncomeStatementError("unavailable", "Income Statement could not be completed from the available financial evidence.");
  }
  const key = incomeStatementCacheKey(input), cached = await cache?.get(key);
  if (cached) return cached;
  const statement = buildIncomeStatement(input);
  await cache?.put(key, statement);
  return statement;
}
export class GetIncomeStatement {
  constructor(private readonly reader: IncomeStatementReader, private readonly cache?: IncomeStatementCache) {}
  execute(query: GetIncomeStatementQuery) { return getIncomeStatement(this.reader, query, this.cache); }
}
export class BuildIncomeStatement {
  execute(input: BuildIncomeStatementInput) { return buildIncomeStatement(input); }
}
