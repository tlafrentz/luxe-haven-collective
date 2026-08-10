import { HPM_LIFECYCLE_STAGES, type HpmAttentionClassification, type HpmLifecycleStage } from "@/platform/hpm";

export type HpmWorkspaceQuery = Readonly<{
  scopeType: "property" | "portfolio";
  scopeId?: string;
  from: string;
  to: string;
  asOf: string;
  stages: readonly HpmLifecycleStage[];
  classifications: readonly HpmAttentionClassification[];
  cursor?: string;
}>;

const CLASSIFICATIONS: readonly HpmAttentionClassification[] = [
  "critical-risk", "blocked", "awaiting-authority", "overdue", "required-review",
  "required-context", "dependency-required", "handoff-required", "measurement-required",
  "reevaluation-required", "conflict-resolution-required", "expiring", "stale-source",
  "incomplete-coverage", "follow-up-required",
];

export function parseHpmWorkspaceQuery(
  input: Record<string, string | string[] | undefined>,
  now = new Date(),
): HpmWorkspaceQuery {
  const end = isoDate(input.to) ?? now.toISOString().slice(0, 10);
  const startDefault = new Date(`${end}T00:00:00.000Z`);
  startDefault.setUTCDate(startDefault.getUTCDate() - 30);
  const scopeId = safeIdentifier(first(input.scopeId));
  const scopeType = first(input.scope) === "property" || scopeId ? "property" : "portfolio";
  const asOf = isoTimestamp(input.asOf) ?? `${end}T23:59:59.999Z`;
  const stages = csv(input.stage).filter((value): value is HpmLifecycleStage => HPM_LIFECYCLE_STAGES.includes(value as HpmLifecycleStage));
  const classifications = csv(input.classification).filter((value): value is HpmAttentionClassification => CLASSIFICATIONS.includes(value as HpmAttentionClassification));
  return Object.freeze({
    scopeType,
    ...(scopeId ? { scopeId } : {}),
    from: isoDate(input.from) ?? startDefault.toISOString().slice(0, 10),
    to: end,
    asOf,
    stages: Object.freeze([...new Set(stages)]),
    classifications: Object.freeze([...new Set(classifications)]),
    ...(safeCursor(first(input.cursor)) ? { cursor: safeCursor(first(input.cursor)) } : {}),
  });
}

export function hpmContextSearch(query: HpmWorkspaceQuery, additions: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams({ scope: query.scopeType, from: query.from, to: query.to, asOf: query.asOf });
  if (query.scopeId) params.set("scopeId", query.scopeId);
  if (query.stages.length) params.set("stage", query.stages.join(","));
  if (query.classifications.length) params.set("classification", query.classifications.join(","));
  if (query.cursor) params.set("cursor", query.cursor);
  for (const [key, value] of Object.entries(additions)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return params.toString();
}

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function csv(value: string | string[] | undefined) { return (first(value) ?? "").split(",").map((part) => part.trim()).filter(Boolean); }
function isoDate(value: string | string[] | undefined) { const candidate = first(value); return candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate) && !Number.isNaN(Date.parse(`${candidate}T00:00:00Z`)) ? candidate : undefined; }
function isoTimestamp(value: string | string[] | undefined) { const candidate = first(value); return candidate && !Number.isNaN(Date.parse(candidate)) ? new Date(candidate).toISOString() : undefined; }
function safeIdentifier(value?: string) { return value && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : undefined; }
function safeCursor(value?: string) { return value && /^[A-Za-z0-9_-]{1,2048}$/.test(value) ? value : undefined; }
