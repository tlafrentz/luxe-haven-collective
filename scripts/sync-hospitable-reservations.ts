import {
  syncHospitableReservations,
} from "../src/features/integrations/hospitable";

function getDateString(
  date: Date,
): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(
  date: Date,
  days: number,
): Date {
  const result = new Date(date);

  result.setUTCDate(
    result.getUTCDate() + days,
  );

  return result;
}

async function main() {
  const now = new Date();

  const startDate =
    process.env.HOSPITABLE_SYNC_START_DATE ??
    getDateString(
      addUtcDays(now, -365),
    );

  const endDate =
    process.env.HOSPITABLE_SYNC_END_DATE ??
    getDateString(
      addUtcDays(now, 730),
    );

  const batchSize = Number(
    process.env.HOSPITABLE_SYNC_BATCH_SIZE ??
      "5",
  );

  console.log(
    `Starting Hospitable reservation sync from ${startDate} through ${endDate}...`,
  );

  const result =
    await syncHospitableReservations({
      startDate,
      endDate,
      batchSize,
    });

  console.log(
    JSON.stringify(
      {
        connectionId:
          result.connectionId,
        startDate: result.startDate,
        endDate: result.endDate,
        discovered: result.discovered,
        processed: result.processed,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
        errors: result.errors,
      },
      null,
      2,
    ),
  );

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );

  process.exit(1);
});
