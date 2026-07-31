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
  readonly failureCode?: StrMarketContextFailureCode;
  readonly warnings: readonly string[];
}

export type StrMarketContextFailureCode =
  | "COORDINATES_MISSING"
  | "STR_PROVIDER_UNAVAILABLE"
  | "STR_PROVIDER_RATE_LIMITED"
  | "STR_REQUEST_REJECTED"
  | "STR_RESPONSE_INVALID"
  | "STR_MAPPING_FAILED"
  | "INSUFFICIENT_COMPARABLE_COVERAGE"
  | "MARKET_SNAPSHOT_PERSISTENCE_FAILED";

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
  readonly classifyMarketFailure?: (error: unknown) => StrMarketContextFailureCode;
}

export async function resolveInvestmentMarketContext(
  input: ResolveInvestmentMarketContextInput,
  dependencies: ResolveInvestmentMarketContextDependencies,
): Promise<ResolvedInvestmentMarketContext> {
  const emit = (event: string, attributes: Record<string, string | number | boolean | undefined> = {}) =>
    dependencies.telemetry?.emit(event, { correlationId: input.correlationId, ...attributes });
  let stage = "resolver-boundary";
  let terminalEmitted = false;
  const terminal = (
    event: "market_snapshot_resolution_completed" | "market_snapshot_resolution_limited" | "market_snapshot_resolution_failed",
    attributes: Record<string, string | number | boolean | undefined> = {},
  ) => {
    if (terminalEmitted) return;
    terminalEmitted = true;
    emit(event, { stage, ...attributes });
  };
  const errorDetails = (error: unknown, classification: string) => ({
    errorName: error instanceof Error ? error.name : "UnknownError",
    ...(typeof error === "object" && error !== null && "code" in error &&
      typeof error.code === "string" ? { code: error.code } : {}),
    classification,
  });

  emit("market_snapshot_resolution_started");
  let subjectProperty: SubjectProperty | undefined;
  try {
    if (input.marketSnapshotId) {
      stage = "market-snapshot-authorization";
      emit("market_snapshot_authorization_await_started");
      const snapshot = await authorizeStrMarketSnapshot({
        snapshotId: input.marketSnapshotId,
        ownerId: input.ownerId,
        workspaceId: input.workspaceId,
        property: input.property,
      }, dependencies.marketSnapshots);
      emit("market_snapshot_authorization_await_completed");
      stage = "subject-property-snapshot-loading";
      emit("subject_property_snapshot_load_await_started");
      const propertySnapshot = await dependencies.propertySnapshots.findById(
        snapshot.subjectPropertySnapshotId,
        { ownerId: input.ownerId, workspaceId: input.workspaceId },
      );
      emit("subject_property_snapshot_load_await_completed", { found: Boolean(propertySnapshot) });
      if (!propertySnapshot || propertySnapshot.subjectPropertyId !== snapshot.subjectPropertyId) {
        throw new Error("The selected market evidence references a missing or incompatible property snapshot.");
      }
      emit("market_snapshot_authorized", { marketSnapshotId: snapshot.id });
      stage = "result-return";
      terminal("market_snapshot_resolution_completed", { source: "persisted-snapshot" });
      return {
        subjectProperty: propertySnapshot.property,
        subjectPropertySnapshotId: propertySnapshot.id,
        marketSnapshot: snapshot,
        source: "persisted-snapshot",
        warnings: snapshot.warnings,
      };
    }

    stage = "property-provider-evaluation";
    emit("subject_property_provider_evaluation_completed", {
      configured: Boolean(dependencies.propertyProvider),
    });
    if (!dependencies.propertyProvider) throw new Error("Canonical property intelligence is not configured.");

    stage = "subject-property-loading";
    emit("subject_property_resolution_started");
    emit("subject_property_resolution_await_started");
    subjectProperty = await lookupSubjectProperty(
      {
        address: input.address,
        ownerId: input.ownerId,
        workspaceId: input.workspaceId,
        refresh: input.forceRefresh,
      },
      {
        provider: dependencies.propertyProvider,
        snapshots: dependencies.propertySnapshots,
        now: () => input.requestedAt,
        snapshotTtlDays: dependencies.propertySnapshotTtlDays,
        diagnostic(stage, status, metadata) {
          emit(`subject_property_${stage.replaceAll("-", "_")}_${status}`, metadata);
        },
      },
    );
    emit("subject_property_resolution_await_completed");
    emit("subject_property_resolution_completed", {
      subjectPropertyId: subjectProperty.id,
      propertySnapshotId: subjectProperty.snapshotId,
    });

    stage = "coordinate-validation";
    const hasCoordinates =
      subjectProperty.address.latitude.value !== null &&
      subjectProperty.address.longitude.value !== null;
    emit(
      hasCoordinates
        ? "str_coordinate_resolution_completed"
        : "str_coordinate_resolution_failed",
      { hasCoordinates },
    );

    stage = "market-provider-evaluation";
    emit("str_adapter_evaluation_completed", {
      featureEnabled: dependencies.enabled,
      providerConfigured: Boolean(dependencies.marketProvider),
    });
    if (!dependencies.enabled || !dependencies.marketProvider) {
      emit("str_adapter_activation_skipped", { reasonCode: "STR_PROVIDER_UNAVAILABLE" });
      emit("str_limitation_finalized", { limitationCode: "STR_PROVIDER_UNAVAILABLE" });
      stage = "limited-result-return";
      terminal("market_snapshot_resolution_limited", {
        classification: "STR_PROVIDER_UNAVAILABLE",
      });
      return {
        subjectProperty,
        subjectPropertySnapshotId: subjectProperty.snapshotId,
        source: "manual-fallback",
        failureCode: "STR_PROVIDER_UNAVAILABLE",
        warnings: ["Property data was synced. STR market intelligence is not configured; supplied assumptions were preserved."],
      };
    }

    stage = "market-query-construction";
    const query = buildStrMarketQuery(subjectProperty, { requestedAt: input.requestedAt });
    emit("str_adapter_activation_completed", { provider: "airroi" });
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
    stage = "market-cache-and-provider-resolution";
    emit("str_market_resolution_await_started");
    const snapshot = await service({
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      query,
      correlationId: input.correlationId,
      refresh: input.forceRefresh,
    });
    emit("str_market_resolution_await_completed", {
      cacheHit,
      snapshotCreated: created,
    });
    stage = "persisted-market-snapshot-authorization";
    emit("market_snapshot_authorization_await_started");
    const authorized = await authorizeStrMarketSnapshot({
      snapshotId: snapshot.id,
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      property: input.property,
    }, dependencies.marketSnapshots);
    emit("market_snapshot_authorization_await_completed");
    emit("market_snapshot_authorized", { marketSnapshotId: authorized.id });
    const limitedCoverage = authorized.completeness !== "complete";
    emit("str_limitation_finalized", {
      limitationCode: limitedCoverage
        ? "INSUFFICIENT_COMPARABLE_COVERAGE"
        : "NONE",
    });
    stage = "result-return";
    terminal(
      limitedCoverage
        ? "market_snapshot_resolution_limited"
        : "market_snapshot_resolution_completed",
      limitedCoverage
        ? { classification: "INSUFFICIENT_COMPARABLE_COVERAGE" }
        : { source: cacheHit && !created ? "persisted-snapshot" : "live-provider" },
    );
    return {
      subjectProperty,
      subjectPropertySnapshotId: subjectProperty.snapshotId,
      marketSnapshot: authorized,
      source: cacheHit && !created ? "persisted-snapshot" : "live-provider",
      ...(limitedCoverage ? { failureCode: "INSUFFICIENT_COMPARABLE_COVERAGE" as const } : {}),
      warnings: [...new Set([...subjectProperty.missingFields.map((field) => `Property field unavailable: ${field}.`), ...authorized.warnings])],
    };
  } catch (error) {
    if (!subjectProperty) {
      if (stage === "subject-property-loading") {
        emit("subject_property_resolution_failed", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }
      terminal("market_snapshot_resolution_failed", errorDetails(error, "SUBJECT_PROPERTY_RESOLUTION_FAILED"));
      throw error;
    }
    const failureCode = subjectProperty.address.latitude.value === null || subjectProperty.address.longitude.value === null
      ? "COORDINATES_MISSING"
      : dependencies.classifyMarketFailure?.(error) ?? "STR_PROVIDER_UNAVAILABLE";
    terminal("market_snapshot_resolution_failed", errorDetails(error, failureCode));
    if (failureCode === "COORDINATES_MISSING") {
      emit("str_coordinate_resolution_failed", { hasCoordinates: false });
    }
    emit("str_limitation_finalized", { limitationCode: failureCode });
    return {
      subjectProperty,
      subjectPropertySnapshotId: subjectProperty.snapshotId,
      source: "manual-fallback",
      failureCode,
      warnings: [failureCode === "COORDINATES_MISSING"
        ? "Property data was synced, but coordinates were unavailable. Supplied assumptions were preserved."
        : "Property data was synced, but STR market intelligence was unavailable. Supplied assumptions were preserved."],
    };
  } finally {
    emit("market_snapshot_resolution_boundary_exited", {
      stage,
      terminalEmitted,
    });
  }
}
