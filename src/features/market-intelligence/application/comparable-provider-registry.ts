import {
  ProviderType,
} from "../domain/enums/provider-type";

import type {
  ComparableProvider,
} from "./providers/comparable-provider";

export class ComparableProviderRegistry {
  private readonly providers =
    new Map<
      ProviderType,
      ComparableProvider
    >();

  register(
    providerType: ProviderType,
    provider: ComparableProvider,
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
  ): ComparableProvider {
    const provider =
      this.providers.get(
        providerType,
      );

    if (!provider) {
      throw new Error(
        `No comparable provider is registered for "${providerType}".`,
      );
    }

    return provider;
  }

  getAll():
    readonly ComparableProvider[] {
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
