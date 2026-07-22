import { describe, expect, it, vi } from "vitest";
import { ProviderType } from "../domain/enums/provider-type";
import type { PropertyProvider } from "./providers/property-provider";
import { PropertyProviderFactory } from "./property-provider-factory";

describe("PropertyProviderFactory", () => {
  it("constructs a registered provider without importing its infrastructure adapter", () => {
    const provider = {} as PropertyProvider;
    const create = vi.fn(() => provider);
    const factory = new PropertyProviderFactory({ providers: { [ProviderType.RentCast]: create } });
    expect(factory.create(ProviderType.RentCast)).toBe(provider);
    expect(create).toHaveBeenCalledOnce();
  });

  it("rejects an unsupported provider", () => {
    const factory = new PropertyProviderFactory({ providers: {} });
    expect(() => factory.create(ProviderType.MLS)).toThrow('Property provider "MLS" is not supported.');
  });
});
