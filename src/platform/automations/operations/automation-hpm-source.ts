import type {
  HpmProjectedRecord,
  HpmSourcePort,
  HpmSourceQuery,
} from "@/platform/hpm";
import type { AutomationOperationsProjection } from "./automation-operations-contracts";

/** Extends the canonical Execute source; it never registers a competing HPM capability. */
export function createAutomationHpmExecuteContributionPort(
  base: HpmSourcePort,
  load: (
    tenantId: string,
    propertyIds: readonly string[],
  ) => Promise<AutomationOperationsProjection>,
): HpmSourcePort {
  if (base.capability !== "execute")
    throw new Error("AUTOMATION_INTEGRATION_INCOMPATIBLE");
  return Object.freeze({
    capability: "execute",
    contractVersion: "hpm-source-v1",
    async project(query: HpmSourceQuery) {
      const [canonical, projection] = await Promise.all([
          base.project(query),
          load(query.actor.tenantId, query.scope.propertyIds),
        ]),
        authorized = new Set(query.actor.propertyIds),
        propertyIds = projection.scope.propertyIds.filter((id) =>
          authorized.has(id),
        );
      const automationRecords: readonly HpmProjectedRecord[] = Object.freeze(
        projection.reconciliation.candidates.map((candidate) =>
          Object.freeze({
            tenantId: query.actor.tenantId,
            source: Object.freeze({
              capability: "execute" as const,
              recordType: "automation-operational-fact",
              recordId: candidate.id,
              recordVersion: String(candidate.expectedVersion ?? 1),
            }),
            stage: "execute" as const,
            canonicalStatus: candidate.type,
            presentationState: candidate.requiresHumanReview
              ? ("needs-attention" as const)
              : ("in-progress" as const),
            summary: candidate.reason,
            propertyIds,
            attentionState: candidate.requiresHumanReview
              ? ("urgent" as const)
              : ("attention" as const),
            confidence: "high" as const,
            correlationId: candidate.runId ?? candidate.id,
            causationId: candidate.id,
            validNextCommands: Object.freeze([]),
            createdAt: candidate.detectedAt,
            updatedAt: projection.generatedAt,
            visibility: propertyIds.length
              ? ("property" as const)
              : ("tenant" as const),
          }),
        ),
      );
      return Object.freeze({
        state: Object.freeze({
          ...canonical.state,
          contractVersion: "hpm-source-v1",
          freshness:
            projection.freshness.status === "current"
              ? canonical.state.freshness
              : projection.freshness.status === "stale"
                ? ("stale" as const)
                : ("incomplete" as const),
          policyVersion: `${canonical.state.policyVersion}+${projection.projectionVersion}`,
          reasonCode:
            projection.restrictions[0]?.code ?? canonical.state.reasonCode,
          contributesToCounts: true,
          contributesToHealth: true,
          contributesToLineage: true,
        }),
        records: Object.freeze([...canonical.records, ...automationRecords]),
      });
    },
  });
}
