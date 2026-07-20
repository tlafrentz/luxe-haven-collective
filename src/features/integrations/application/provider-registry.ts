import type { ProviderCapability, ProviderDescriptor } from "../domain";

/** Capability discovery only; this registry contains no business policy. */
export class IntegrationProviderRegistry implements Iterable<ProviderDescriptor> {
  private readonly providers = new Map<string, ProviderDescriptor>();

  public register(provider: ProviderDescriptor): this {
    const id = provider.id.trim();
    if (!id) throw new TypeError("Integration provider id cannot be empty.");
    if (this.providers.has(id)) throw new RangeError(`Integration provider already registered: ${id}.`);
    this.providers.set(id, Object.freeze({ ...provider, id, capabilities: Object.freeze([...new Set(provider.capabilities)]) }));
    return this;
  }

  public get(id: string): ProviderDescriptor | undefined { return this.providers.get(id); }
  public require(id: string): ProviderDescriptor { const provider = this.get(id); if (!provider) throw new RangeError(`Integration provider not found: ${id}.`); return provider; }
  public supporting(capability: ProviderCapability): readonly ProviderDescriptor[] { return Object.freeze([...this.providers.values()].filter((provider) => provider.capabilities.includes(capability))); }
  public [Symbol.iterator](): Iterator<ProviderDescriptor> { return this.providers.values(); }
}

export const DEFAULT_INTEGRATION_PROVIDERS = new IntegrationProviderRegistry()
  .register({ id: "hospitable", displayName: "Hospitable", capabilities: ["read-properties", "read-reservations"], normalizationVersion: "hospitable-v1" })
  .register({ id: "rentcast", displayName: "RentCast", capabilities: ["read-properties", "provide-comparables", "provide-valuations"], normalizationVersion: "rentcast-v1" });
