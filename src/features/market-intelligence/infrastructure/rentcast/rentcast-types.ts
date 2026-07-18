export interface RentCastTaxAssessment {
  readonly year?: number;
  readonly value?: number;
  readonly land?: number;
  readonly improvements?: number;
}

export interface RentCastPropertyTax {
  readonly year?: number;
  readonly total?: number;
}

export interface RentCastPropertyRecord {
  readonly id?: string;
  readonly formattedAddress?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string | null;
  readonly city?: string;
  readonly state?: string;
  readonly zipCode?: string;
  readonly latitude?: number;
  readonly longitude?: number;

  readonly propertyType?: string;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly squareFootage?: number;
  readonly lotSize?: number;
  readonly yearBuilt?: number;

  readonly lastSaleDate?: string;
  readonly lastSalePrice?: number;

  readonly taxAssessments?: Readonly<
    Record<
      string,
      RentCastTaxAssessment | undefined
    >
  >;

  readonly propertyTaxes?: Readonly<
    Record<
      string,
      RentCastPropertyTax | undefined
    >
  >;
}

export type RentCastPropertyResponse =
  readonly RentCastPropertyRecord[];
