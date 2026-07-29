import type { WorkspaceAccessContext } from "@/features/workspace";
import type {
  Budget, FinancialAccount, FinancialEvidence, FinancialIdentity, FinancialPeriod,
  FinancialReadModel, FinancialSnapshot, FinancialTransaction, Forecast, Ledger,
} from "../domain";

export type FinancialAuthorizationLevel = "read" | "detail" | "planning" | "administration";

export type GetFinancialSnapshotQuery = Readonly<{
  access: WorkspaceAccessContext | null;
  workspaceId: string;
  period: FinancialPeriod;
  portfolioId?: string;
  propertyId?: string;
  propertyIds?: readonly string[];
  reportingCurrency?: string;
  projectionVersion?: number;
  basis?: import("../domain").FinancialBasis;
  authorizationLevel?: FinancialAuthorizationLevel;
  evaluatedAt?: string;
}>;

export interface FinancialSource {
  getIdentity(workspaceId: string): Promise<FinancialIdentity | null>;
  listAccounts(workspaceId: string): Promise<readonly FinancialAccount[]>;
  listTransactions(scope: Readonly<{ workspaceId: string; period: FinancialPeriod; portfolioId?: string; propertyId?: string; propertyIds?: readonly string[] }>): Promise<readonly FinancialTransaction[]>;
  getSynchronization(workspaceId: string): Promise<Readonly<{ lastSuccessfulAt?: string; expectedProviders: number; connectedProviders: number; historyMonths: number }>>;
}

export interface FinancialSnapshotRepository {
  get(query: GetFinancialSnapshotQuery): Promise<FinancialSnapshot | null>;
  put(key: string, snapshot: FinancialSnapshot): Promise<void>;
  invalidateWorkspace(workspaceId: string): Promise<void>;
}
export interface LedgerRepository { getLedger(query: GetFinancialSnapshotQuery): Promise<Ledger>; }
export interface TransactionRepository { listTransactions(query: GetFinancialSnapshotQuery): Promise<readonly FinancialTransaction[]>; }
export interface BudgetRepository { getBudget(workspaceId: string, period: FinancialPeriod): Promise<Budget | null>; }
export interface ForecastRepository { getForecast(workspaceId: string, period: FinancialPeriod, version?: number): Promise<Forecast | null>; }

export interface FinancialReadModelRepository {
  buildFinancialReadModel(query: GetFinancialSnapshotQuery): Promise<FinancialReadModel>;
  getFinancialSnapshot(query: GetFinancialSnapshotQuery): Promise<FinancialSnapshot>;
}

export interface FinancialObservability {
  evaluated(event: Readonly<{
    workspaceId: string; period: FinancialPeriod; transactionCount: number;
    evidenceCoverage: number; confidence: string; freshness: string; durationMs: number;
  }>): void;
}

export type FinancialBuildContext = Readonly<{
  query: GetFinancialSnapshotQuery;
  identity: FinancialIdentity;
  accounts: readonly FinancialAccount[];
  transactions: readonly FinancialTransaction[];
  synchronization: Awaited<ReturnType<FinancialSource["getSynchronization"]>>;
}>;

export type FinancialEvidenceResult = Readonly<{ evidence: FinancialEvidence; freshness: FinancialSnapshot["freshness"]; confidence: FinancialSnapshot["confidence"] }>;
