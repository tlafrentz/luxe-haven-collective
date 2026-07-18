export interface ComparableSubjectInput {
  readonly id?: string;
  readonly address: string;
  readonly propertyType?: string;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly squareFeet?: number;
  readonly yearBuilt?: number;
  readonly latitude?: number;
  readonly longitude?: number;
}

export class ComparableSubject {
  readonly id?: string;
  readonly address: string;
  readonly propertyType?: string;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly squareFeet?: number;
  readonly yearBuilt?: number;
  readonly latitude?: number;
  readonly longitude?: number;

  constructor(input: ComparableSubjectInput) {
    const address = input.address.trim();
    if (!address) throw new Error("Comparable subject address is required.");
    validateOptionalNonNegative(input.bedrooms, "bedrooms");
    validateOptionalNonNegative(input.bathrooms, "bathrooms");
    validateOptionalPositive(input.squareFeet, "square feet");
    validateOptionalYear(input.yearBuilt);

    this.id = input.id?.trim() || undefined;
    this.address = address;
    this.propertyType = input.propertyType?.trim() || undefined;
    this.bedrooms = input.bedrooms;
    this.bathrooms = input.bathrooms;
    this.squareFeet = input.squareFeet;
    this.yearBuilt = input.yearBuilt;
    this.latitude = input.latitude;
    this.longitude = input.longitude;
  }
}

function validateOptionalNonNegative(value: number | undefined, label: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`Comparable subject ${label} must be a finite non-negative number.`);
  }
}

function validateOptionalPositive(value: number | undefined, label: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new Error(`Comparable subject ${label} must be a finite positive number.`);
  }
}

function validateOptionalYear(value: number | undefined): void {
  if (value !== undefined && (!Number.isInteger(value) || value < 1600 || value > new Date().getFullYear() + 1)) {
    throw new Error("Comparable subject year built is invalid.");
  }
}
