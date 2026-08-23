import { Money } from "@/platform/kernel";
import { createClient } from "@/lib/supabase/server";
import type {
  CashAccountBalanceReader,
  CashTransactionReader,
} from "./cash-flow-projection-adapter";
import type { CashAccountBalance } from "../application";

type Account = Readonly<{
  id: string;
  workspace_id: string;
  name: string;
  account_type: string | null;
  source_type: string;
  active: boolean;
}>;
type Balance = Readonly<{
  id: string;
  account_id: string;
  property_id: string | null;
  amount_minor: number;
  currency: string;
  as_of: string;
  source_type: string;
  recorded_at: string;
}>;
type Transaction = Readonly<{
  id: string;
  workspace_id: string;
  account_id: string;
  property_id: string | null;
  amount_minor: number;
  currency: string;
  effective_date: string;
  direction: string | null;
  description: string | null;
  import_category: string | null;
  source_provider: string;
  evidence_ids: string[];
}>;

class SupabaseCashDataStore {
  async balances(input: Parameters<CashAccountBalanceReader["read"]>[0]) {
    const client = await createClient();
    let accountsQuery = client
      .from("financial_accounts")
      .select("id,workspace_id,name,account_type,source_type,active")
      .eq("workspace_id", input.workspaceId)
      .eq("active", true)
      .in("category", ["asset", "reserve"]);
    if (input.requestedAccountIds?.length)
      accountsQuery = accountsQuery.in("id", [...input.requestedAccountIds]);
    const { data: accounts, error: accountError } = await accountsQuery;
    if (accountError) throw accountError;
    const ids = (accounts ?? []).map((x) => String(x.id));
    if (!ids.length) return [];
    const { data: observations, error } = await client
      .from("cash_balance_observations")
      .select(
        "id,account_id,property_id,amount_minor,currency,as_of,source_type,recorded_at",
      )
      .eq("workspace_id", input.workspaceId)
      .in("account_id", ids)
      .lte("as_of", input.asOf ?? input.period.to)
      .order("as_of", { ascending: false })
      .order("recorded_at", { ascending: false });
    if (error) throw error;
    const latest = new Map<string, Balance>();
    for (const row of (observations ?? []) as Balance[])
      if (!latest.has(row.account_id)) latest.set(row.account_id, row);
    return ((accounts ?? []) as Account[]).flatMap((account) => {
      const balance = latest.get(account.id);
      if (!balance) return [];
      const type: CashAccountBalance["type"] =
        account.account_type === "reserve"
          ? "reserve"
          : account.account_type === "tax"
            ? "tax"
            : account.account_type === "other-cash"
              ? "other"
              : "operating";
      return [
        {
          id: account.id,
          workspaceId: account.workspace_id,
          ...(balance.property_id ? { propertyId: balance.property_id } : {}),
          label: account.name,
          type,
          sourceLabel: balance.source_type,
          currency: balance.currency,
          closingBalance: Money.fromMinorUnits(
            Number(balance.amount_minor),
            balance.currency,
          ),
          restriction:
            type === "reserve" ? ("reserved" as const) : ("available" as const),
          restrictionsComplete: true,
          closingAsOf: balance.as_of,
          status: "current" as const,
          reconciliation: "not-applicable" as const,
          confidence: "high" as const,
          freshness: "current" as const,
          evidenceIds: Object.freeze([`cash-balance:${balance.id}`]),
        },
      ] satisfies CashAccountBalance[];
    });
  }
  async movements(input: Parameters<CashTransactionReader["read"]>[0]) {
    if (!input.accountIds.length) return [];
    const client = await createClient();
    const { data, error } = await client
      .from("financial_transactions")
      .select(
        "id,workspace_id,account_id,property_id,amount_minor,currency,effective_date,direction,description,import_category,source_provider,evidence_ids",
      )
      .eq("workspace_id", input.workspaceId)
      .in("account_id", [...input.accountIds])
      .neq("status", "voided")
      .gte("effective_date", input.period.from)
      .lte("effective_date", input.period.to);
    if (error) throw error;
    return ((data ?? []) as Transaction[]).map((row) => {
      const direction =
          row.direction ??
          (Number(row.amount_minor) < 0 ? "outflow" : "inflow"),
        amount = Math.abs(Number(row.amount_minor));
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        accountId: row.account_id,
        ...(row.property_id ? { propertyId: row.property_id } : {}),
        amount: Money.fromMinorUnits(amount, row.currency),
        direction: direction as "inflow" | "outflow",
        activity: "operating" as const,
        classification:
          direction === "inflow"
            ? ("economic-inflow" as const)
            : ("economic-outflow" as const),
        category: row.import_category ?? row.description ?? "uncategorized",
        occurredAt: row.effective_date,
        recurring: "unknown" as const,
        allocated: Boolean(row.property_id),
        qualification: "measured" as const,
        confidence: "high" as const,
        freshness: "current" as const,
        evidenceIds: Object.freeze(
          row.evidence_ids ?? [`financial-transaction:${row.id}`],
        ),
      };
    });
  }
}
const store = new SupabaseCashDataStore();
export class SupabaseCashBalanceReader implements CashAccountBalanceReader {
  read(input: Parameters<CashAccountBalanceReader["read"]>[0]) {
    return store.balances(input);
  }
}
export class SupabaseCashTransactionReader implements CashTransactionReader {
  read(input: Parameters<CashTransactionReader["read"]>[0]) {
    return store.movements(input);
  }
}
