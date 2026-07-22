import type {
  ComparableProperty,
} from "../domain/entities/comparable-property";

import {
  ProviderType,
} from "../domain/enums/provider-type";

import type {
  ComparableLookupRequest,
} from "./providers/comparable-provider";

import type {
  ProviderResult,
} from "./providers/provider-result";

import {
  ComparableProviderRegistry,
} from "./comparable-provider-registry";
import { observeComparableProviderResult, type ObservedProviderResult } from "./providers/canonical-provider-observations";

export interface LookupComparablesInput
extends ComparableLookupRequest {
  readonly provider?: ProviderType;
}

export interface LookupComparablesDependencies {
  readonly registry:
    ComparableProviderRegistry;
  readonly defaultProvider?:
    ProviderType;
}

/** @deprecated Use acquireMarketComparables for factual, purpose-specific acquisition. */
export class LookupComparables {
  private readonly registry:
    ComparableProviderRegistry;

  private readonly defaultProvider:
    ProviderType;

  constructor(
    dependencies:
      LookupComparablesDependencies,
  ) {
    this.registry =
      dependencies.registry;

    this.defaultProvider =
      dependencies.defaultProvider ??
      ProviderType.RentCast;
  }

  async execute(
    input: LookupComparablesInput,
  ): Promise<
    ProviderResult<
      readonly ComparableProperty[]
    >
  > {
    const address =
      input.address.trim();

    if (!address) {
      throw new Error(
        "A property address is required.",
      );
    }

    const provider =
      this.registry.get(
        input.provider ??
          this.defaultProvider,
      );

    return provider.getComparables({
      address,
      latitude:
        input.latitude,
      longitude:
        input.longitude,
      bedrooms:
        input.bedrooms,
      bathrooms:
        input.bathrooms,
      squareFeet:
        input.squareFeet,
      radiusMiles:
        input.radiusMiles,
      limit:
        input.limit,
    });
  }

  async executeObserved(input: LookupComparablesInput): Promise<ObservedProviderResult<readonly ComparableProperty[]>> {
    return observeComparableProviderResult(await this.execute(input));
  }
}

/** @deprecated Use acquireMarketComparables for factual, purpose-specific acquisition. */
export async function lookupComparables(
  dependencies:
    LookupComparablesDependencies,
  input:
    LookupComparablesInput,
): Promise<
  ProviderResult<
    readonly ComparableProperty[]
  >
> {
  return new LookupComparables(
    dependencies,
  ).execute(input);
}
