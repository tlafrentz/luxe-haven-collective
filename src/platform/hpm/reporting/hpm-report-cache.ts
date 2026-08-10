import { createHash } from "node:crypto";
import type { HpmReportRequest, HpmReportResult } from "./hpm-report-contracts";

export const HPM_REPORT_CACHE_POLICY_VERSION = "hpm-report-cache-v1";
export function hpmReportCacheKey(input: Readonly<{ request: HpmReportRequest; definitionVersion: string; metricPolicyVersions: Readonly<Record<string, string>>; sourceFingerprint: string; permissionFingerprint: string }>) {
  const canonical = { tenantId: input.request.actor.tenantId, actorId: input.request.actor.actorId, roles: [...input.request.actor.roleIds].sort(), authorizedProperties: [...input.request.actor.propertyIds].sort(), permissionFingerprint: input.permissionFingerprint, reportKey: input.request.reportKey, definitionVersion: input.definitionVersion, metricPolicyVersions: Object.entries(input.metricPolicyVersions).sort(), scope: { ...input.request.scope, propertyIds: [...input.request.scope.propertyIds].sort() }, dateMode: input.request.dateMode, from: input.request.from, to: input.request.to, timeZone: input.request.timeZone, asOf: input.request.asOf, filters: Object.entries(input.request.filters).sort(), dimensions: [...input.request.dimensions].sort(), comparison: input.request.comparison, locale: input.request.locale, currency: input.request.currency, sourceFingerprint: input.sourceFingerprint, policyVersion: HPM_REPORT_CACHE_POLICY_VERSION };
  return `hpm-report:${createHash("sha256").update(JSON.stringify(canonical)).digest("hex")}`;
}

export class BoundedHpmReportCache {
  readonly policyVersion = HPM_REPORT_CACHE_POLICY_VERSION;
  private readonly entries = new Map<string, Readonly<{ report: HpmReportResult; expiresAt: number }>>();
  constructor(private readonly maximumEntries = 100, private readonly ttlMs = 60_000) {}
  get(key: string, now = Date.now()) { const value = this.entries.get(key); if (!value) return undefined; if (value.expiresAt <= now) { this.entries.delete(key); return undefined; } return value.report; }
  set(key: string, report: HpmReportResult, now = Date.now()) { if (!this.entries.has(key) && this.entries.size >= this.maximumEntries) this.entries.delete(this.entries.keys().next().value as string); this.entries.set(key, Object.freeze({ report, expiresAt: now + this.ttlMs })); }
  invalidate(prefix: string) { if (!prefix.startsWith("hpm-report:")) throw new Error("HPM_CACHE_INVALIDATION_NOT_ALLOWED"); let count = 0; for (const key of this.entries.keys()) if (key.startsWith(prefix)) { this.entries.delete(key); count++; } return count; }
  get size() { return this.entries.size; }
}
