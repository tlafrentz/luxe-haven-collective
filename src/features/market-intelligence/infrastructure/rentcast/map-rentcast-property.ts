import {
  PropertyRecord,
} from "../../domain/entities/property-record";

import {
  ProviderType,
} from "../../domain/enums/provider-type";

import {
  ConfidenceScore,
} from "../../domain/value-objects/confidence-score";

import {
  DataProvenance,
} from "../../domain/value-objects/data-provenance";

import {
  ProviderError,
  ProviderErrorCode,
} from "../../application/providers/provider-error";

import type {
  RentCastPropertyRecord,
  RentCastPropertyTax,
  RentCastTaxAssessment,
} from "./rentcast-types";

export function mapRentCastProperty(
  record: RentCastPropertyRecord,
  retrievedAt: Date = new Date(),
): PropertyRecord {
  const id = record.id?.trim();
  const formattedAddress =
    record.formattedAddress?.trim();

  if (!id || !formattedAddress) {
    throw new ProviderError({
      provider:
        ProviderType.RentCast,
      code:
        ProviderErrorCode
          .InvalidResponse,
      message:
        "RentCast returned a property without an id or formatted address.",
    });
  }

  const latestAssessment =
    findLatestYearValue(
      record.taxAssessments,
    );

  const latestPropertyTax =
    findLatestYearValue(
      record.propertyTaxes,
    );

  return new PropertyRecord(
    id,
    {
      formatted: formattedAddress,
      addressLine1:
        normalizeString(
          record.addressLine1,
        ),
      city:
        normalizeString(
          record.city,
        ),
      state:
        normalizeString(
          record.state,
        ),
      postalCode:
        normalizeString(
          record.zipCode,
        ),
      country: "US",
    },
    {
      propertyType:
        normalizeString(
          record.propertyType,
        ),
      bedrooms:
        normalizeNonNegativeNumber(
          record.bedrooms,
        ),
      bathrooms:
        normalizeNonNegativeNumber(
          record.bathrooms,
        ),
      squareFeet:
        normalizeNonNegativeNumber(
          record.squareFootage,
        ),
      lotSquareFeet:
        normalizeNonNegativeNumber(
          record.lotSize,
        ),
      yearBuilt:
        normalizeYear(
          record.yearBuilt,
        ),
    },
    {
      estimatedValue:
        normalizeNonNegativeNumber(
          latestAssessment?.value,
        ),
      annualPropertyTaxes:
        normalizeNonNegativeNumber(
          latestPropertyTax?.total,
        ),
      lastSalePrice:
        normalizeNonNegativeNumber(
          record.lastSalePrice,
        ),
      lastSaleDate:
        parseOptionalDate(
          record.lastSaleDate,
        ),
    },
    new DataProvenance(
      ProviderType.RentCast,
      retrievedAt,
      new ConfidenceScore(
        calculatePropertyConfidence(
          record,
        ),
      ),
      1,
      "Mapped from a RentCast public property record.",
      "v1",
    ),
    createCoordinates(record),
  );
}

function createCoordinates(
  record: RentCastPropertyRecord,
):
  | {
      readonly latitude: number;
      readonly longitude: number;
    }
  | undefined {
  if (
    !Number.isFinite(
      record.latitude,
    ) ||
    !Number.isFinite(
      record.longitude,
    )
  ) {
    return undefined;
  }

  return {
    latitude:
      record.latitude as number,
    longitude:
      record.longitude as number,
  };
}

function calculatePropertyConfidence(
  record: RentCastPropertyRecord,
): number {
  const checks = [
    record.formattedAddress,
    record.latitude,
    record.longitude,
    record.propertyType,
    record.bedrooms,
    record.bathrooms,
    record.squareFootage,
    record.yearBuilt,
  ];

  const populated =
    checks.filter(
      (value) =>
        value !== undefined &&
        value !== null &&
        value !== "",
    ).length;

  return Math.round(
    55 +
      (populated / checks.length) *
        40,
  );
}

function findLatestYearValue<
  T extends
    | RentCastTaxAssessment
    | RentCastPropertyTax,
>(
  values:
    | Readonly<
        Record<
          string,
          T | undefined
        >
      >
    | undefined,
): T | undefined {
  if (!values) {
    return undefined;
  }

  return Object.entries(values)
    .filter(
      (
        entry,
      ): entry is [string, T] =>
        entry[1] !== undefined,
    )
    .sort(
      ([yearA], [yearB]) =>
        Number(yearB) -
        Number(yearA),
    )
    .map(([, value]) => value)
    .find(Boolean);
}

function normalizeString(
  value: string | undefined,
): string | undefined {
  const normalized = value?.trim();

  return normalized || undefined;
}

function normalizeNonNegativeNumber(
  value: number | undefined,
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

function normalizeYear(
  value: number | undefined,
): number | undefined {
  if (
    value === undefined ||
    !Number.isInteger(value) ||
    value < 1600 ||
    value >
      new Date().getFullYear() + 1
  ) {
    return undefined;
  }

  return value;
}

function parseOptionalDate(
  value: string | undefined,
): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return undefined;
  }

  return parsed;
}
