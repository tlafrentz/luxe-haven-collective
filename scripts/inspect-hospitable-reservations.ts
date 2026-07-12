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

async function main() {
  const startDate =
    process.env.HOSPITABLE_SYNC_START_DATE ??
    "2026-01-01";

  const endDate =
    process.env.HOSPITABLE_SYNC_END_DATE ??
    "2026-12-31";

  const properties =
    await getAllHospitableProperties();

  if (properties.length === 0) {
    throw new Error(
      "No Hospitable properties were returned.",
    );
  }

  const propertyIds = properties.map(
    (property) => property.id,
  );

  console.log(
    `Inspecting reservations for ${propertyIds.length} ${
      propertyIds.length === 1
        ? "property"
        : "properties"
    }.`,
  );

  const searchParams: Record<
    string,
    string | number | boolean | undefined
  > = {
    start_date: startDate,
    end_date: endDate,
    page: 1,
  };

  propertyIds.forEach((propertyId, index) => {
    searchParams[`properties[${index}]`] =
      propertyId;
  });

  const response =
    await hospitableRequest<ReservationListResponse>(
      "/reservations",
      {
        searchParams,
      },
    );

  console.log(
    "Top-level keys:",
    Object.keys(response),
  );

  console.log(
    "Reservation count on first page:",
    response.data.length,
  );

  console.log(
    "Links:",
    JSON.stringify(
      response.links ?? {},
      null,
      2,
    ),
  );

  console.log(
    "Meta:",
    JSON.stringify(
      response.meta ?? {},
      null,
      2,
    ),
  );

  const firstReservation =
    response.data[0];

  if (!firstReservation) {
    console.log(
      "No reservations found in the selected date range.",
    );

    return;
  }

  console.log(
    "Reservation field names:",
    Object.keys(firstReservation),
  );

  console.log(
    "Redacted first reservation:",
    JSON.stringify(
      redactObject(firstReservation),
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
