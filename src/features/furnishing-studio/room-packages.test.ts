import { describe, expect, it } from "vitest";
import {
  calculatePackageBudget,
  canTransitionPackage,
  comparePackageSnapshots,
  validateGuestCapacity,
  validatePackagePriority,
  validatePackageQuantity,
  validateTvMounts,
} from "./room-packages";

describe("FS-UX-004 room-package contract", () => {
  it("accepts essential and rejects required as priority", () => {
    expect(validatePackagePriority("essential")).toBe("essential");
    expect(() => validatePackagePriority("required")).toThrow(
      "ROOM_PACKAGE_PRIORITY_INVALID",
    );
  });

  it("requires positive integral quantities", () => {
    expect(validatePackageQuantity(2)).toBe(2);
    expect(() => validatePackageQuantity(0)).toThrow();
    expect(() => validatePackageQuantity(1.5)).toThrow();
  });

  it("excludes alternatives and preserves explicit cost categories", () => {
    expect(
      calculatePackageBudget(
        [
          { quantity: 2, unitPriceMinor: 10_000, deliveryMinor: 500 },
          { quantity: 1, unitPriceMinor: 99_000, isAlternative: true },
        ],
        1_000,
      ),
    ).toEqual({
      productSubtotalMinor: 20_000,
      deliveryMinor: 1_000,
      assemblyMinor: 0,
      installationMinor: 0,
      contingencyMinor: 2_100,
      estimatedTotalMinor: 23_100,
      missingPriceCount: 0,
    });
  });

  it("classifies capacity deficiencies by policy", () => {
    expect(
      validateGuestCapacity({
        maximumGuests: 6,
        sleepingCapacity: 4,
        diningSeats: 4,
        livingSeats: 6,
        towelSets: 5,
      }),
    ).toEqual([
      { code: "SLEEPING_CAPACITY_INSUFFICIENT", severity: "blocking" },
      { code: "DINING_CAPACITY_INSUFFICIENT", severity: "warning" },
      { code: "TOWEL_CAPACITY_INSUFFICIENT", severity: "warning" },
    ]);
  });

  it("requires a compatible mount in each television room", () => {
    expect(
      validateTvMounts([
        { roomId: "living", kind: "television", tvSizeInches: 65 },
        {
          roomId: "living",
          kind: "mount",
          mountMinimumInches: 32,
          mountMaximumInches: 55,
        },
      ])[0]?.code,
    ).toBe("TELEVISION_MOUNT_INCOMPATIBLE");
  });

  it("allows only governed lifecycle transitions", () => {
    expect(canTransitionPackage("draft", "in_review")).toBe(true);
    expect(canTransitionPackage("approved", "draft")).toBe(false);
    expect(canTransitionPackage("approved", "retired")).toBe(true);
  });

  it("produces stable field-level revision comparisons", () => {
    expect(comparePackageSnapshots({ name: "A", guests: 4 }, { name: "A", guests: 6 })).toEqual([
      { field: "guests", before: 4, after: 6 },
    ]);
  });
});
