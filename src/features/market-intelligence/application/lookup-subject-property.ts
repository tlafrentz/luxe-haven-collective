import { normalizeMarketAddress } from "./normalize-market-address";
import type { MarketPropertyLookupAddress } from "../domain/property-resolution";
import {
  freezeSubjectProperty,
  type PropertyLookupCandidate,
  type PropertySnapshot,
  type PropertySnapshotRepository,
  type SubjectProperty,
} from "../domain/subject-property";

export interface CanonicalPropertyProvider {
  search(address: string): Promise<readonly PropertyLookupCandidate[]>;
  retrieve(candidate: PropertyLookupCandidate, context: {
    readonly subjectPropertyId: string;
    readonly snapshotId: string;
    readonly snapshotVersion: number;
    readonly retrievedAt: Date;
    readonly requestedAddressKey: string;
  }): Promise<SubjectProperty>;
}

export interface LookupSubjectPropertyDependencies {
  readonly provider: CanonicalPropertyProvider;
  readonly snapshots: PropertySnapshotRepository;
  readonly now?: () => Date;
  readonly createId?: () => string;
  readonly snapshotTtlDays?: number;
}

export interface LookupSubjectPropertyInput {
  readonly address: string | MarketPropertyLookupAddress;
  readonly ownerId: string;
  readonly workspaceId: string;
  readonly refresh?: boolean;
}

export class SubjectPropertyNotFoundError extends Error {
  constructor() {
    super("No matching property found.");
    this.name = "SubjectPropertyNotFoundError";
  }
}

export class AmbiguousSubjectPropertyError extends Error {
  readonly candidates: readonly PropertyLookupCandidate[];
  constructor(candidates: readonly PropertyLookupCandidate[]) {
    super("Multiple matching properties found. Select a property before continuing.");
    this.name = "AmbiguousSubjectPropertyError";
    this.candidates = Object.freeze([...candidates]);
  }
}

export async function lookupSubjectProperty(
  input: LookupSubjectPropertyInput,
  dependencies: LookupSubjectPropertyDependencies,
): Promise<SubjectProperty> {
  const address = normalizeInput(input.address);
  const scope = { ownerId: input.ownerId, workspaceId: input.workspaceId };
  const now = dependencies.now?.() ?? new Date();
  if (!input.refresh) {
    const cached = await dependencies.snapshots.findFreshByAddress(address.key, now, scope);
    if (cached) return cached.property;
  }

  const candidates = await dependencies.provider.search(address.display);
  if (candidates.length === 0) throw new SubjectPropertyNotFoundError();
  const exactCandidates = candidates.filter(candidate => normalizeInput(candidate.formattedAddress).key === address.key);
  if (candidates.length > 1 && exactCandidates.length !== 1) throw new AmbiguousSubjectPropertyError(candidates);
  const candidate = exactCandidates[0] ?? candidates[0]!;

  const previous = await dependencies.snapshots.findLatestByAddress(address.key, scope);
  const subjectPropertyId = previous?.subjectPropertyId ??
    `subject-property-${dependencies.createId?.() ?? globalThis.crypto.randomUUID()}`;
  const version = await dependencies.snapshots.nextVersion(subjectPropertyId, scope);
  const snapshotId = `property-snapshot-${globalThis.crypto.randomUUID()}`;
  const property = await dependencies.provider.retrieve(candidate, {
    subjectPropertyId,
    snapshotId,
    snapshotVersion: version,
    retrievedAt: now,
    requestedAddressKey: address.key,
  });
  const snapshot: PropertySnapshot = freezeSubjectProperty({
    id: snapshotId,
    ownerId: input.ownerId,
    workspaceId: input.workspaceId,
    subjectPropertyId,
    normalizedAddressKey: address.key,
    version,
    property,
    capturedAt: new Date(now),
    listingFreshUntil: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
    expiresAt: new Date(now.getTime() + (dependencies.snapshotTtlDays ?? 7) * 24 * 60 * 60 * 1_000),
  });
  await dependencies.snapshots.save(snapshot);
  return property;
}

function normalizeInput(input: string | MarketPropertyLookupAddress): { display: string; key: string } {
  if (typeof input === "string") {
    const display = input.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
    if (!display) throw new Error("A property address is required.");
    return { display, key: display.toLowerCase().replace(/[.,#]/g, "").replace(/\s+/g, " ") };
  }
  const normalized = normalizeMarketAddress(input);
  return { display: normalized.display.formatted, key: normalized.comparisonKey };
}
