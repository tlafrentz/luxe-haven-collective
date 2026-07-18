import {
  ComparableProperty,
} from "../../domain/entities/comparable-property";

import {
  ProviderType,
} from "../../domain/enums/provider-type";

import {
  ConfidenceScore,
} from "../../domain/value-objects/confidence-score";

import {
  DataProvenance,
} from "../../domain/value-objects/data-provenance";

import type {
  RentCastComparableRecord,
} from "./rentcast-comparable-types";

export function mapRentCastComparable(
  record:
    RentCastComparableRecord,
  retrievedAt:
    Date =
      new Date(),
): ComparableProperty {
  const id =
    record.id?.trim();

  const formattedAddress =
    record.formattedAddress
      ?.trim();

  if (
    !id ||
    !formattedAddress
  ) {
    throw new Error(
      "RentCast returned a comparable without an id or formatted address.",
    );
  }

  const confidence =
    normalizeConfidence(
      record.correlation,
    );

  return new ComparableProperty({
    id,
    address:
      formattedAddress,
    providerPropertyId:
      id,
    propertyType:
      record.propertyType,
    bedrooms:
      normalizeNonNegativeNumber(
        record.bedrooms,
      ),
    bathrooms:
      normalizeNonNegativeNumber(
        record.bathrooms,
      ),
    squareFeet:
      normalizePositiveNumber(
        record.squareFootage,
      ),
    yearBuilt:
      normalizeYear(
        record.yearBuilt,
      ),
    estimatedValue:
      normalizeNonNegativeNumber(
        record.price,
      ),
    latitude:
      normalizeCoordinate(
        record.latitude,
      ),
    longitude:
      normalizeCoordinate(
        record.longitude,
      ),
    distanceMiles:
      normalizeNonNegativeNumber(
        record.distance,
      ),
    correlation:
      normalizeFiniteNumber(
        record.correlation,
      ),
    listedDate:
      parseOptionalDate(
        record.listedDate,
      ),
    removedDate:
      parseOptionalDate(
        record.removedDate,
      ),
    daysOnMarket:
      normalizeNonNegativeNumber(
        record.daysOnMarket,
      ),
    provenance:
      new DataProvenance(
        ProviderType.RentCast,
        retrievedAt,
        new ConfidenceScore(
          confidence,
        ),
        1,
        "Mapped from a RentCast AVM comparable sale listing.",
        "v1",
      ),
  });
}

function normalizeConfidence(
  correlation:
    number | undefined,
): number {
  if (
    correlation === undefined ||
    !Number.isFinite(
      correlation,
    )
  ) {
    return 65;
  }

  const normalized =
    correlation <= 1
      ? correlation * 100
      : correlation;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        normalized,
      ),
    ),
  );
}

function normalizeNonNegativeNumber(
  value:
    number | undefined,
): number | undefined {
  if (
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return undefined;
  }

  return value;
}

function normalizePositiveNumber(
  value:
    number | undefined,
): number | undefined {
  if (
    value === undefined ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return undefined;
  }

  return value;
}

function normalizeFiniteNumber(
  value:
    number | undefined,
): number | undefined {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return undefined;
  }

  return value;
}

function normalizeCoordinate(
  value:
    number | undefined,
): number | undefined {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return undefined;
  }

  return value;
}

function normalizeYear(
  value:
    number | undefined,
): number | undefined {
  if (
    value === undefined ||
    !Number.isInteger(value) ||
    value < 1600 ||
    value >
      new Date()
        .getFullYear() +
        1
  ) {
    return undefined;
  }

  return value;
}

function parseOptionalDate(
  value:
    string | undefined,
): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? undefined
    : date;
}
