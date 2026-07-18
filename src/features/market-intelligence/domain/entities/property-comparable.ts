import { Money } from "@/features/investment-intelligence/domain/value-objects";

import { DataProvenance } from "../value-objects/data-provenance";

export interface PropertyComparableInput {
  readonly id: string;
  readonly address: string;
  readonly distanceMiles?: number;

  readonly propertyType?: string;

  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly squareFeet?: number;
  readonly yearBuilt?: number;

  readonly estimatedValue?: Money;
  readonly pricePerSquareFoot?: Money;

  readonly latitude?: number;
  readonly longitude?: number;

  readonly provenance: DataProvenance;
}

export class PropertyComparable {
  readonly id: string;
  readonly address: string;
  readonly distanceMiles?: number;

  readonly propertyType?: string;

  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly squareFeet?: number;
  readonly yearBuilt?: number;

  readonly estimatedValue?: Money;
  readonly pricePerSquareFoot?: Money;

  readonly latitude?: number;
  readonly longitude?: number;

  readonly provenance: DataProvenance;

  constructor(input: PropertyComparableInput) {
    const id = input.id.trim();
    const address = input.address.trim();

    if (!id) {
      throw new Error("Property comparable id is required.");
    }

    if (!address) {
      throw new Error("Property comparable address is required.");
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

    validateOptionalPositive(
      input.squareFeet,
      "square feet",
    );

    validateOptionalYear(
      input.yearBuilt,
    );

    this.id = id;
    this.address = address;
    this.distanceMiles =
      input.distanceMiles;

    this.propertyType =
      input.propertyType
        ?.trim() ||
      undefined;

    this.bedrooms =
      input.bedrooms;
    this.bathrooms =
      input.bathrooms;
    this.squareFeet =
      input.squareFeet;
    this.yearBuilt =
      input.yearBuilt;

    this.estimatedValue =
      input.estimatedValue;
    this.pricePerSquareFoot =
      input.pricePerSquareFoot;

    this.latitude =
      input.latitude;
    this.longitude =
      input.longitude;

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
      `Property comparable ${label} must be a finite non-negative number.`,
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
      `Property comparable ${label} must be a finite positive number.`,
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
      "Property comparable year built is invalid.",
    );
  }
}
