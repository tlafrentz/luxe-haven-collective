import { createHash } from "node:crypto";
import type { HpmLineageRelationship, HpmProjectedRecord, HpmProjectionScope, HpmSourceReference } from "./hpm-contracts";
import { HPM_CAPABILITY_STAGE, HPM_LIFECYCLE_STAGES } from "./hpm-vocabulary";

export const HPM_LINEAGE_POLICY_VERSION = "hpm-lineage-v1";

export type HpmLineageResult = Readonly<{
  edges: readonly HpmLineageRelationship[];
  gaps: readonly Readonly<{ code: string; source: HpmSourceReference }>[];
}>;

const referenceKey = (value: HpmSourceReference) => `${value.capability}:${value.recordType}:${value.recordId}:${value.recordVersion}`;
const recordKey = (value: HpmProjectedRecord) => referenceKey(value.source);

export function assembleHpmLineage(records: readonly HpmProjectedRecord[], scope: HpmProjectionScope): HpmLineageResult {
  const visible = new Map(records.map((record) => [recordKey(record), record]));
  const edges = new Map<string, HpmLineageRelationship>();
  const gaps: Array<{ code: string; source: HpmSourceReference }> = [];

  for (const record of records) {
    for (const relationship of record.relationships ?? []) {
      const target = visible.get(referenceKey(relationship.target));
      if (!target) {
        gaps.push({ code: "lineage-endpoint-unavailable", source: record.source });
        continue;
      }
      if (!validPair(record, target, scope) || referenceKey(record.source) === referenceKey(target.source) || !validDirection(record, target, relationship.type)) {
        gaps.push({ code: "lineage-invalid", source: record.source });
        continue;
      }
      const edge: HpmLineageRelationship = Object.freeze({
        type: relationship.type,
        source: record.source,
        target: target.source,
        authority: relationship.authority,
        associationPolicyVersion: HPM_LINEAGE_POLICY_VERSION,
        explanationCode: relationship.explanationCode,
        createdAt: relationship.createdAt ?? record.updatedAt,
        correlationId: relationship.correlationId,
        causationId: relationship.causationId,
        access: "available",
      });
      edges.set(edgeKey(edge), preferExplicit(edges.get(edgeKey(edge)), edge));
    }
  }

  const correlations = groupBy(records.filter((record) => record.correlationId), (record) => record.correlationId!);
  for (const [, correlated] of correlations) {
    const ordered = [...correlated].sort(recordOrder);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const source = ordered[index], target = ordered[index + 1];
      if (!validPair(source, target, scope) || source.stage === target.stage) continue;
      const edge: HpmLineageRelationship = Object.freeze({
        type: "correlated-with",
        source: source.source,
        target: target.source,
        authority: "inferred",
        associationPolicyVersion: HPM_LINEAGE_POLICY_VERSION,
        explanationCode: "shared-visible-correlation",
        createdAt: target.createdAt,
        correlationId: source.correlationId,
        access: "available",
      });
      if (!edges.has(edgeKey(edge))) edges.set(edgeKey(edge), edge);
    }
  }

  return Object.freeze({
    edges: Object.freeze([...edges.values()].sort(edgeOrder)),
    gaps: Object.freeze(gaps.sort((a, b) => referenceKey(a.source).localeCompare(referenceKey(b.source)) || a.code.localeCompare(b.code)).map((gap) => Object.freeze(gap))),
  });
}

export function deterministicHpmThreadKey(scope: HpmProjectionScope, origin: HpmSourceReference, canonicalThreadId?: string) {
  const identity = canonicalThreadId ? `canonical:${canonicalThreadId}` : referenceKey(origin);
  const value = `${HPM_LINEAGE_POLICY_VERSION}|${scope.tenantId}|${scope.type}|${scope.portfolioId ?? ""}|${scope.propertyIds.join(",")}|${identity}`;
  return `hpm-thread:${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

function validPair(source: HpmProjectedRecord, target: HpmProjectedRecord, scope: HpmProjectionScope) {
  if (source.tenantId !== target.tenantId || source.tenantId !== scope.tenantId) return false;
  if (scope.type === "property") return source.propertyIds.includes(scope.propertyIds[0]) && target.propertyIds.includes(scope.propertyIds[0]);
  const allowed = new Set(scope.propertyIds);
  return source.propertyIds.every((id) => allowed.has(id)) && target.propertyIds.every((id) => allowed.has(id));
}

function validDirection(source: HpmProjectedRecord, target: HpmProjectedRecord, type: string) {
  if (type === "recommendation-handoff") return source.stage === "recommend" && (target.stage === "decide" || target.stage === "execute");
  return HPM_LIFECYCLE_STAGES.indexOf(HPM_CAPABILITY_STAGE[source.source.capability]) <= HPM_LIFECYCLE_STAGES.indexOf(HPM_CAPABILITY_STAGE[target.source.capability]);
}

function preferExplicit(existing: HpmLineageRelationship | undefined, next: HpmLineageRelationship) {
  if (!existing || (existing.authority === "inferred" && next.authority === "explicit")) return next;
  return existing;
}

function edgeKey(edge: HpmLineageRelationship) { return `${referenceKey(edge.source)}>${referenceKey(edge.target)}:${edge.type}`; }
function edgeOrder(a: HpmLineageRelationship, b: HpmLineageRelationship) { return edgeKey(a).localeCompare(edgeKey(b)); }
function recordOrder(a: HpmProjectedRecord, b: HpmProjectedRecord) { return HPM_LIFECYCLE_STAGES.indexOf(a.stage) - HPM_LIFECYCLE_STAGES.indexOf(b.stage) || a.updatedAt.localeCompare(b.updatedAt) || recordKey(a).localeCompare(recordKey(b)); }
function groupBy<T>(values: readonly T[], select: (value: T) => string) { const result = new Map<string, T[]>(); for (const value of values) result.set(select(value), [...(result.get(select(value)) ?? []), value]); return result; }
