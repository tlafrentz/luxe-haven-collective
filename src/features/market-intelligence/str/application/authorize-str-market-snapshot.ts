import type { StrMarketSnapshot, StrMarketSnapshotRepository } from "../domain";

export interface AuthorizedMarketSnapshotReference {
  readonly analysisId: string;
  readonly subjectPropertySnapshotId: string;
  readonly marketSnapshotId: string;
  readonly assumptionVersion: string;
  readonly confidenceVersion: string;
  readonly comparablePolicyVersion: string;
}

export class MarketSnapshotAuthorizationError extends Error {
  constructor(readonly code: "NOT_FOUND" | "ACCESS_DENIED" | "INCOMPATIBLE") {
    super(code === "INCOMPATIBLE" ? "The selected market evidence is not compatible with this analysis."
      : "The selected market evidence is unavailable or you are not authorized to access it.");
    this.name = "MarketSnapshotAuthorizationError";
  }
}

export async function authorizeStrMarketSnapshot(input: {
  readonly snapshotId: string; readonly ownerId: string; readonly workspaceId: string;
  readonly property: { readonly propertyType?: string; readonly bedrooms?: number; readonly bathrooms?: number };
}, repository: StrMarketSnapshotRepository): Promise<StrMarketSnapshot> {
  const snapshot = await repository.findById(input.snapshotId, { ownerId: input.ownerId, workspaceId: input.workspaceId });
  if (!snapshot) throw new MarketSnapshotAuthorizationError("ACCESS_DENIED");
  const expected = input.property, actual = snapshot.query.property;
  if (expected.propertyType && actual.propertyType && normalize(expected.propertyType) !== normalize(actual.propertyType)) throw new MarketSnapshotAuthorizationError("INCOMPATIBLE");
  if (expected.bedrooms !== undefined && actual.bedrooms !== undefined && expected.bedrooms !== actual.bedrooms) throw new MarketSnapshotAuthorizationError("INCOMPATIBLE");
  if (expected.bathrooms !== undefined && actual.bathrooms !== undefined && Math.abs(expected.bathrooms - actual.bathrooms) > 1) throw new MarketSnapshotAuthorizationError("INCOMPATIBLE");
  return snapshot;
}

export function buildAuthorizedMarketSnapshotReference(snapshot: StrMarketSnapshot, analysisId: string): AuthorizedMarketSnapshotReference {
  return Object.freeze({
    analysisId, subjectPropertySnapshotId: snapshot.subjectPropertySnapshotId, marketSnapshotId: snapshot.id,
    assumptionVersion: "str-assumptions.v1", confidenceVersion: "str-confidence.v1",
    comparablePolicyVersion: snapshot.comparablePolicyVersion,
  });
}
const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
