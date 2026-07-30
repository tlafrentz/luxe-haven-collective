import {
  lookupSubjectProperty,
  type CanonicalPropertyProvider,
} from "../../application/lookup-subject-property";
import type {
  PropertySnapshotRepository,
  SubjectProperty,
} from "../../domain/subject-property";
import {
  authorizeStrMarketSnapshot,
  type AuthorizedMarketSnapshotReference,
} from "./authorize-str-market-snapshot";
import { buildStrMarketQuery } from "./build-str-market-query";
import {
  createStrMarketIntelligenceService,
  type StrWorkflowTelemetry,
} from "./get-str-market-intelligence";
import type {
  StrMarketIntelligenceProvider,
  StrMarketSnapshot,
  StrMarketSnapshotRepository,
} from "../domain";

export interface ResolveInvestmentMarketContextInput {
  readonly ownerId: string;
  readonly workspaceId: string;
  readonly address: string;
  readonly property: {
    readonly propertyType?: string;
    readonly bedrooms?: number;
    readonly bathrooms?: number;
  };
  readonly marketSnapshotId?: string;
  readonly correlationId: string;
  readonly requestedAt: Date;
  readonly forceRefresh?: boolean;
}

export interface ResolvedInvestmentMarketContext {
  readonly subjectProperty?: SubjectProperty;
  readonly subjectPropertySnapshotId?: string;
  readonly marketSnapshot?: StrMarketSnapshot;
  readonly marketSnapshotReference?: AuthorizedMarketSnapshotReference;
  readonly source: "persisted-snapshot" | "live-provider" | "manual-fallback";
  readonly warnings: readonly string[];
}

export interface ResolveInvestmentMarketContextDependencies {
  readonly propertyProvider?: CanonicalPropertyProvider;
  readonly propertySnapshots: PropertySnapshotRepository;
  readonly marketProvider?: StrMarketIntelligenceProvider;
  readonly marketSnapshots: StrMarketSnapshotRepository;
  readonly providerVersion: string;
  readonly enabled: boolean;
  readonly propertySnapshotTtlDays?: number;
  readonly marketSnapshotTtlDays?: number;
  readonly telemetry?: StrWorkflowTelemetry;
}

export async function resolveInvestmentMarketContext(
  input: ResolveInvestmentMarketContextInput,
  dependencies: ResolveInvestmentMarketContextDependencies,
): Promise<ResolvedInvestmentMarketContext> {
  const emit = (event: string, attributes: Record<string, string | number | boolean | undefined> = {}) =>
    dependencies.telemetry?.emit(event, { correlationId: input.correlationId, ...attributes });

  emit("market_snapshot_resolution_started");
  if (input.marketSnapshotId) {
    const snapshot = await authorizeStrMarketSnapshot({
      snapshotId: input.marketSnapshotId,
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      property: input.property,
    }, dependencies.marketSnapshots);
    const propertySnapshot = await dependencies.propertySnapshots.findById(snapshot.subjectPropertySnapshotId);
    if (!propertySnapshot || propertySnapshot.subjectPropertyId !== snapshot.subjectPropertyId) {
      throw new Error("The selected market evidence references a missing or incompatible property snapshot.");
    }
    emit("market_snapshot_authorized", { marketSnapshotId: snapshot.id });
    return {
      subjectProperty: propertySnapshot.property,
      subjectPropertySnapshotId: propertySnapshot.id,
      marketSnapshot: snapshot,
      source: "persisted-snapshot",
      warnings: snapshot.warnings,
    };
  }

  if (!dependencies.enabled) {
    return {
      source: "manual-fallback",
      warnings: ["Live market intelligence is disabled. Supplied assumptions were preserved."],
    };
  }
  if (!dependencies.propertyProvider || !dependencies.marketProvider) {
    throw new Error("Canonical market providers are not configured.");
  }

  emit("subject_property_resolution_started");
  let subjectProperty: SubjectProperty;
  try {
    subjectProperty = await lookupSubjectProperty(
      { address: input.address, refresh: input.forceRefresh },
      {
        provider: dependencies.propertyProvider,
        snapshots: dependencies.propertySnapshots,
        now: () => input.requestedAt,
        snapshotTtlDays: dependencies.propertySnapshotTtlDays,
      },
    );
    emit("subject_property_resolution_completed", {
      subjectPropertyId: subjectProperty.id,
      propertySnapshotId: subjectProperty.snapshotId,
    });
  } catch (error) {
    emit("subject_property_resolution_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    throw error;
  }

  try {
    const query = buildStrMarketQuery(subjectProperty, { requestedAt: input.requestedAt });
    let cacheHit = false;
    let created = false;
    const serviceTelemetry: StrWorkflowTelemetry = {
      emit(event, attributes) {
        if (event === "str_market_snapshot_cache_hit") cacheHit = true;
        if (event === "str_market_snapshot_created") created = true;
        dependencies.telemetry?.emit(event, attributes);
      },
    };
    const service = createStrMarketIntelligenceService({
      provider: dependencies.marketProvider,
      repository: dependencies.marketSnapshots,
      providerVersion: dependencies.providerVersion,
      snapshotTtlDays: dependencies.marketSnapshotTtlDays,
      now: () => input.requestedAt,
      telemetry: serviceTelemetry,
    });
    const snapshot = await service({
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      query,
      correlationId: input.correlationId,
      refresh: input.forceRefresh,
    });
    const authorized = await authorizeStrMarketSnapshot({
      snapshotId: snapshot.id,
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      property: input.property,
    }, dependencies.marketSnapshots);
    emit("market_snapshot_authorized", { marketSnapshotId: authorized.id });
    return {
      subjectProperty,
      subjectPropertySnapshotId: subjectProperty.snapshotId,
      marketSnapshot: authorized,
      source: cacheHit && !created ? "persisted-snapshot" : "live-provider",
      warnings: [...new Set([...subjectProperty.missingFields.map((field) => `Property field unavailable: ${field}.`), ...authorized.warnings])],
    };
  } catch (error) {
    emit("market_snapshot_resolution_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    throw error;
  }
}
