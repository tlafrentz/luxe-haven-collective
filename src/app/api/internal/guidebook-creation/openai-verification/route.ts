import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreationProviderError, DirectOpenAiCreationProvider, OPENAI_EXTRACTION_MODEL, OPENAI_GENERATION_MODEL } from "@/features/guidebook-creation-assistant/providers";
import { OPENAI_NANO_SMOKE_IDEMPOTENCY_HASH } from "./policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER = "openai";
const EXECUTOR_CODE = "VERIFY_OPENAI_NANO_GENERATION_SMOKE_V1";

export async function GET(request: NextRequest) {
  const correlationId = randomUUID();
  const authorization = await authorize(request);
  if (!authorization.ok) return failure(authorization.code, authorization.status, correlationId);
  return noStore({
    credentialPresent: Boolean(process.env.OPENAI_API_KEY),
    provider: PROVIDER,
    configuredExtractionModel: OPENAI_EXTRACTION_MODEL,
    runtime: "nodejs",
    correlationId,
  });
}

export async function POST(request: NextRequest) {
  const correlationId = randomUUID();
  const authorization = await authorize(request);
  if (!authorization.ok) return failure(authorization.code, authorization.status, correlationId);
  const apiKey = process.env.OPENAI_API_KEY;
  const projectId = process.env.OPENAI_PROJECT_ID;
  if (!apiKey || !projectId) return failure("OPENAI_VERIFICATION_CREDENTIAL_MISSING", 503, correlationId);

  const db = createAdminClient();
  const prior = await db
    .from("production_verification_attempts")
    .select("id,status")
    .eq("idempotency_key_hash", OPENAI_NANO_SMOKE_IDEMPOTENCY_HASH)
    .maybeSingle();
  if (prior.error) return failure("OPENAI_VERIFICATION_OPERATION_READ_FAILED", 503, correlationId);
  if (prior.data) return failure("OPENAI_VERIFICATION_REPLAY_REJECTED", 409, correlationId);

  const run = await db
    .from("production_verification_runs")
    .select("id")
    .eq("environment_code", "production")
    .in("status", ["draft", "ready", "running", "paused", "blocked", "awaiting_review"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (run.error || !run.data) return failure("OPENAI_VERIFICATION_RUN_UNAVAILABLE", 503, correlationId);
  const instance = await db
    .from("production_verification_instances")
    .select("id,latest_attempt_number")
    .eq("verification_run_id", run.data.id)
    .eq("scenario_code", "PV-009")
    .eq("scenario_version", 1)
    .maybeSingle();
  if (instance.error || !instance.data) return failure("OPENAI_VERIFICATION_CAPABILITY_UNAVAILABLE", 503, correlationId);

  const attemptId = randomUUID();
  const claimed = await db.from("production_verification_attempts").insert({
    id: attemptId,
    scenario_instance_id: instance.data.id,
    attempt_number: Number(instance.data.latest_attempt_number) + 1,
    executor_code: EXECUTOR_CODE,
    initiated_by: authorization.actorId,
    correlation_id: correlationId,
    idempotency_key_hash: OPENAI_NANO_SMOKE_IDEMPOTENCY_HASH,
    status: "running",
    started_at: new Date().toISOString(),
  });
  if (claimed.error) return failure(claimed.error.code === "23505" ? "OPENAI_VERIFICATION_REPLAY_REJECTED" : "OPENAI_VERIFICATION_OPERATION_CLAIM_FAILED", claimed.error.code === "23505" ? 409 : 503, correlationId);

  const provider = new DirectOpenAiCreationProvider({ apiKey, projectId, extractionModel: OPENAI_EXTRACTION_MODEL, generationModel: OPENAI_GENERATION_MODEL, timeoutMs: 30_000, allowExplicitFallback: false });
  const controller = new AbortController();
  try {
    const output = await provider.verifyNanoGeneration({ correlationId, signal: controller.signal });
    const usage = output.usage as Record<string, string | number>;
    const result = {
      httpStatus: output.httpStatus,
      openaiRequestId: output.openaiRequestId,
      model: output.model,
      inputTokens: Number(usage.input_tokens ?? 0),
      outputTokens: Number(usage.output_tokens ?? 0),
      reasoningTokens: Number(usage.reasoning_tokens ?? 0),
      calculatedCostUsd: Number(usage.calculated_cost_usd ?? 0),
      latencyMs: Number(usage.latency_ms ?? 0),
      correlationId,
      classification: "OPENAI_NANO_GENERATION_SMOKE_SUCCEEDED",
    };
    await complete(db, attemptId, "succeeded", result);
    return noStore({ ok: true, provider: PROVIDER, ...result });
  } catch (error) {
    const providerError = error instanceof CreationProviderError ? error : null;
    const result = { httpStatus: providerError?.httpStatus ?? null, openaiRequestId: null, model: OPENAI_EXTRACTION_MODEL, inputTokens: 0, outputTokens: 0, reasoningTokens: 0, calculatedCostUsd: 0, latencyMs: 0, correlationId, classification: providerError ? safeProviderClassification(providerError) : safeTransportClassification(error) };
    await complete(db, attemptId, "failed", result);
    return noStore({ ok: false, provider: PROVIDER, ...result }, 502);
  }
}

async function authorize(request: NextRequest): Promise<{ ok: true; actorId: string } | { ok: false; code: string; status: number }> {
  if (process.env.OPENAI_RUNTIME_VERIFICATION_ENABLED !== "true" || process.env.OPENAI_RUNTIME_VERIFICATION_KILL_SWITCH === "true") return { ok: false, code: "OPENAI_VERIFICATION_DISABLED", status: 503 };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return { ok: false, code: "OPENAI_VERIFICATION_UNAUTHORIZED", status: 401 };
  const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await client.auth.getUser(token);
  if (!user) return { ok: false, code: "OPENAI_VERIFICATION_UNAUTHORIZED", status: 401 };
  const { data: isAdmin } = await client.rpc("is_admin");
  if (isAdmin !== true) return { ok: false, code: "OPENAI_VERIFICATION_UNAUTHORIZED", status: 401 };
  const identity = await createAdminClient()
    .from("controlled_verification_identities")
    .select("id")
    .eq("environment_code", "production")
    .eq("opaque_auth_subject_reference", user.id)
    .eq("identity_type_code", "release_verifier")
    .eq("status", "active")
    .contains("allowed_scenario_codes", ["PV-009"])
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .maybeSingle();
  if (identity.error || !identity.data) return { ok: false, code: "OPENAI_VERIFICATION_CAPABILITY_REQUIRED", status: 403 };
  return { ok: true, actorId: user.id };
}

async function complete(db: ReturnType<typeof createAdminClient>, attemptId: string, status: "succeeded" | "failed", result: Record<string, unknown>) {
  await db.from("production_verification_attempts").update({ status, stable_result_code: JSON.stringify(result), completed_at: new Date().toISOString() }).eq("id", attemptId).eq("status", "running");
}

function safeProviderClassification(error: CreationProviderError) {
  if (error.httpStatus === 401 || error.httpStatus === 403) return "OPENAI_AUTHORIZATION_FAILED";
  if (error.httpStatus === 404) return "OPENAI_MODEL_UNAVAILABLE";
  if (error.kind === "rate_limit") return "OPENAI_RATE_LIMITED";
  if (error.kind === "timeout") return "OPENAI_CONNECT_TIMEOUT";
  if (error.kind === "invalid_output") return "OPENAI_INVALID_OUTPUT";
  return error.kind === "unavailable" ? "OPENAI_UNAVAILABLE" : "OPENAI_GENERATION_FAILED";
}

function safeTransportClassification(error: unknown) {
  const candidate = error as { name?: unknown; code?: unknown; cause?: { code?: unknown } } | null;
  const code = String(candidate?.cause?.code ?? candidate?.code ?? "");
  if (candidate?.name === "TimeoutError" || code === "UND_ERR_CONNECT_TIMEOUT") return "OPENAI_CONNECT_TIMEOUT";
  if (code === "ENOTFOUND") return "OPENAI_DNS_FAILED";
  if (code === "ECONNREFUSED") return "OPENAI_CONNECTION_REFUSED";
  if (code === "ECONNRESET") return "OPENAI_CONNECTION_RESET";
  if (/CERT|TLS|SSL/.test(code)) return "OPENAI_TLS_FAILED";
  return "OPENAI_TRANSPORT_FAILED";
}

function failure(code: string, status: number, correlationId: string) {
  return noStore({ ok: false, code, correlationId }, status);
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive", Allow: "GET, POST" } });
}
