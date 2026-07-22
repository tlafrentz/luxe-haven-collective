import type { PropertyProvider } from "./providers/property-provider";
import { getProviderDisplayName, type ProviderType } from "../domain/enums/provider-type";

export interface PropertyProviderFactoryDependencies {
  readonly providers: Readonly<Partial<Record<ProviderType, () => PropertyProvider>>>;
}

/** Provider-neutral application factory. Concrete adapter construction belongs to Infrastructure. */
export class PropertyProviderFactory {
  constructor(private readonly dependencies: PropertyProviderFactoryDependencies) {}

  create(providerType: ProviderType): PropertyProvider {
    const createProvider = this.dependencies.providers[providerType];
    if (!createProvider) throw new Error(`Property provider "${getProviderDisplayName(providerType)}" is not supported.`);
    return createProvider();
  }
}
