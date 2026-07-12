import {
  getHospitableReservationDetail,
} from "../src/features/integrations/hospitable";

async function main() {
  const reservationId =
    process.argv[2];

  if (!reservationId) {
    throw new Error(
      "Provide a Hospitable reservation ID.",
    );
  }

  const reservation =
    await getHospitableReservationDetail(
      reservationId,
    );

  console.log(
    JSON.stringify(
      {
        id: reservation.id,
        code: reservation.code,
        platform: reservation.platform,
        arrivalDate:
          reservation.arrival_date,
        departureDate:
          reservation.departure_date,
        nights: reservation.nights,
        stayType: reservation.stay_type,
        status: reservation.status,
        reservationStatus:
          reservation.reservation_status,
        propertyIds:
          reservation.properties?.map(
            (property) => property.id,
          ) ?? [],
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );

  process.exit(1);
});
