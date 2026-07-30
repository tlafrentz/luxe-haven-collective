import type { InvestmentWorkspaceAnalysisResult, RunInvestmentWorkspaceAnalysisCommand } from "@/features/investment-intelligence";
import { createClient } from "@/lib/supabase/server";
import type { AuthorizedMarketSnapshotReference } from "@/features/market-intelligence/str/application/authorize-str-market-snapshot";

export type InvestmentAnalysisSaveToken = string;
export type IssuedInvestmentAnalysisSaveToken = Readonly<{ token: InvestmentAnalysisSaveToken; expiresAt: Date }>;
type StoredAnalysis = Readonly<{ ownerId: string; result: InvestmentWorkspaceAnalysisResult; input: Omit<RunInvestmentWorkspaceAnalysisCommand, "context">; marketReference?: AuthorizedMarketSnapshotReference; analyzedAt: Date; expiresAt: Date }>;
const TTL_MS = 30 * 60 * 1000;

export async function storeInvestmentAnalysis(ownerId: string, result: InvestmentWorkspaceAnalysisResult, input: StoredAnalysis["input"], analyzedAt: Date, marketReference?: AuthorizedMarketSnapshotReference): Promise<IssuedInvestmentAnalysisSaveToken> {
  const token = `investment-analysis-${crypto.randomUUID()}-${crypto.randomUUID()}`, client = await createClient(), expiresAt = new Date(Date.now() + TTL_MS);
  const { error } = await client.from("investment_analysis_save_tokens").insert({ token_hash: await hash(token), owner_id: ownerId,
    payload: JSON.parse(JSON.stringify({ result, input })), analysis_id: result.lineage.workspaceRunId,
    subject_property_snapshot_id: marketReference?.subjectPropertySnapshotId ?? null, market_snapshot_id: marketReference?.marketSnapshotId ?? null,
    assumption_version: marketReference?.assumptionVersion ?? null, confidence_version: marketReference?.confidenceVersion ?? null,
    comparable_policy_version: marketReference?.comparablePolicyVersion ?? null,
    analyzed_at: analyzedAt.toISOString(), expires_at: expiresAt.toISOString() });
  if (error) throw new Error("The completed analysis could not be made available for saving.", { cause: error });
  console.info("investment_analysis_token_created",{requestId:result.lineage.workspaceRunId,actorId:ownerId,marketSnapshotId:marketReference?.marketSnapshotId,propertySnapshotId:marketReference?.subjectPropertySnapshotId,expiresAt:expiresAt.toISOString()});
  return Object.freeze({ token, expiresAt });
}
export async function resolveInvestmentAnalysis(token: string, ownerId: string): Promise<StoredAnalysis | null> {
  const client = await createClient(), { data, error } = await client.from("investment_analysis_save_tokens").select("owner_id,payload,analysis_id,subject_property_snapshot_id,market_snapshot_id,assumption_version,confidence_version,comparable_policy_version,analyzed_at,expires_at").eq("token_hash", await hash(token)).eq("owner_id", ownerId).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) { console.error("investment_analysis_token_resolution_failed",{actorId:ownerId,errorCode:"TOKEN_PERSISTENCE_READ_FAILED"}); throw new Error("Investment analysis token persistence is unavailable."); }
  if (!data) { console.info("investment_analysis_token_rejected",{actorId:ownerId,errorCode:"TOKEN_INVALID_OR_EXPIRED"}); return null; } const row = data as unknown as { owner_id: string; payload: { result: InvestmentWorkspaceAnalysisResult; input: StoredAnalysis["input"] }; analysis_id:string; subject_property_snapshot_id:string|null;market_snapshot_id:string|null;assumption_version:string|null;confidence_version:string|null;comparable_policy_version:string|null; analyzed_at: string; expires_at: string };
  console.info("investment_analysis_token_resolved",{actorId:ownerId,requestId:row.payload.result.lineage.workspaceRunId});
  const marketReference = row.market_snapshot_id && row.subject_property_snapshot_id ? {
    analysisId: row.analysis_id, subjectPropertySnapshotId: row.subject_property_snapshot_id, marketSnapshotId: row.market_snapshot_id,
    assumptionVersion: row.assumption_version ?? "str-assumptions.v1", confidenceVersion: row.confidence_version ?? "str-confidence.v1",
    comparablePolicyVersion: row.comparable_policy_version ?? "unknown",
  } : undefined;
  return Object.freeze({ ownerId: row.owner_id, result: revive(row.payload.result), input: revive(row.payload.input), ...(marketReference ? { marketReference } : {}), analyzedAt: new Date(row.analyzed_at), expiresAt: new Date(row.expires_at) });
}
async function hash(value: string) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
function revive<T>(value: T): T { return JSON.parse(JSON.stringify(value), (_key, item) => typeof item === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(item) ? new Date(item) : item) as T; }
