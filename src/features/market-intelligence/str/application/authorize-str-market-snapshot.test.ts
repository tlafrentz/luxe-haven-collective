import { describe, expect, it } from "vitest";
import { InMemoryStrMarketSnapshotRepository } from "../infrastructure/str-market-snapshot-repository";
import type { StrMarketSnapshot } from "../domain";
import { authorizeStrMarketSnapshot, buildAuthorizedMarketSnapshotReference } from "./authorize-str-market-snapshot";

const snapshot = {
  id: "8bc50366-f492-4b82-a8eb-f74d55aa8918", ownerId: "owner-1", workspaceId: "workspace-1",
  subjectPropertyId: "subject-1", subjectPropertySnapshotId: "property-1", provider: "airroi",
  providerSnapshotReferences: [], schemaVersion: "str-market-snapshot.v1", providerVersion: "v1",
  queryPolicyVersion: "query-v1", comparablePolicyVersion: "comparable-v1", createdAt: "2026-07-29T00:00:00.000Z",
  expiresAt: "2026-08-29T00:00:00.000Z", query: { subjectPropertyId: "subject-1", subjectPropertySnapshotId: "property-1",
    location: { latitude: 1, longitude: 1 }, property: { propertyType: "single family", bedrooms: 3, bathrooms: 2 },
    requestedAt: "2026-07-29T00:00:00.000Z", missingInputs: [] }, comparables: [],
  confidence: { score: 70, level: "moderate", components: [], limitations: [] }, completeness: "partial",
  evidence: [], evidenceIds: [], warnings: [], relaxedRules: [],
} satisfies StrMarketSnapshot;

describe("authorized canonical market snapshot resolution", () => {
  it("returns the immutable owner-scoped snapshot and a reference-only token contract", async () => {
    const repository = new InMemoryStrMarketSnapshotRepository(); await repository.save(snapshot);
    const resolved = await authorizeStrMarketSnapshot({ snapshotId: snapshot.id, ownerId: "owner-1", workspaceId: "workspace-1",
      property: { propertyType: "Single-Family", bedrooms: 3, bathrooms: 2 } }, repository);
    const reference = buildAuthorizedMarketSnapshotReference(resolved, "analysis-1");
    expect(reference).toEqual({ analysisId: "analysis-1", subjectPropertySnapshotId: "property-1", marketSnapshotId: snapshot.id,
      assumptionVersion: "str-assumptions.v1", confidenceVersion: "str-confidence.v1", comparablePolicyVersion: "comparable-v1" });
    expect(JSON.stringify(reference)).not.toContain("comparables");
    expect(JSON.stringify(reference)).not.toContain("evidence");
  });
  it("denies a different owner or workspace without revealing existence", async () => {
    const repository = new InMemoryStrMarketSnapshotRepository(); await repository.save(snapshot);
    await expect(authorizeStrMarketSnapshot({ snapshotId: snapshot.id, ownerId: "owner-2", workspaceId: "workspace-1", property: {} }, repository))
      .rejects.toMatchObject({ code: "ACCESS_DENIED" });
    await expect(authorizeStrMarketSnapshot({ snapshotId: snapshot.id, ownerId: "owner-1", workspaceId: "workspace-2", property: {} }, repository))
      .rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });
  it("rejects incompatible property configuration", async () => {
    const repository = new InMemoryStrMarketSnapshotRepository(); await repository.save(snapshot);
    await expect(authorizeStrMarketSnapshot({ snapshotId: snapshot.id, ownerId: "owner-1", workspaceId: "workspace-1",
      property: { propertyType: "condo", bedrooms: 1 } }, repository)).rejects.toMatchObject({ code: "INCOMPATIBLE" });
  });
});
