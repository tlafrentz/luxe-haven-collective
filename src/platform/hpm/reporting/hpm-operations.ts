import { createHash } from "node:crypto";
import type { HpmLifecycleProjection } from "../application";
import { HPM_REPORT_CACHE_POLICY_VERSION } from "./hpm-report-cache";
import { HPM_STANDARD_REPORTS } from "./hpm-report-catalog";
import type { HpmOperationalHealth } from "./hpm-report-contracts";

export type HpmOperationType = "refresh-report" | "refresh-compatibility" | "rebuild-projection" | "recompute-metrics" | "invalidate-cache" | "retry-job";
export type HpmOperationRequest = Readonly<{ actorId: string; tenantId: string; roleIds: readonly string[]; type: HpmOperationType; scopeType: "property" | "portfolio"; scopeId: string; reason: string; expectedVersion?: string; idempotencyKey: string; correlationId: string; causationId: string; dryRun: boolean; maximumRecords: number; maximumDurationMs: number }>;
export type HpmOperationJob = Readonly<{ id: string; request: HpmOperationRequest; status: "accepted" | "dry-run-complete" | "rejected"; classification: string; createdAt: string; version: number }>;

/** Provider-neutral bounded job admission. Production workers can persist and execute accepted jobs later. */
export class HpmOperationAdmissionService {
  private readonly jobs = new Map<string, HpmOperationJob>();
  request(input: HpmOperationRequest, now = new Date().toISOString()): HpmOperationJob {
    if (!input.roleIds.some((role) => role === "owner" || role === "administrator" || role === "admin")) throw new Error(operationCode(input.type, "NOT_ALLOWED"));
    if (!input.reason.trim() || !input.idempotencyKey.trim() || input.tenantId !== input.scopeId && input.scopeType === "portfolio" || input.maximumRecords < 1 || input.maximumRecords > 10_000 || input.maximumDurationMs < 1 || input.maximumDurationMs > 300_000) throw new Error(input.type === "rebuild-projection" ? "HPM_REBUILD_SCOPE_TOO_BROAD" : "HPM_OPERATION_UNAVAILABLE");
    const existing = this.jobs.get(`${input.tenantId}:${input.idempotencyKey}`); if (existing) return existing;
    const status = input.dryRun ? "dry-run-complete" : "accepted";
    const job = Object.freeze({ id: `hpm-job:${createHash("sha256").update(`${input.tenantId}:${input.idempotencyKey}`).digest("hex").slice(0, 24)}`, request: Object.freeze({ ...input, roleIds: Object.freeze([...input.roleIds]) }), status, classification: input.dryRun ? "HPM_OPERATION_DRY_RUN_VALID" : "HPM_OPERATION_ACCEPTED", createdAt: now, version: 1 } as const);
    this.jobs.set(`${input.tenantId}:${input.idempotencyKey}`, job); return job;
  }
  get size() { return this.jobs.size; }
}

export function projectHpmOperationalHealth(input: Readonly<{ lifecycle: HpmLifecycleProjection; flags: HpmOperationalHealth["featureFlags"]; cacheEntries?: number; activeJobs?: number; evaluatedAt?: string }>): HpmOperationalHealth {
  const limited = input.lifecycle.sourceStates.filter(({ freshness }) => !["current", "not-applicable"].includes(freshness));
  const degradedModes = [...limited.map(({ capability, freshness }) => `${capability}:${freshness}`), ...(input.lifecycle.failures?.map(({ classification }) => classification) ?? [])];
  const status = input.lifecycle.failures?.length ? "degraded" : input.lifecycle.partial ? "partial" : "healthy";
  return Object.freeze({ status, evaluatedAt: input.evaluatedAt ?? new Date().toISOString(), featureFlags: input.flags, sources: input.lifecycle.sourceStates, projection: { completeness: input.lifecycle.completeness ?? (input.lifecycle.partial ? "partial" : "complete"), projectedAt: input.lifecycle.projectedAt, failureCount: input.lifecycle.failures?.length ?? 0 }, cache: { status: "available", policyVersion: HPM_REPORT_CACHE_POLICY_VERSION, entries: input.cacheEntries ?? 0 }, reports: { status: "available", definitionCount: HPM_STANDARD_REPORTS.length, recentFailures: input.lifecycle.failures?.map(({ classification }) => classification) ?? [] }, exports: { status: input.flags.exports ? "available" : "disabled", formats: input.flags.exports ? ["csv", "print"] : [] }, jobs: { status: input.flags.operations ? "available" : "disabled", active: input.activeJobs ?? 0, oldestAgeMs: null }, degradedModes: Object.freeze(degradedModes), runbook: "/docs/runbooks/hpm-reporting-operations", validCommands: input.flags.operations ? ["refresh-report", "refresh-compatibility", "rebuild-projection", "invalidate-cache"] : [] } satisfies HpmOperationalHealth);
}
function operationCode(type: HpmOperationType, suffix: string) { if (type === "rebuild-projection") return `HPM_REBUILD_${suffix}`; if (type === "invalidate-cache") return `HPM_CACHE_INVALIDATION_${suffix}`; return `HPM_REFRESH_${suffix}`; }
