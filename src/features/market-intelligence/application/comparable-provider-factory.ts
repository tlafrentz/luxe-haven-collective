import {
  ProviderType,
} from "../domain/enums/provider-type";

import {
  RentCastClient,
} from "../infrastructure/rentcast/rentcast-client";

import {
  RentCastComparableProvider,
} from "../infrastructure/rentcast/rentcast-comparable-provider";

import type {
  ComparableProvider,
} from "./providers/comparable-provider";

export interface ComparableProviderFactoryDependencies {
  readonly rentCastApiKey?: string;
  readonly rentCastBaseUrl?: string;
  readonly rentCastTimeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

export class ComparableProviderFactory {
  private readonly dependencies:
    ComparableProviderFactoryDependencies;

  constructor(
    dependencies:
      ComparableProviderFactoryDependencies,
  ) {
    this.dependencies =
      dependencies;
  }

  create(
    providerType: ProviderType,
  ): ComparableProvider {
    switch (providerType) {
      case ProviderType.RentCast:
        return this.createRentCastProvider();

      default:
        throw new Error(
          `Comparable provider "${providerType}" is not supported.`,
        );
    }
  }

  private createRentCastProvider():
    ComparableProvider {
    const apiKey =
      this.dependencies
        .rentCastApiKey
        ?.trim();

    if (!apiKey) {
      throw new Error(
        "RENTCAST_API_KEY is required to create the RentCast comparable provider.",
      );
    }

    return new RentCastComparableProvider({
      client:
        new RentCastClient({
          apiKey,
          baseUrl:
            this.dependencies
              .rentCastBaseUrl,
          timeoutMs:
            this.dependencies
              .rentCastTimeoutMs,
          fetchImplementation:
            this.dependencies
              .fetchImplementation,
        }),
    });
  }
}
