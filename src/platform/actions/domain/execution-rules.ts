export type ExecuteEvidenceType = "photo" | "document" | "receipt-invoice" | "url" | "checklist" | "text-note" | "metric-snapshot" | "approval" | "system-event";
export type ExecuteEvidencePolicy = Readonly<{ mode: "optional" | "at-least-one" | "specific"; requiredTypes?: readonly ExecuteEvidenceType[]; minimumPhotoCount?: number; beforeAndAfterPhotos?: boolean; reviewerApprovalRequired?: boolean }>;
export type ExecuteEvidenceRecord = Readonly<{ type: ExecuteEvidenceType; reviewStatus: "pending" | "accepted" | "rejected" | "not-required"; photoPhase?: "before" | "after" }>;
export type CompletionReadiness = Readonly<{ ready: boolean; blockers: readonly string[] }>;

export function evaluateCompletionReadiness(input: Readonly<{ policy: ExecuteEvidencePolicy; evidence: readonly ExecuteEvidenceRecord[]; checklistComplete: boolean; unresolvedDependencyIds?: readonly string[] }>): CompletionReadiness {
  const blockers: string[] = [];
  const activeEvidence = input.evidence.filter((item) => item.reviewStatus !== "rejected");
  if (!input.checklistComplete) blockers.push("Completion criteria are incomplete.");
  if (input.unresolvedDependencyIds?.length) blockers.push("Dependencies remain unresolved.");
  if (input.policy.mode === "at-least-one" && activeEvidence.length === 0) blockers.push("At least one evidence item is required.");
  for (const type of input.policy.requiredTypes ?? []) if (!activeEvidence.some((item) => item.type === type)) blockers.push(`Required ${type} evidence is missing.`);
  const photos = activeEvidence.filter((item) => item.type === "photo");
  if (photos.length < (input.policy.minimumPhotoCount ?? 0)) blockers.push(`At least ${input.policy.minimumPhotoCount} photos are required.`);
  if (input.policy.beforeAndAfterPhotos && (!photos.some((item) => item.photoPhase === "before") || !photos.some((item) => item.photoPhase === "after"))) blockers.push("Before-and-after photos are required.");
  if (input.policy.reviewerApprovalRequired && !activeEvidence.some((item) => item.reviewStatus === "accepted")) blockers.push("Reviewer approval is required.");
  return Object.freeze({ ready: blockers.length === 0, blockers: Object.freeze(blockers) });
}

export type ExecuteDependency = Readonly<{ actionId: string; dependsOnActionId: string }>;
export function assertAcyclicDependencies(dependencies: readonly ExecuteDependency[]): void {
  const graph = new Map<string, string[]>();
  for (const dependency of dependencies) {
    if (dependency.actionId === dependency.dependsOnActionId) throw new TypeError("An Action cannot depend on itself.");
    graph.set(dependency.actionId, [...(graph.get(dependency.actionId) ?? []), dependency.dependsOnActionId]);
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new TypeError("Action dependencies cannot contain a cycle.");
    if (visited.has(id)) return;
    visiting.add(id); for (const next of graph.get(id) ?? []) visit(next); visiting.delete(id); visited.add(id);
  };
  for (const id of graph.keys()) visit(id);
}

export type ExecuteRecurrenceRule =
  | Readonly<{ type: "daily"; interval?: number }>
  | Readonly<{ type: "weekly"; interval?: number }>
  | Readonly<{ type: "monthly"; interval?: number }>
  | Readonly<{ type: "day-interval"; interval: number }>
  | Readonly<{ type: "selected-weekdays"; weekdays: readonly number[] }>;
export type ExecuteOccurrence = Readonly<{ key: string; scheduledFor: Date; dueAt?: Date }>;

export function generateScheduledOccurrences(input: Readonly<{ templateId: string; templateVersion: number; startsAt: Date; from: Date; through: Date; rule: ExecuteRecurrenceRule; dueOffsetSeconds?: number }>): readonly ExecuteOccurrence[] {
  const start = validDate(input.startsAt), from = validDate(input.from), through = validDate(input.through);
  if (through < from) throw new TypeError("Recurrence window is invalid.");
  const dates: Date[] = [];
  if (input.rule.type === "selected-weekdays") {
    const weekdays = new Set(input.rule.weekdays); if ([...weekdays].some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new TypeError("Selected weekdays must be between 0 and 6.");
    for (let cursor = startOfUtcDay(maxDate(start, from)); cursor <= through; cursor = addUtcDays(cursor, 1)) if (weekdays.has(cursor.getUTCDay()) && cursor >= start) dates.push(cursor);
  } else {
    const interval = input.rule.interval ?? 1; if (!Number.isInteger(interval) || interval < 1) throw new TypeError("Recurrence interval must be a positive integer.");
    let cursor = new Date(start);
    while (cursor < from) cursor = increment(cursor, input.rule.type, interval);
    while (cursor <= through) { dates.push(new Date(cursor)); cursor = increment(cursor, input.rule.type, interval); }
  }
  return Object.freeze(dates.map((scheduledFor) => Object.freeze({ key: scheduledOccurrenceKey(input.templateId, input.templateVersion, scheduledFor), scheduledFor, ...(input.dueOffsetSeconds === undefined ? {} : { dueAt: new Date(scheduledFor.getTime() + input.dueOffsetSeconds * 1000) }) })));
}

export function scheduledOccurrenceKey(templateId: string, templateVersion: number, scheduledFor: Date): string { return `${templateId}:v${templateVersion}:${validDate(scheduledFor).toISOString()}`; }
export function triggeredOccurrenceKey(templateId: string, templateVersion: number, triggerType: "reservation" | "check-in" | "checkout" | "manual", stableTriggerId: string): string {
  const id = stableTriggerId.trim(); if (!id) throw new TypeError("Triggered occurrences require a stable trigger identifier.");
  return `${templateId}:v${templateVersion}:${triggerType}:${id}`;
}

export type ExecuteEscalationTrigger = "not-started" | "due-soon" | "overdue" | "critically-overdue" | "blocked-too-long" | "review-pending";
export function evaluateTimeEscalation(input: Readonly<{ status: string; dueAt?: Date; statusChangedAt: Date; now: Date; dueSoonSeconds: number; criticalOverdueSeconds: number; blockedSeconds: number; reviewSeconds: number }>): ExecuteEscalationTrigger | undefined {
  const now = validDate(input.now), changed = validDate(input.statusChangedAt), due = input.dueAt ? validDate(input.dueAt) : undefined;
  if (input.status === "blocked" && secondsBetween(changed, now) >= input.blockedSeconds) return "blocked-too-long";
  if (input.status === "awaiting-review" && secondsBetween(changed, now) >= input.reviewSeconds) return "review-pending";
  if (!due || ["completed", "failed", "cancelled", "archived"].includes(input.status)) return undefined;
  const overdue = secondsBetween(due, now);
  if (overdue >= input.criticalOverdueSeconds) return "critically-overdue";
  if (overdue >= 0) return "overdue";
  if (-overdue <= input.dueSoonSeconds) return "due-soon";
  return undefined;
}

function increment(value: Date, type: Exclude<ExecuteRecurrenceRule["type"], "selected-weekdays">, interval: number): Date { const result = new Date(value); if (type === "monthly") result.setUTCMonth(result.getUTCMonth() + interval); else result.setUTCDate(result.getUTCDate() + (type === "weekly" ? 7 : 1) * interval); return result; }
function addUtcDays(value: Date, days: number): Date { const result = new Date(value); result.setUTCDate(result.getUTCDate() + days); return result; }
function startOfUtcDay(value: Date): Date { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())); }
function maxDate(left: Date, right: Date): Date { return left > right ? left : right; }
function secondsBetween(left: Date, right: Date): number { return (right.getTime() - left.getTime()) / 1000; }
function validDate(value: Date): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError("Execute timestamp must be valid."); return result; }
