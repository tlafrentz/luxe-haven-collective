import { Money } from "@/features/investment-intelligence/domain/value-objects";
import { Percentage } from "@/features/investment-intelligence/domain/value-objects";

import { DataProvenance } from "../value-objects/data-provenance";

export class ComparableProperty {
  constructor(
    readonly id: string,
    readonly address: string,
    readonly distanceMiles: number,

    readonly bedrooms: number,
    readonly bathrooms: number,
    readonly sleeps: number,

    readonly averageDailyRate: Money,
    readonly occupancy: Percentage,
    readonly annualRevenue: Money,

    readonly rating: number | undefined,
    readonly amenities: readonly string[],

    readonly listingUrl: string | undefined,

    readonly provenance: DataProvenance,
  ) {}
}
