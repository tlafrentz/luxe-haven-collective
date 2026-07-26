import type {
  BudgetRepository, ForecastRepository, GetFinancialSnapshotQuery, LedgerRepository, TransactionRepository,
} from "../application";
import type { Budget, FinancialPeriod, FinancialTransaction, Forecast, Ledger } from "../domain";

export class InMemoryLedgerRepository implements LedgerRepository {
  constructor(private ledger: Ledger) {}
  async getLedger(query: GetFinancialSnapshotQuery): Promise<Ledger> {
    if (query.workspaceId !== this.ledger.workspaceId) throw new Error("Ledger workspace mismatch.");
    return this.ledger;
  }
  replace(ledger: Ledger): void { this.ledger = ledger; }
}

export class InMemoryTransactionRepository implements TransactionRepository {
  constructor(private readonly transactions: readonly FinancialTransaction[]) {}
  async listTransactions(query: GetFinancialSnapshotQuery): Promise<readonly FinancialTransaction[]> {
    return this.transactions.filter(({ props }) =>
      props.workspaceId === query.workspaceId && (!query.propertyId || props.propertyId === query.propertyId) &&
      (!query.propertyIds || (props.propertyId ? query.propertyIds.includes(props.propertyId) : false)));
  }
}

export class InMemoryBudgetRepository implements BudgetRepository {
  constructor(private readonly budgets: readonly Budget[] = []) {}
  async getBudget(workspaceId: string, period: FinancialPeriod): Promise<Budget | null> {
    return this.budgets.find((budget) => budget.workspaceId === workspaceId && budget.period.from === period.from && budget.period.to === period.to) ?? null;
  }
}

export class InMemoryForecastRepository implements ForecastRepository {
  constructor(private readonly forecasts: readonly Forecast[] = []) {}
  async getForecast(workspaceId: string, period: FinancialPeriod, version?: number): Promise<Forecast | null> {
    return this.forecasts.find((forecast) => forecast.workspaceId === workspaceId && forecast.period.from === period.from && forecast.period.to === period.to && (version === undefined || forecast.version === version)) ?? null;
  }
}
