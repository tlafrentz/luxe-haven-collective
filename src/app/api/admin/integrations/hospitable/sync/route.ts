import { NextResponse } from "next/server";

import {
  authorizeHospitableSyncRequest,
  runHospitableReservationSync,
} from "@/features/integrations/hospitable";

export async function POST(
  request: Request,
) {
  const authorization =
    await authorizeHospitableSyncRequest(
      request,
    );

  if (!authorization.authorized) {
    const status =
      authorization.reason ===
      "unauthenticated"
        ? 401
        : 403;

    return NextResponse.json(
      {
        success: false,
        error:
          status === 401
            ? "Authentication required."
            : "Administrator access required.",
      },
      {
        status,
      },
    );
  }

  console.log(
    `Hospitable sync requested via ${authorization.method}`,
  );

  const startedAt = Date.now();

  try {
    const result =
      await runHospitableReservationSync();

    const durationMs =
      Date.now() - startedAt;

    console.log(
      "Hospitable reservation sync completed",
      {
        method: authorization.method,
        durationMs,
        processed: result.processed,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
      },
    );

    return NextResponse.json({
      success: true,
      durationMs,
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Hospitable sync error.";

    console.error(
      "Hospitable reservation sync failed",
      {
        method: authorization.method,
        error: message,
      },
    );

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}
