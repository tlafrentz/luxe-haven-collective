import { PropertyType } from "../enums";
import type { Location, Money } from "../value-objects";

export interface PropertyProfile {
  readonly id: string;
  readonly location: Location;
  readonly purchasePrice: Money;
  readonly closingCosts: Money;
  readonly furnishingBudget: Money;
  readonly propertyType: PropertyType;
  readonly bedrooms: number;
  readonly bathrooms: number;
  readonly squareFeet?: number;
  readonly yearBuilt?: number;
  readonly hoa?: Money;
}
