import type {
  PropertyRecord,
} from "../domain/entities/property-record";

import {
  ProviderType,
} from "../domain/enums/provider-type";

import type {
  PropertyProvider,
} from "./providers/property-provider";

import type {
  ProviderResult,
} from "./providers/provider-result";

import {
  PropertyProviderRegistry,
} from "./property-provider-registry";
import { observePropertyProviderResult, type ObservedProviderResult } from "./providers/canonical-provider-observations";

export interface LookupPropertyInput {
  readonly address: string;
  readonly provider?:
    ProviderType;
}

export interface LookupPropertyDependencies {
  readonly registry:
    PropertyProviderRegistry;
  readonly defaultProvider?:
    ProviderType;
}

/** @deprecated Use resolveMarketProperty for ambiguity-safe subject resolution. */
export class LookupProperty {
  private readonly registry:
    PropertyProviderRegistry;

  private readonly defaultProvider:
    ProviderType;

  constructor(
    dependencies:
      LookupPropertyDependencies,
  ) {
    this.registry =
      dependencies.registry;

    this.defaultProvider =
      dependencies.defaultProvider ??
      ProviderType.RentCast;
  }

  async execute(
    input: LookupPropertyInput,
  ): Promise<
    ProviderResult<PropertyRecord>
  > {
    const address =
      input.address.trim();

    if (!address) {
      throw new Error(
        "A property address is required.",
      );
    }

    const provider =
      this.resolveProvider(
        input.provider,
      );

    return provider.getProperty({
      address,
    });
  }

  async executeObserved(input: LookupPropertyInput): Promise<ObservedProviderResult<PropertyRecord>> {
    return observePropertyProviderResult(await this.execute(input));
  }

  private resolveProvider(
    providerType:
      | ProviderType
      | undefined,
  ): PropertyProvider {
    return this.registry.get(
      providerType ??
        this.defaultProvider,
    );
  }
}

/** @deprecated Use resolveMarketProperty for ambiguity-safe subject resolution. */
export async function lookupProperty(
  dependencies:
    LookupPropertyDependencies,
  input:
    LookupPropertyInput,
): Promise<
  ProviderResult<PropertyRecord>
> {
  return new LookupProperty(
    dependencies,
  ).execute(input);
}
