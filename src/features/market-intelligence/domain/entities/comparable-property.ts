import type {
  Money,
  Percentage,
} from "@/features/investment-intelligence/domain/value-objects";

import type {
  DataProvenance,
} from "../value-objects/data-provenance";

export interface ComparablePropertyInput {
  readonly id: string;
  readonly address: string;

  readonly providerPropertyId?: string;
  readonly propertyType?: string;

  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly sleeps?: number;
  readonly squareFeet?: number;
  readonly yearBuilt?: number;

  readonly latitude?: number;
  readonly longitude?: number;
  readonly distanceMiles?: number;

  /**
   * Canonical valuation basis used by comparable analysis.
   *
   * This is currently represented as a primitive number because provider
   * records arrive as numeric values and the valuation pipeline performs
   * numeric calculations. Currency normalization belongs at the provider
   * boundary and can later be elevated into a dedicated Market Intelligence
   * value object.
   */
  readonly estimatedValue?: number;
  readonly pricePerSquareFoot?: number;

  readonly listedDate?: Date;
  readonly removedDate?: Date;
  readonly daysOnMarket?: number;
  readonly correlation?: number;

  readonly averageDailyRate?: Money;
  readonly occupancy?: Percentage;
  readonly annualRevenue?: Money;

  readonly rating?: number;
  readonly amenities?: readonly string[];
  readonly listingUrl?: string;

  readonly provenance: DataProvenance;
}

export class ComparableProperty {
  readonly id: string;
  readonly address: string;

  readonly providerPropertyId?: string;
  readonly propertyType?: string;

  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly sleeps?: number;
  readonly squareFeet?: number;
  readonly yearBuilt?: number;

  readonly latitude?: number;
  readonly longitude?: number;
  readonly distanceMiles?: number;

  readonly estimatedValue?: number;
  readonly pricePerSquareFoot?: number;

  readonly listedDate?: Date;
  readonly removedDate?: Date;
  readonly daysOnMarket?: number;
  readonly correlation?: number;

  readonly averageDailyRate?: Money;
  readonly occupancy?: Percentage;
  readonly annualRevenue?: Money;

  readonly rating?: number;
  readonly amenities: readonly string[];
  readonly listingUrl?: string;

  readonly provenance: DataProvenance;

  constructor(
    input: ComparablePropertyInput,
  ) {
    const id =
      input.id.trim();

    const address =
      input.address.trim();

    if (!id) {
      throw new Error(
        "Comparable property id is required.",
      );
    }

    if (!address) {
      throw new Error(
        "Comparable property address is required.",
      );
    }

    validateOptionalNonNegative(
      input.distanceMiles,
      "distance miles",
    );

    validateOptionalNonNegative(
      input.bedrooms,
      "bedrooms",
    );

    validateOptionalNonNegative(
      input.bathrooms,
      "bathrooms",
    );

    validateOptionalNonNegative(
      input.sleeps,
      "sleeps",
    );

    validateOptionalPositive(
      input.squareFeet,
      "square feet",
    );

    validateOptionalYear(
      input.yearBuilt,
    );

    validateOptionalNonNegative(
      input.estimatedValue,
      "estimated value",
    );

    validateOptionalNonNegative(
      input.pricePerSquareFoot,
      "price per square foot",
    );

    validateOptionalNonNegative(
      input.daysOnMarket,
      "days on market",
    );

    validateOptionalCoordinate(
      input.latitude,
      -90,
      90,
      "latitude",
    );

    validateOptionalCoordinate(
      input.longitude,
      -180,
      180,
      "longitude",
    );

    validateOptionalRating(
      input.rating,
    );

    this.id = id;
    this.address = address;

    this.providerPropertyId =
      input.providerPropertyId
        ?.trim() ||
      undefined;

    this.propertyType =
      input.propertyType
        ?.trim() ||
      undefined;

    this.bedrooms =
      input.bedrooms;

    this.bathrooms =
      input.bathrooms;

    this.sleeps =
      input.sleeps;

    this.squareFeet =
      input.squareFeet;

    this.yearBuilt =
      input.yearBuilt;

    this.latitude =
      input.latitude;

    this.longitude =
      input.longitude;

    this.distanceMiles =
      input.distanceMiles;

    this.estimatedValue =
      input.estimatedValue;

    this.pricePerSquareFoot =
      input.pricePerSquareFoot;

    this.listedDate =
      input.listedDate;

    this.removedDate =
      input.removedDate;

    this.daysOnMarket =
      input.daysOnMarket;

    this.correlation =
      input.correlation;

    this.averageDailyRate =
      input.averageDailyRate;

    this.occupancy =
      input.occupancy;

    this.annualRevenue =
      input.annualRevenue;

    this.rating =
      input.rating;

    this.amenities =
      Object.freeze([
        ...(input.amenities ?? []),
      ]);

    this.listingUrl =
      input.listingUrl
        ?.trim() ||
      undefined;

    this.provenance =
      input.provenance;
  }
}

function validateOptionalNonNegative(
  value: number | undefined,
  label: string,
): void {
  if (
    value !== undefined &&
    (
      !Number.isFinite(value) ||
      value < 0
    )
  ) {
    throw new Error(
      `Comparable property ${label} must be a finite non-negative number.`,
    );
  }
}

function validateOptionalPositive(
  value: number | undefined,
  label: string,
): void {
  if (
    value !== undefined &&
    (
      !Number.isFinite(value) ||
      value <= 0
    )
  ) {
    throw new Error(
      `Comparable property ${label} must be a finite positive number.`,
    );
  }
}

function validateOptionalYear(
  value: number | undefined,
): void {
  if (
    value !== undefined &&
    (
      !Number.isInteger(value) ||
      value < 1600 ||
      value >
        new Date()
          .getFullYear() +
          1
    )
  ) {
    throw new Error(
      "Comparable property year built is invalid.",
    );
  }
}

function validateOptionalCoordinate(
  value: number | undefined,
  minimum: number,
  maximum: number,
  label: string,
): void {
  if (
    value !== undefined &&
    (
      !Number.isFinite(value) ||
      value < minimum ||
      value > maximum
    )
  ) {
    throw new Error(
      `Comparable property ${label} is invalid.`,
    );
  }
}

function validateOptionalRating(
  value: number | undefined,
): void {
  if (
    value !== undefined &&
    (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 5
    )
  ) {
    throw new Error(
      "Comparable property rating must be between 0 and 5.",
    );
  }
}
