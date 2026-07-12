import { NextResponse } from "next/server";

import {
  runHospitableReservationSync,
} from "@/features/integrations/hospitable";

export async function POST() {
  try {
    const started = Date.now();

    const result =
      await runHospitableReservationSync();

    return NextResponse.json({
      success: true,
      durationMs:
        Date.now() - started,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown sync error.",
      },
      {
        status: 500,
      },
    );
  }
}
