import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ControlledGuidebookPropertyService,
  controlledProvisioningGate,
} from "./controlled-guidebook-property";

describe("controlled Guidebook property owning-domain service", () => {
  afterEach(() => {
    delete process.env.CONTROLLED_GUIDEBOOK_PROVISIONING_ENABLED;
    delete process.env.CONTROLLED_GUIDEBOOK_PROVISIONING_KILL_SWITCH;
    delete process.env.CONTROLLED_GUIDEBOOK_PROVISIONING_COHORT;
  });

  it("fails closed unless enabled, not killed, and explicitly cohorted", () => {
    process.env.CONTROLLED_GUIDEBOOK_PROVISIONING_ENABLED = "true";
    process.env.CONTROLLED_GUIDEBOOK_PROVISIONING_COHORT = "admin-a";
    expect(controlledProvisioningGate("admin-a")).toBe(true);
    expect(controlledProvisioningGate("admin-b")).toBe(false);
    process.env.CONTROLLED_GUIDEBOOK_PROVISIONING_KILL_SWITCH = "true";
    expect(controlledProvisioningGate("admin-a")).toBe(false);
  });

  it("uses the canonical RPC and preserves its idempotent replay result", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        propertyId: "property",
        allocationId: "allocation",
        entitlementId: "grant",
        replayed: true,
      },
      error: null,
    });
    const service = new ControlledGuidebookPropertyService({ rpc } as never);
    await expect(
      service.provision({
        customerAccountId: "customer",
        entitlementId: "grant",
        internalName: "Controlled Property",
        publicDisplayName: "Controlled Guidebook Property",
        propertyType: "vacation_rental",
        city: "Verification City",
        region: "TX",
        timeZone: "America/Chicago",
        controlledVerification: true,
        reason: "Controlled production verification",
        idempotencyKey: "controlled-property-1",
        expectedCustomerStatus: "active",
        expectedEntitlementRevision: 1,
        verificationRunId: "run",
      }),
    ).resolves.toMatchObject({ propertyId: "property", replayed: true });
    expect(rpc).toHaveBeenCalledWith(
      "provision_guidebook_property_for_customer",
      expect.objectContaining({
        p_customer_account_id: "customer",
        p_entitlement_id: "grant",
        p_controlled_verification: true,
      }),
    );
  });

  it("uses the owning-domain cleanup command", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        propertyId: "property",
        allocationId: "allocation",
        released: true,
      },
      error: null,
    });
    const service = new ControlledGuidebookPropertyService({ rpc } as never);
    await service.cleanup({
      propertyId: "property",
      reason: "Controlled verification complete",
      expectedAllocationRevision: 1,
    });
    expect(rpc).toHaveBeenCalledWith(
      "cleanup_controlled_guidebook_property",
      expect.objectContaining({ p_property_id: "property" }),
    );
  });
});
