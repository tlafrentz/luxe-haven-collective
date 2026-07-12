import { NextResponse } from "next/server";

import {
  authorizeHospitableSyncRequest,
  runHospitableReservationSync,
  SYNC_ALREADY_RUNNING_ERROR,
} from "@/features/integrations/hospitable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PublicSyncError = {
  message: string;
  status: number;
};

function getPublicSyncError(
  error: unknown,
): PublicSyncError {
  if (
    error instanceof Error &&
    error.message ===
      SYNC_ALREADY_RUNNING_ERROR
  ) {
    return {
      message:
        SYNC_ALREADY_RUNNING_ERROR,
      status: 409,
    };
  }

  return {
    message:
      "The Hospitable sync could not be completed. Review sync history or server logs for details.",
    status: 500,
  };
}

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
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const startedAt = Date.now();

  console.info(
    "Hospitable reservation sync started",
    {
      authorizationMethod:
        authorization.method,
      requestedBy:
        authorization.userId ?? null,
    },
  );

  try {
    const result =
      await runHospitableReservationSync();

    const durationMs =
      Date.now() - startedAt;

    console.info(
      "Hospitable reservation sync completed",
      {
        authorizationMethod:
          authorization.method,
        requestedBy:
          authorization.userId ?? null,
        durationMs,
        processed: result.processed,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
      },
    );

    return NextResponse.json(
      {
        success: true,
        durationMs,
        result,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const publicError =
      getPublicSyncError(error);

    console.error(
      "Hospitable reservation sync failed",
      {
        authorizationMethod:
          authorization.method,
        requestedBy:
          authorization.userId ?? null,
        durationMs:
          Date.now() - startedAt,
        error:
          error instanceof Error
            ? error.message
            : "Unknown sync error.",
      },
    );

    return NextResponse.json(
      {
        success: false,
        error: publicError.message,
      },
      {
        status: publicError.status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
