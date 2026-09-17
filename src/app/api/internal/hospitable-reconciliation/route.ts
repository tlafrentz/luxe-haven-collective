import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHospitableReservationSync, SYNC_ALREADY_RUNNING_ERROR } from "@/features/integrations/hospitable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * LHS-INT-020/021: scheduled reconciliation. This is a thin cron wrapper
 * around the existing `runHospitableReservationSync` pull-and-upsert
 * pipeline (already one-directional: reads Hospitable, writes local
 * projections, never the reverse) — see run-reservation-sync.ts. Failures
 * are recorded as booking exceptions rather than silently retried forever.
 */
function authorized(request: NextRequest): boolean {
  const expected = process.env.HOSPITABLE_SYNC_SECRET ?? process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, code: "RECONCILIATION_UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await runHospitableReservationSync();

    if (result.failed > 0) {
      const admin = createAdminClient();
      await admin.from("booking_exceptions").insert({
        reservation_external_id: null,
        property_id: null,
        issue_type: "reconciliation_partial_failure",
        provider_evidence: {
          discovered: result.discovered,
          processed: result.processed,
          failed: result.failed,
          skipped: result.skipped,
        },
        status: "open",
      });
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown reconciliation error.";
    console.error("hospitable_reconciliation_failed", { message });

    if (message !== SYNC_ALREADY_RUNNING_ERROR) {
      const admin = createAdminClient();
      await admin.from("booking_exceptions").insert({
        reservation_external_id: null,
        property_id: null,
        issue_type: "reconciliation_failed",
        provider_evidence: { message: message.slice(0, 300) },
        status: "open",
      });
    }

    return NextResponse.json(
      { ok: false, code: message === SYNC_ALREADY_RUNNING_ERROR ? "RECONCILIATION_ALREADY_RUNNING" : "RECONCILIATION_FAILED" },
      { status: message === SYNC_ALREADY_RUNNING_ERROR ? 409 : 500 },
    );
  }
}

export const GET = POST;
