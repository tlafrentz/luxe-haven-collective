import { describe, expect, it } from "vitest";

import { ObservationUnit } from "./observation-unit";

describe("ObservationUnit", () => {
  it("creates a currency unit", () => {
    const unit = ObservationUnit.create({
      type: "currency",
      symbol: "USD",
    });

    expect(unit.type).toBe("currency");
    expect(unit.symbol).toBe("USD");
  });

  it("creates a unit without a symbol", () => {
    const unit = ObservationUnit.create({
      type: "percentage",
    });

    expect(unit.type).toBe("percentage");
    expect(unit.symbol).toBeUndefined();
  });
});
