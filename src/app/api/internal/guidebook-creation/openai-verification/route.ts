import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPENAI_EXTRACTION_MODEL } from "@/features/guidebook-creation-assistant/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER = "openai";
const RESPONSES_URL = "https://api.openai.com/v1/responses";
const EXECUTOR_CODE = "VERIFY_OPENAI_RESPONSES_GPT5_NANO";
const IDEMPOTENCY_HASH = createHash("sha256")
  .update("guidebook:openai:responses:gpt-5-nano:v1")
  .digest("hex");

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
    .eq("idempotency_key_hash", IDEMPOTENCY_HASH)
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
    idempotency_key_hash: IDEMPOTENCY_HASH,
    status: "running",
    started_at: new Date().toISOString(),
  });
  if (claimed.error) return failure(claimed.error.code === "23505" ? "OPENAI_VERIFICATION_REPLAY_REJECTED" : "OPENAI_VERIFICATION_OPERATION_CLAIM_FAILED", claimed.error.code === "23505" ? 409 : 503, correlationId);

  const started = performance.now();
  try {
    const response = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "OpenAI-Project": projectId, "x-client-request-id": correlationId },
      body: JSON.stringify({ model: OPENAI_EXTRACTION_MODEL, store: false, input: "Return a JSON object with one boolean field named ok.", text: { format: { type: "json_object" } }, reasoning: { effort: "low" }, max_output_tokens: 40 }),
      signal: AbortSignal.timeout(30_000),
    });
    const latencyMs = Math.max(0, Math.round(performance.now() - started));
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const usage = body.usage && typeof body.usage === "object" ? body.usage as Record<string, unknown> : {};
    const inputTokens = finite(usage.input_tokens);
    const outputTokens = finite(usage.output_tokens);
    const calculatedCostUsd = Number(((inputTokens * 0.05 + outputTokens * 0.4) / 1_000_000).toFixed(8));
    const result = {
      httpStatus: response.status,
      openaiRequestId: response.headers.get("x-request-id") ?? (typeof body.id === "string" ? body.id : null),
      model: typeof body.model === "string" ? body.model : OPENAI_EXTRACTION_MODEL,
      latencyMs,
      inputTokens,
      outputTokens,
      calculatedCostUsd,
      classification: response.ok ? "OPENAI_RESPONSES_AVAILABLE" : safeHttpClassification(response.status),
    };
    await complete(db, attemptId, response.ok ? "succeeded" : "failed", result);
    if (!response.ok) return noStore({ ok: false, provider: PROVIDER, correlationId, ...result }, 502);
    return noStore({ ok: true, provider: PROVIDER, correlationId, ...result });
  } catch (error) {
    const latencyMs = Math.max(0, Math.round(performance.now() - started));
    const result = { httpStatus: null, openaiRequestId: null, model: null, latencyMs, classification: safeTransportClassification(error) };
    await complete(db, attemptId, "failed", result);
    return noStore({ ok: false, provider: PROVIDER, correlationId, ...result, inputTokens: 0, outputTokens: 0, calculatedCostUsd: 0 }, 502);
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

function safeHttpClassification(status: number) {
  if (status === 401 || status === 403) return "OPENAI_AUTHORIZATION_FAILED";
  if (status === 404) return "OPENAI_MODEL_UNAVAILABLE";
  if (status === 429) return "OPENAI_RATE_LIMITED";
  return status >= 500 ? "OPENAI_UNAVAILABLE" : "OPENAI_METADATA_FAILED";
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

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function failure(code: string, status: number, correlationId: string) {
  return noStore({ ok: false, code, correlationId }, status);
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive", Allow: "GET, POST" } });
}
