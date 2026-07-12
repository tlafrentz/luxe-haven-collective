import {
  syncHospitableReservations,
  type ReservationSyncOptions,
  type ReservationSyncResult,
} from "./sync-reservations";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);

  copy.setUTCDate(copy.getUTCDate() + days);

  return copy;
}

export async function runHospitableReservationSync(
  options: Partial<ReservationSyncOptions> = {},
): Promise<ReservationSyncResult> {
  const now = new Date();

  return syncHospitableReservations({
    startDate:
      options.startDate ??
      formatDate(addDays(now, -365)),
    endDate:
      options.endDate ??
      formatDate(addDays(now, 730)),
    batchSize:
      options.batchSize ?? 5,
  });
}
