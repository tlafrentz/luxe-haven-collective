import type {
  PropertyProvider,
} from "./providers/property-provider";

import {
  ProviderType,
} from "../domain/enums/provider-type";

import {
  RentCastClient,
} from "../infrastructure/rentcast/rentcast-client";

import {
  RentCastPropertyProvider,
} from "../infrastructure/rentcast/rentcast-property-provider";

export interface PropertyProviderFactoryDependencies {
  readonly rentCastApiKey?: string;
  readonly rentCastBaseUrl?: string;
  readonly rentCastTimeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

export class PropertyProviderFactory {
  private readonly dependencies:
    PropertyProviderFactoryDependencies;

  constructor(
    dependencies:
      PropertyProviderFactoryDependencies,
  ) {
    this.dependencies =
      dependencies;
  }

  create(
    providerType: ProviderType,
  ): PropertyProvider {
    switch (providerType) {
      case ProviderType.RentCast:
        return this.createRentCastProvider();

      default:
        throw new Error(
          `Property provider "${providerType}" is not supported.`,
        );
    }
  }

  private createRentCastProvider():
    PropertyProvider {
    const apiKey =
      this.dependencies
        .rentCastApiKey
        ?.trim();

    if (!apiKey) {
      throw new Error(
        "RENTCAST_API_KEY is required to create the RentCast property provider.",
      );
    }

    const client =
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
      });

    return new RentCastPropertyProvider({
      client,
    });
  }
}

export function createPropertyProviderFactoryFromEnvironment(
  environment:
    NodeJS.ProcessEnv =
      process.env,
): PropertyProviderFactory {
  return new PropertyProviderFactory({
    rentCastApiKey:
      environment
        .RENTCAST_API_KEY,
    rentCastBaseUrl:
      environment
        .RENTCAST_BASE_URL,
  });
}
