import { describe, expect, it } from "vitest";
import { observePropertyProviderResult } from "../providers/canonical-provider-observations";
import { providerSuccess } from "../providers/provider-result";
import { PropertyRecord } from "../../domain/entities/property-record";
import { DataProvenance } from "../../domain/value-objects/data-provenance";
import { ConfidenceScore } from "../../domain/value-objects/confidence-score";
import { ProviderType } from "../../domain/enums/provider-type";

describe("canonical provider observations", () => {
  it("preserves provider provenance on Platform Observations", () => {
    const retrievedAt = new Date("2026-07-19T12:00:00Z");
    const property = new PropertyRecord("property-1", { formatted: "123 Main St" }, {}, {}, new DataProvenance(ProviderType.RentCast, retrievedAt, new ConfidenceScore(85), 10));
    const observed = observePropertyProviderResult(providerSuccess(property), retrievedAt);
    const observation = observed.observations.toArray()[0];

    expect(observation.source.name).toBe(ProviderType.RentCast);
    expect(observation.metadata).toMatchObject({ provider: ProviderType.RentCast, confidence: 85, sampleSize: 10 });
  });
});
