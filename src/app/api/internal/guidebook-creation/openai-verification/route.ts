import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPENAI_EXTRACTION_MODEL } from "@/features/guidebook-creation-assistant/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER = "openai";

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
  void request;
  return failure("OPENAI_VERIFICATION_OPERATION_CLOSED", 410, correlationId);
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


function failure(code: string, status: number, correlationId: string) {
  return noStore({ ok: false, code, correlationId }, status);
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive", Allow: "GET, POST" } });
}
