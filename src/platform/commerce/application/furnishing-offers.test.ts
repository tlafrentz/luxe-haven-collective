import { describe, expect, it } from "vitest";
import { resolveApprovedFurnishingOffer, type FurnishingProviderReference } from "./furnishing-offers";

const provider: FurnishingProviderReference = { productId: "prod_fs_test", priceId: "price_fs_test", accountMode: "test" };
const activation = { globalKillSwitch: false, globalState: "internal" as const, workspaceKillSwitch: false, workspaceEnabled: true, cohortEligible: true, capabilityEnabled: true, configurationValid: true, policyVersion: "fs008a-v1" };
const actor = { role: "customer" as const, userId: "u1", tenantId: "t1" };
const input = (offerId: string, extra: Record<string, unknown> = {}) => ({ offerId, actor, activation, resolveActivation: (context: any) => ({ allowed: !context.globalKillSwitch && context.globalState !== "disabled" && !context.workspaceKillSwitch && context.workspaceEnabled && context.cohortEligible && context.capabilityEnabled, reason: "enabled" }), providerReferences: { "FS-CONSULT": provider, "FS-DESIGN": provider }, ...extra } as Parameters<typeof resolveApprovedFurnishingOffer>[0]);

describe("FS-008B P2.1 approved Furnishing offer registry", () => {
  it.each(["FS-CONSULT", "FS-DESIGN"])("resolves complete approved %s", (offerId) => {
    const result = resolveApprovedFurnishingOffer(input(offerId));
    expect(result.allowed).toBe(true);
    expect(result.offer?.productFamily).toBe("furnishing");
    expect(result.offer?.providerReference.priceId).toBe("price_fs_test");
  });
  it("keeps FS-FULL deferred and unavailable", () => expect(resolveApprovedFurnishingOffer(input("FS-FULL")).reason).toBe("offer_not_approved"));
  it.each(["unknown", "commerce-offer-furnishing-essential"])("rejects unknown or legacy %s", offerId => expect(resolveApprovedFurnishingOffer(input(offerId)).allowed).toBe(false));
  it("rejects missing provider mapping and never creates an effect", () => expect(resolveApprovedFurnishingOffer({ ...input("FS-CONSULT"), providerReferences: {} }).reason).toBe("provider_reference_missing"));
  it("rejects stale and unknown versions", () => {
    expect(resolveApprovedFurnishingOffer(input("FS-CONSULT", { requestedVersion: 0 })).reason).toBe("version_stale");
    expect(resolveApprovedFurnishingOffer(input("FS-CONSULT", { requestedVersion: 2 })).reason).toBe("version_not_found");
  });
  it.each([{ globalKillSwitch: true }, { workspaceKillSwitch: true }, { cohortEligible: false }, { capabilityEnabled: false }])("honors activation denial %o", override => expect(resolveApprovedFurnishingOffer({ ...input("FS-CONSULT"), activation: { ...activation, ...override } }).allowed).toBe(false));
  it("returns only a customer-safe projection", () => {
    const projection = resolveApprovedFurnishingOffer(input("FS-CONSULT")).customerProjection!;
    expect(projection).not.toHaveProperty("providerReference");
    expect(projection).not.toHaveProperty("provenance");
    expect(projection.priceMinor).toBe(24900);
  });
  it("does not change unrelated Commerce behavior", () => expect(resolveApprovedFurnishingOffer(input("GB-SELF")).reason).toBe("offer_not_approved"));
});
