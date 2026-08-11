import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  processProductionAutomation,
  readProductionAutomationRuntimeConfig,
  requestProductionManualAutomation,
} from "@/platform/automations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const correlationId = randomUUID();
  if (!authorized(request))
    return NextResponse.json(
      { ok: false, code: "AUTOMATION_PROCESSOR_UNAUTHORIZED", correlationId },
      { status: 401 },
    );
  try {
    const config = readProductionAutomationRuntimeConfig();
    if (config.globalKillSwitch || config.workspaceKillSwitch)
      return NextResponse.json(
        { ok: false, code: "AUTOMATION_KILL_SWITCHED", correlationId },
        { status: 503 },
      );
    const body = request.method === "POST" ? await safeBody(request) : {};
    if (body.mode === "manual") {
      const requested = await requestProductionManualAutomation(
        correlationId,
        typeof body.idempotencyKey === "string" ? body.idempotencyKey : "",
        config,
      );
      return NextResponse.json({ ok: true, correlationId, manual: requested });
    }
    const summary = await processProductionAutomation(correlationId, config);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    const safeCause = safeFailureCause(error);
    const classification =
      safeCause === "AUTOMATION_KILL_SWITCHED"
        ? "AUTOMATION_KILL_SWITCHED"
        : "AUTOMATION_PROCESSOR_FAILED_SAFE";
    console.error("automation.processor.failed", {
      correlationId,
      classification,
      cause: safeCause,
    });
    return NextResponse.json(
      { ok: false, code: classification, correlationId },
      { status: classification === "AUTOMATION_KILL_SWITCHED" ? 503 : 500 },
    );
  }
}

function safeFailureCause(error: unknown) {
  if (!(error instanceof Error)) return "AUTOMATION_RUNTIME_UNKNOWN";
  if (error.message === "AUTOMATION_EXECUTE_IDENTITY_AUTH_FAILED")
    return error.message;
  if (error.message === "AUTOMATION_KILL_SWITCHED") return error.message;
  if (/^[A-Z][A-Z0-9_]{2,100}$/.test(error.message)) return error.message;
  return "AUTOMATION_RUNTIME_UNKNOWN";
}

async function safeBody(request: NextRequest): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 4096) throw new Error("AUTOMATION_MANUAL_REQUEST_INVALID");
  const value = await request.json().catch(() => ({}));
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export const GET = POST;

function authorized(request: NextRequest) {
  const expected =
    process.env.AUTOMATION_SCHEDULER_SECRET ?? process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected), right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}
