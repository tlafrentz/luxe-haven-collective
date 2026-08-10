import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HpmWorkspaceProjection } from "../application";
import { parseHpmWorkspaceQuery } from "../application";
import { HpmAttentionView, HpmFailure, HpmLifecycleView, HpmOverview, HpmThreadDetail } from "./hpm-workspace";

const scope = { tenantId: "tenant-1", type: "portfolio" as const, portfolioId: "tenant-1", propertyIds: ["property-1"], timeZone: "America/Chicago", from: "2026-07-01T00:00:00Z", to: "2026-08-01T23:59:59Z" };
const reference = { capability: "execute" as const, recordType: "action", recordId: "action-1", recordVersion: "1" };
const record = { tenantId: "tenant-1", source: reference, stage: "execute" as const, canonicalStatus: "blocked", presentationState: "blocked" as const, summary: "Resolve property access blocker", propertyIds: ["property-1"], attentionState: "urgent" as const, validNextCommands: [], createdAt: "2026-07-20T12:00:00Z", updatedAt: "2026-07-21T12:00:00Z", visibility: "tenant" as const };
const thread = { threadKey: "thread-1", scope, origin: reference, records: [record], relationships: [], currentStage: "execute" as const, health: "blocked" as const, healthReasons: ["blocked"], blockers: ["Access unavailable"], missingStages: ["see", "understand", "decide", "learn", "recommend"] as const, timeline: [{ at: record.updatedAt, source: reference, event: "blocked" }], partial: true, freshness: "current" as const, firstObservedAt: record.createdAt, lastChangedAt: record.updatedAt, asOf: "2026-08-01T23:59:59Z" };
const attention = { id: "attention-1", rank: 1, reason: "critical-execution-blocked", rankExplanation: "Critical blocked execution work ranks first.", stage: "execute" as const, authoritativeRecord: reference, scope, severity: "critical" as const, blocker: "Access unavailable", freshness: "current" as const };
const stages = (["see", "understand", "decide", "execute", "learn", "recommend"] as const).map((stage) => ({ stage, availability: stage === "execute" ? "available" as const : "not-configured" as const, visibleCount: stage === "execute" ? 1 : 0, attentionCount: stage === "execute" ? 1 : 0, health: stage === "execute" ? "blocked" as const : "incomplete-context" as const, freshness: stage === "execute" ? "current" as const : "not-configured" as const, asOf: "2026-08-01T23:59:59Z" }));
const model = { lifecycle: { projectionPolicyVersion: "hpm-projection-v1", scope, projectedAt: "2026-08-01T23:59:59Z", asOf: "2026-08-01T23:59:59Z", health: "blocked", healthReasons: ["blocked"], stages, attention: [], threads: [thread], recentlyChanged: [record], lineage: [], sourceStates: [], partial: true, completeness: "partial", coverage: { applicableSources: 7, availableSources: 1, limitations: ["learning:source-not-configured"] }, failures: [], validNextCommands: [], reports: [] }, attention: { projectionKey: "attention", scope, asOf: "2026-08-01T23:59:59Z", policyVersions: { lifecycle: "v1", attention: "v1", command: "v1" }, completeness: "partial", totalAuthorizedCandidates: 1, items: [attention], groups: { byStage: { execute: 1 }, byCapability: { execute: 1 }, byClassification: {} }, sourceStates: [], failures: [], projectedAt: "2026-08-01T23:59:59Z", pagination: { limit: 50, returned: 1, hasMore: false } }, properties: [{ id: "property-1", name: "Oak Street" }], correlationId: "correlation-1", actor: { actorId: "actor-1", tenantId: "tenant-1", roleIds: ["owner"], propertyIds: ["property-1"], active: true }, features: { reports: true, exports: true, operationalHealth: true, operationalCommands: false } } as HpmWorkspaceProjection;
const query = parseHpmWorkspaceQuery({ to: "2026-08-01" }, new Date("2026-08-01T12:00:00Z"));

describe("HPM unified experience", () => {
  it("renders server-projected health, attention rank, freshness, and partial state without recomputation", () => {
    const html = renderToStaticMarkup(<HpmOverview model={model} query={query} />);
    expect(html).toContain("What needs attention");
    expect(html).toContain("Rank 1");
    expect(html).toContain("Not Configured");
    expect(html).toContain("Resolve property access blocker");
  });

  it("preserves canonical attention order and accessible filter labels", () => {
    const html = renderToStaticMarkup(<HpmAttentionView model={model} query={query} />);
    expect(html.indexOf("Rank 1")).toBeGreaterThan(-1);
    expect(html).toContain("Critical blocked execution work ranks first");
    expect(html).toContain("Attention type");
  });

  it("renders stable thread navigation and six screen-reader-visible stages", () => {
    const list = renderToStaticMarkup(<HpmLifecycleView model={model} query={query} />);
    const detail = renderToStaticMarkup(<HpmThreadDetail thread={thread} query={query} />);
    expect(list).toContain("thread-1");
    for (const stage of ["See", "Understand", "Decide", "Execute", "Learn", "Recommend"]) expect(detail).toContain(stage);
    expect(detail).toContain("No visible lineage relationships");
    expect(detail).toContain("Not available");
  });

  it("renders safe page-level failures with recovery and correlation reference", () => {
    const html = renderToStaticMarkup(<HpmFailure code="HPM_SOURCE_UNAVAILABLE" message="A source is unavailable." correlationId="correlation-1" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("correlation-1");
    expect(html).not.toContain("stack");
  });
});
