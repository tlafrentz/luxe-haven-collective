import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await authorizedAdministrator(request))) return unauthorized();
  return noStore({ keyPresent: Boolean(process.env.AI_GATEWAY_API_KEY) });
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
