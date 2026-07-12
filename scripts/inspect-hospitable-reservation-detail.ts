import {
  getAllHospitableProperties,
  hospitableRequest,
} from "../src/features/integrations/hospitable";

type UnknownRecord = Record<string, unknown>;

type ReservationListResponse = {
  data: UnknownRecord[];
  links?: UnknownRecord;
  meta?: UnknownRecord;
};

type ReservationDetailResponse = {
  data: UnknownRecord;
};

function redactValue(
  key: string,
  value: unknown,
): unknown {
  const sensitiveKeys = [
    "email",
    "phone",
    "first_name",
    "last_name",
    "full_name",
    "name",
    "address",
    "message",
    "door_code",
    "access_code",
  ];

  if (
    sensitiveKeys.some((sensitiveKey) =>
      key.toLowerCase().includes(sensitiveKey),
    )
  ) {
    return "<redacted>";
  }

  return value;
}

function redactObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactObject);
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(
        value as UnknownRecord,
      ).map(([key, nestedValue]) => [
        key,
        redactValue(
          key,
          redactObject(nestedValue),
        ),
      ]),
    );
  }

  return value;
}

async function getFirstReservationId(): Promise<string> {
  const properties =
    await getAllHospitableProperties();

  if (properties.length === 0) {
    throw new Error(
      "No Hospitable properties were returned.",
    );
  }

  const startDate =
    process.env.HOSPITABLE_SYNC_START_DATE ??
    "2026-01-01";

  const endDate =
    process.env.HOSPITABLE_SYNC_END_DATE ??
    "2026-12-31";

  const searchParams: Record<
    string,
    string | number | boolean | undefined
  > = {
    start_date: startDate,
    end_date: endDate,
    page: 1,
  };

  properties.forEach((property, index) => {
    searchParams[`properties[${index}]`] =
      property.id;
  });

  const response =
    await hospitableRequest<ReservationListResponse>(
      "/reservations",
      {
        searchParams,
      },
    );

  const firstReservation =
    response.data[0];

  const reservationId =
    typeof firstReservation?.id === "string"
      ? firstReservation.id
      : null;

  if (!reservationId) {
    throw new Error(
      "No reservation was found in the selected date range.",
    );
  }

  return reservationId;
}

async function main() {
  const reservationId =
    await getFirstReservationId();

  const response =
    await hospitableRequest<ReservationDetailResponse>(
      `/reservations/${reservationId}`,
      {
        searchParams: {
          include:
            "guest,financials,listings,properties",
        },
      },
    );

  console.log(
    "Detail top-level keys:",
    Object.keys(response),
  );

  console.log(
    "Reservation detail field names:",
    Object.keys(response.data),
  );

  console.log(
    "Redacted reservation detail:",
    JSON.stringify(
      redactObject(response.data),
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
