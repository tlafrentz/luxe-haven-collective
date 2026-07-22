import { getProviderDisplayName, type ProviderType } from "../domain/enums/provider-type";
import type { ComparableProvider } from "./providers/comparable-provider";

export interface ComparableProviderFactoryDependencies {
  readonly providers: Readonly<Partial<Record<ProviderType, () => ComparableProvider>>>;
}

/** Provider-neutral application factory. Concrete adapter construction belongs to Infrastructure. */
export class ComparableProviderFactory {
  constructor(private readonly dependencies: ComparableProviderFactoryDependencies) {}

  create(providerType: ProviderType): ComparableProvider {
    const createProvider = this.dependencies.providers[providerType];
    if (!createProvider) throw new Error(`Comparable provider "${getProviderDisplayName(providerType)}" is not supported.`);
    return createProvider();
  }
}
