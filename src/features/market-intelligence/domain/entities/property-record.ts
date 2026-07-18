import type {
  DataProvenance,
} from "../value-objects/data-provenance";

export interface PropertyCoordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface PropertyAddress {
  readonly formatted: string;
  readonly addressLine1?: string;
  readonly city?: string;
  readonly state?: string;
  readonly postalCode?: string;
  readonly country?: string;
}

export interface PropertyCharacteristics {
  readonly propertyType?: string;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly squareFeet?: number;
  readonly lotSquareFeet?: number;
  readonly yearBuilt?: number;
}

export interface PropertyFinancialFacts {
  readonly estimatedValue?: number;
  readonly annualPropertyTaxes?: number;
  readonly lastSalePrice?: number;
  readonly lastSaleDate?: Date;
}

export class PropertyRecord {
  constructor(
    readonly id: string,
    readonly address: PropertyAddress,
    readonly characteristics: PropertyCharacteristics,
    readonly financialFacts: PropertyFinancialFacts,
    readonly provenance: DataProvenance,
    readonly coordinates?: PropertyCoordinates,
  ) {
    if (!id.trim()) {
      throw new Error(
        "Property record id is required.",
      );
    }

    if (!address.formatted.trim()) {
      throw new Error(
        "A formatted property address is required.",
      );
    }

    if (
      coordinates &&
      (
        !Number.isFinite(
          coordinates.latitude,
        ) ||
        coordinates.latitude < -90 ||
        coordinates.latitude > 90
      )
    ) {
      throw new Error(
        "Property latitude must be between -90 and 90.",
      );
    }

    if (
      coordinates &&
      (
        !Number.isFinite(
          coordinates.longitude,
        ) ||
        coordinates.longitude < -180 ||
        coordinates.longitude > 180
      )
    ) {
      throw new Error(
        "Property longitude must be between -180 and 180.",
      );
    }

    validateNonNegative(
      characteristics.bedrooms,
      "Bedrooms",
    );

    validateNonNegative(
      characteristics.bathrooms,
      "Bathrooms",
    );

    validateNonNegative(
      characteristics.squareFeet,
      "Square feet",
    );

    validateNonNegative(
      characteristics.lotSquareFeet,
      "Lot square feet",
    );

    validateNonNegative(
      financialFacts.estimatedValue,
      "Estimated value",
    );

    validateNonNegative(
      financialFacts.annualPropertyTaxes,
      "Annual property taxes",
    );

    validateNonNegative(
      financialFacts.lastSalePrice,
      "Last sale price",
    );
  }

  get hasCoordinates(): boolean {
    return this.coordinates !== undefined;
  }

  get hasPropertyFacts(): boolean {
    return (
      this.characteristics.bedrooms !==
        undefined ||
      this.characteristics.bathrooms !==
        undefined ||
      this.characteristics.squareFeet !==
        undefined ||
      this.characteristics.yearBuilt !==
        undefined
    );
  }

  get hasFinancialFacts(): boolean {
    return (
      this.financialFacts.estimatedValue !==
        undefined ||
      this.financialFacts
        .annualPropertyTaxes !== undefined ||
      this.financialFacts.lastSalePrice !==
        undefined
    );
  }
}

function validateNonNegative(
  value: number | undefined,
  label: string,
): void {
  if (value === undefined) {
    return;
  }

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      `${label} must be a finite, non-negative number.`,
    );
  }
}
