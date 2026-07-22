import { describe, expect, it, vi } from "vitest";
import { ProviderType } from "../domain/enums/provider-type";
import type { ComparableProvider } from "./providers/comparable-provider";
import { ComparableProviderFactory } from "./comparable-provider-factory";

describe("ComparableProviderFactory", () => {
  it("constructs a registered provider without importing its infrastructure adapter", () => {
    const provider = {} as ComparableProvider;
    const create = vi.fn(() => provider);
    const factory = new ComparableProviderFactory({ providers: { [ProviderType.RentCast]: create } });
    expect(factory.create(ProviderType.RentCast)).toBe(provider);
    expect(create).toHaveBeenCalledOnce();
  });

  it("rejects an unsupported provider", () => {
    const factory = new ComparableProviderFactory({ providers: {} });
    expect(() => factory.create(ProviderType.MLS)).toThrow('Comparable provider "MLS" is not supported.');
  });
});
