import { normalizeMarketAddress } from "./normalize-market-address";
import { areCanonicalAddressesCompatible } from "./canonical-address-comparison";
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
  readonly operationTimeoutMs?: number;
  readonly diagnostic?: (
    stage: "autocomplete" | "candidate-selection" | "property-detail-mapping" | "canonical-persistence",
    status: "started" | "completed" | "failed",
    metadata?: Readonly<Record<string, number>>,
  ) => void;
}

const DEFAULT_SUBJECT_PROPERTY_OPERATION_TIMEOUT_MS = 10_000;

export class SubjectPropertyOperationTimeoutError extends Error {
  readonly code = "timed-out" as const;
  readonly operation: string;

  constructor(operation: string, timeoutMs: number) {
    super(`Subject property ${operation} did not settle within ${timeoutMs}ms.`);
    this.name = "SubjectPropertyOperationTimeoutError";
    this.operation = operation;
  }
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
  readonly code = "PROPERTY_AMBIGUOUS" as const;
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
  const operationTimeoutMs =
    dependencies.operationTimeoutMs ??
    DEFAULT_SUBJECT_PROPERTY_OPERATION_TIMEOUT_MS;
  const settle = <T>(operation: string, promise: Promise<T>) =>
    settleWithin(promise, operation, operationTimeoutMs);
  if (!input.refresh) {
    const cached = await settle(
      "fresh-snapshot lookup",
      dependencies.snapshots.findFreshByAddress(address.key, now, scope),
    );
    if (cached) return cached.property;
  }

  let candidates: readonly PropertyLookupCandidate[];
  try {
    dependencies.diagnostic?.("autocomplete", "started");
    candidates = await settle(
      "autocomplete",
      dependencies.provider.search(address.display),
    );
    dependencies.diagnostic?.("autocomplete", "completed", { candidateCount: candidates.length });
  } catch (error) {
    dependencies.diagnostic?.("autocomplete", "failed");
    throw error;
  }
  if (candidates.length === 0) throw new SubjectPropertyNotFoundError();
  dependencies.diagnostic?.("candidate-selection", "started", {
    candidateCount: candidates.length,
    exactCandidateCount: 0,
  });
  const exactCandidates = candidates.filter(candidate =>
    areCanonicalAddressesCompatible(address.display, candidate.formattedAddress));
  dependencies.diagnostic?.("candidate-selection", "completed", {
    candidateCount: candidates.length,
    exactCandidateCount: exactCandidates.length,
  });
  if (exactCandidates.length === 0) throw new SubjectPropertyNotFoundError();
  if (exactCandidates.length > 1) throw new AmbiguousSubjectPropertyError(exactCandidates);
  const candidate = exactCandidates[0]!;

  const previous = await settle(
    "latest-snapshot lookup",
    dependencies.snapshots.findLatestByAddress(address.key, scope),
  );
  const subjectPropertyId = previous?.subjectPropertyId ??
    `subject-property-${dependencies.createId?.() ?? globalThis.crypto.randomUUID()}`;
  const version = await settle(
    "snapshot-version allocation",
    dependencies.snapshots.nextVersion(subjectPropertyId, scope),
  );
  const snapshotId = `property-snapshot-${globalThis.crypto.randomUUID()}`;
  let property: SubjectProperty;
  try {
    property = await settle(
      "property-detail retrieval and mapping",
      dependencies.provider.retrieve(candidate, {
        subjectPropertyId,
        snapshotId,
        snapshotVersion: version,
        retrievedAt: now,
        requestedAddressKey: address.key,
      }),
    );
    dependencies.diagnostic?.("property-detail-mapping", "completed");
  } catch (error) {
    dependencies.diagnostic?.("property-detail-mapping", "failed");
    throw error;
  }
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
  try {
    await settle("canonical persistence", dependencies.snapshots.save(snapshot));
    dependencies.diagnostic?.("canonical-persistence", "completed", { snapshotVersion: version });
  } catch (error) {
    dependencies.diagnostic?.("canonical-persistence", "failed", { snapshotVersion: version });
    throw error;
  }
  return property;
}

function settleWithin<T>(
  promise: Promise<T>,
  operation: string,
  timeoutMs: number,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new SubjectPropertyOperationTimeoutError(operation, timeoutMs));
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(
        () => reject(new SubjectPropertyOperationTimeoutError(operation, timeoutMs)),
        timeoutMs,
      );
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
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
