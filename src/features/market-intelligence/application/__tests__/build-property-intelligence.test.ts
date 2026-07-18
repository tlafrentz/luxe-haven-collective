import { ProviderType } from "../../domain/enums/provider-type";
import { describe, expect, it } from "vitest";

import { buildPropertyIntelligence } from "../builders/build-property-intelligence";
import { PropertyRecord } from "../../domain/entities/property-record";
import { ConfidenceScore } from "../../domain/value-objects/confidence-score";
import {
  DataProvenance,
} from "../../domain/value-objects/data-provenance";

describe("buildPropertyIntelligence", () => {
  it("builds property conclusions from a normalized property record", () => {
    const property = new PropertyRecord(
      "property-1",
      { formatted: "123 Main Street, Mesa, AZ" },
      {
        propertyType: "single-family",
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1800,
        yearBuilt: 2020,
      },
      { estimatedValue: 450000, annualPropertyTaxes: 4200 },
      new DataProvenance(
      ProviderType.RentCast,
        new Date("2026-07-18"),
        new ConfidenceScore(90),
      ),
      { latitude: 33.4152, longitude: -111.8315 },
    );

    const intelligence = buildPropertyIntelligence({
      property,
      valuation: {
        low: 425000,
        estimated: 450000,
        high: 475000,
        currency: "USD",
      },
      propertyScore: 82,
      confidenceScore: 88,
    });

    expect(intelligence.propertyId).toBe("property-1");
    expect(intelligence.hasCompletePhysicalProfile).toBe(true);
    expect(intelligence.hasValuation).toBe(true);
    expect(intelligence.estimatedPricePerSquareFoot).toBe(250);
    expect(intelligence.missingInformation).toEqual([]);
  });

  it("records missing physical facts", () => {
    const property = new PropertyRecord(
      "property-2",
      { formatted: "456 Main Street, Mesa, AZ" },
      {},
      {},
      new DataProvenance(
        ProviderType.Manual,
        new Date("2026-07-18"),
        new ConfidenceScore(30),
      ),
    );

    const intelligence = buildPropertyIntelligence({
      property,
      propertyScore: 35,
      confidenceScore: 30,
    });

    expect(intelligence.hasMaterialUnknowns).toBe(true);
    expect(intelligence.missingInformation).toContain("Living area");
    expect(intelligence.weaknesses).toContain(
      "No property valuation evidence is available.",
    );
  });
});
