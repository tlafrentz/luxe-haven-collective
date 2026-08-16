import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GATEWAY_ENDPOINT = "https://ai-gateway.vercel.sh/v1/responses";
const APPROVED_MODEL = "openai/gpt-5.4-mini-2026-03-17";

export async function GET(request: NextRequest) {
  if (!(await authorizedAdministrator(request))) return unauthorized();
  return noStore({ keyPresent: Boolean(process.env.AI_GATEWAY_API_KEY) });
}

export async function POST(request: NextRequest) {
  if (!(await authorizedAdministrator(request))) return unauthorized();
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) return noStore({ keyPresent: false }, 503);

  const correlationId = randomUUID();
  const response = await fetch(GATEWAY_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "x-correlation-id": correlationId,
    },
    body: JSON.stringify({
      model: APPROVED_MODEL,
      store: false,
      input: "Return a JSON object with one boolean field named ok.",
      text: { format: { type: "json_object" } },
      reasoning: { effort: "low" },
      max_output_tokens: 40,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return noStore({
    keyPresent: true,
    status: response.status,
    model: typeof body.model === "string" ? body.model : APPROVED_MODEL,
    providerRoute:
      response.headers.get("x-vercel-ai-gateway-provider") ?? "vercel-ai-gateway",
    correlationId,
    providerRequestId:
      typeof body.id === "string"
        ? body.id
        : response.headers.get("x-request-id"),
    usage: safeUsage(body.usage),
    cost: safeCost(body),
  });
}

async function authorizedAdministrator(request: NextRequest) {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return false;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await client.auth.getUser(token);
  if (!user) return false;
  const { data } = await client.rpc("is_admin");
  return data === true;
}

function safeUsage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  return Object.fromEntries(
    ["input_tokens", "output_tokens", "total_tokens"]
      .filter((key) => typeof input[key] === "number")
      .map((key) => [key, input[key]]),
  );
}

function safeCost(body: Record<string, unknown>) {
  const usage =
    body.usage && typeof body.usage === "object"
      ? (body.usage as Record<string, unknown>)
      : {};
  const metadata =
    body.provider_metadata && typeof body.provider_metadata === "object"
      ? (body.provider_metadata as Record<string, unknown>)
      : {};
  const gateway =
    metadata.gateway && typeof metadata.gateway === "object"
      ? (metadata.gateway as Record<string, unknown>)
      : {};
  const value = usage.cost ?? gateway.cost;
  return typeof value === "number" || typeof value === "string" ? value : null;
}

function unauthorized() {
  return noStore({ code: "GATEWAY_DIAGNOSTIC_UNAUTHORIZED" }, 401);
}

function noStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
