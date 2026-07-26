export type LineageReference = Readonly<{
  capability: string;
  type: string;
  id: string;
  version?: string;
}>;

export type ActivityLineageEvent = Readonly<{
  id: string;
  workspaceId: string;
  subject: LineageReference;
  eventType: string;
  summary: string;
  occurredAt: string;
  actorId?: string;
  source?: LineageReference;
  result?: LineageReference;
  metadata: Readonly<Record<string, unknown>>;
}>;

export function createActivityLineageEvent(
  input: ActivityLineageEvent,
): ActivityLineageEvent {
  if (
    !input.id ||
    !input.workspaceId ||
    !input.subject.id ||
    !input.eventType ||
    !input.summary ||
    !input.occurredAt
  ) {
    throw new Error("activity_lineage_invalid");
  }
  return deepFreeze({
    ...input,
    subject: { ...input.subject },
    ...(input.source ? { source: { ...input.source } } : {}),
    ...(input.result ? { result: { ...input.result } } : {}),
    metadata: { ...input.metadata },
  });
}

export function orderActivityLineage(
  events: readonly ActivityLineageEvent[],
  direction: "ascending" | "descending" = "descending",
) {
  const multiplier = direction === "ascending" ? 1 : -1;
  return Object.freeze(
    [...events].sort(
      (left, right) =>
        (Date.parse(left.occurredAt) - Date.parse(right.occurredAt)) *
          multiplier ||
        left.id.localeCompare(right.id) * multiplier,
    ),
  );
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
