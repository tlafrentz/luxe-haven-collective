import type { InvestmentWorkspaceAnalysisResult, RunInvestmentWorkspaceAnalysisCommand } from "@/features/investment-intelligence";
import { createClient } from "@/lib/supabase/server";

export type InvestmentAnalysisSaveToken = string;
type StoredAnalysis = Readonly<{ ownerId: string; result: InvestmentWorkspaceAnalysisResult; input: Omit<RunInvestmentWorkspaceAnalysisCommand, "context">; analyzedAt: Date; expiresAt: Date }>;
const TTL_MS = 30 * 60 * 1000;

export async function storeInvestmentAnalysis(ownerId: string, result: InvestmentWorkspaceAnalysisResult, input: StoredAnalysis["input"], analyzedAt: Date): Promise<InvestmentAnalysisSaveToken> {
  const token = `investment-analysis-${crypto.randomUUID()}-${crypto.randomUUID()}`, client = await createClient(), expiresAt = new Date(Date.now() + TTL_MS);
  const { error } = await client.from("investment_analysis_save_tokens").insert({ token_hash: await hash(token), owner_id: ownerId, payload: JSON.parse(JSON.stringify({ result, input })), analyzed_at: analyzedAt.toISOString(), expires_at: expiresAt.toISOString() });
  if (error) throw new Error("The completed analysis could not be made available for saving.", { cause: error });
  return token;
}
export async function resolveInvestmentAnalysis(token: string, ownerId: string): Promise<StoredAnalysis | null> {
  const client = await createClient(), { data, error } = await client.from("investment_analysis_save_tokens").select("owner_id,payload,analyzed_at,expires_at").eq("token_hash", await hash(token)).eq("owner_id", ownerId).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error || !data) return null; const row = data as unknown as { owner_id: string; payload: { result: InvestmentWorkspaceAnalysisResult; input: StoredAnalysis["input"] }; analyzed_at: string; expires_at: string };
  return Object.freeze({ ownerId: row.owner_id, result: revive(row.payload.result), input: revive(row.payload.input), analyzedAt: new Date(row.analyzed_at), expiresAt: new Date(row.expires_at) });
}
async function hash(value: string) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
function revive<T>(value: T): T { return JSON.parse(JSON.stringify(value), (_key, item) => typeof item === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(item) ? new Date(item) : item) as T; }
