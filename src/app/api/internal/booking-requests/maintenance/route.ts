import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupabasePlatformActionRepository } from "@/platform/actions";
import { runBookingRequestMaintenance } from "@/features/booking-requests/application/maintenance";
import { buildBlockReleaseAction } from "@/features/booking-requests/infrastructure/booking-request-action";
import { sendBookingNotification } from "@/features/booking-requests/infrastructure/notifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Expires lapsed holds/proposals and reminds the operator about overdue reviews. Scheduled daily in vercel.json. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, code: "MAINTENANCE_UNAUTHORIZED" }, { status: 401 });

  const admin = createAdminClient();
  try {
    const result = await runBookingRequestMaintenance(admin, {
      notify: (input) => sendBookingNotification(admin, input),
      createBlockReleaseTask: async ({ bookingRequestId, calendarBlockId, propertyId, reason }) => {
        const { data: property } = await admin.from("properties").select("name, owner_id").eq("id", propertyId).maybeSingle();
        if (!property?.owner_id) return;
        try {
          await new SupabasePlatformActionRepository(admin).add({
            action: buildBlockReleaseAction({ workspaceId: property.owner_id, bookingRequestId, calendarBlockId, propertyName: property.name ?? "the property", reason }),
          });
        } catch (error) {
          // The task id is derived from the block, so a repeat run hits a duplicate; anything else is logged.
          console.error("booking_request_release_task_failed", { message: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
        }
      },
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("booking_request_maintenance_failed", { message: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return NextResponse.json({ ok: false, code: "MAINTENANCE_FAILED" }, { status: 500 });
  }
}

export const GET = POST;
