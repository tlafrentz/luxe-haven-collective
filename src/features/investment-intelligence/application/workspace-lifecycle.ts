import type { InvestmentWorkspaceStage } from "./types";

export type InvestmentWorkspaceFailureKind =
  | "validation"
  | "provider"
  | "authorization"
  | "persistence"
  | "concurrency"
  | "expired-save-token"
  | "unknown";

export type InvestmentWorkspaceLifecycleState<TAnalysis> =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "ready" }>
  | Readonly<{ status: "running"; stage: InvestmentWorkspaceStage }>
  | Readonly<{ status: "succeeded"; analysis: TAnalysis }>
  | Readonly<{ status: "saved"; analysis: TAnalysis; opportunityId: string; analysisVersionId: string; version: number }>
  | Readonly<{ status: "scenario"; analysis: TAnalysis; opportunityId: string; scenarioId: string }>
  | Readonly<{ status: "archived"; analysis: TAnalysis; opportunityId: string }>
  | Readonly<{ status: "failed"; kind: InvestmentWorkspaceFailureKind; code?: string; message: string }>;

export function classifyInvestmentWorkspaceFailure(code: string): InvestmentWorkspaceFailureKind {
  const normalized = code.toUpperCase();
  if (normalized.includes("VALID") || normalized === "INVALID_INPUT") return "validation";
  if (normalized.includes("AUTH") || normalized.includes("PERMISSION")) return "authorization";
  if (normalized.includes("PERSIST")) return "persistence";
  if (normalized.includes("CONCURRENCY") || normalized.includes("CONFLICT")) return "concurrency";
  if (normalized.includes("EXPIRED")) return "expired-save-token";
  if (normalized.includes("MARKET") || normalized.includes("PROVIDER")) return "provider";
  return "unknown";
}

export function canSaveCanonicalAnalysis<T>(
  state: InvestmentWorkspaceLifecycleState<T>,
  now: Date,
  expiresAt: (analysis: T) => Date,
): boolean {
  return state.status === "succeeded" && expiresAt(state.analysis).getTime() > now.getTime();
}
