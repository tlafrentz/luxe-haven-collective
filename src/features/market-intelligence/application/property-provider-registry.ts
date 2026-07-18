import type {
  PropertyProvider,
} from "./providers/property-provider";

import {
  getProviderDisplayName,
  ProviderType,
} from "../domain/enums/provider-type";

export class PropertyProviderRegistry {
  private readonly providers =
    new Map<
      ProviderType,
      PropertyProvider
    >();

  register(
    providerType: ProviderType,
    provider: PropertyProvider,
  ): void {
    this.providers.set(
      providerType,
      provider,
    );
  }

  has(
    providerType: ProviderType,
  ): boolean {
    return this.providers.has(
      providerType,
    );
  }

  get(
    providerType: ProviderType,
  ): PropertyProvider {
    const provider =
      this.providers.get(
        providerType,
      );

    if (!provider) {
      throw new Error(
        `No property provider is registered for "${getProviderDisplayName(providerType)}".`,
      );
    }

    return provider;
  }

  getAll():
    readonly PropertyProvider[] {
    return [
      ...this.providers.values(),
    ];
  }

  getRegisteredTypes():
    readonly ProviderType[] {
    return [
      ...this.providers.keys(),
    ];
  }
}
