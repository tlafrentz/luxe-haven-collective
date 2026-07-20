import type { ObservationValue } from "../../observations";
import type { OutcomeId } from "./outcome-id";
import { normalizeOutcomeLineage, type OutcomeLineage } from "./outcome-lineage";
import { OUTCOME_STATUSES, type OutcomeStatus } from "./outcome-status";
import type { OutcomeType } from "./outcome-type";

export type OutcomeInput = Readonly<{
  id: OutcomeId;
  title: string;
  summary: string;
  type: OutcomeType;
  status: OutcomeStatus;
  successful: boolean;
  startedAt: Date;
  completedAt?: Date;
  metrics?: Readonly<Record<string, number>>;
  result?: Readonly<Record<string, ObservationValue>>;
  notes?: readonly string[];
  lineage: OutcomeLineage;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

export class Outcome {
  public readonly id: OutcomeId;
  public readonly title: string;
  public readonly summary: string;
  public readonly type: OutcomeType;
  public readonly status: OutcomeStatus;
  public readonly successful: boolean;
  public readonly startedAt: Date;
  public readonly completedAt?: Date;
  public readonly metrics: Readonly<Record<string, number>>;
  public readonly result: Readonly<Record<string, ObservationValue>>;
  public readonly notes: readonly string[];
  public readonly lineage: OutcomeLineage;
  public readonly metadata: Readonly<Record<string, ObservationValue>>;
  private constructor(input: OutcomeInput) {
    if (!OUTCOME_STATUSES.includes(input.status)) throw new TypeError("Outcome status is invalid.");
    const startedAt = date(input.startedAt, "Outcome start date"), completedAt = input.completedAt ? date(input.completedAt, "Outcome completion date") : undefined;
    const terminal = input.status === "completed" || input.status === "failed" || input.status === "cancelled" || input.status === "timed-out";
    if (terminal && !completedAt) throw new TypeError(`Outcome status "${input.status}" requires a completion date.`);
    if (completedAt && completedAt < startedAt) throw new RangeError("Outcome completion cannot precede its start.");
    if (input.status === "completed" && !input.successful) throw new TypeError("A completed Outcome must be successful.");
    if ((input.status === "failed" || input.status === "cancelled" || input.status === "timed-out") && input.successful) throw new TypeError(`A ${input.status} Outcome cannot be successful.`);
    this.id = input.id; this.title = text(input.title, "Outcome title"); this.summary = text(input.summary, "Outcome summary");
    this.type = text(input.type, "Outcome type"); this.status = input.status; this.successful = input.successful;
    this.startedAt = startedAt; this.completedAt = completedAt;
    this.metrics = metrics(input.metrics); this.result = Object.freeze({ ...input.result });
    this.notes = Object.freeze([...new Set((input.notes ?? []).map((note) => note.trim()).filter(Boolean))]);
    this.lineage = normalizeOutcomeLineage(input.lineage); this.metadata = Object.freeze({ ...input.metadata });
    Object.freeze(this);
  }
  public static create(input: OutcomeInput): Outcome { return new Outcome(input); }
  public get durationMs(): number | undefined { return this.completedAt ? this.completedAt.getTime() - this.startedAt.getTime() : undefined; }
  public traces(identifier: { value: string }): boolean {
    return Object.values(this.lineage).some((values) => values.some((value) => value.value === identifier.value));
  }
}
function metrics(value: Readonly<Record<string, number>> = {}): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const [key, measurement] of Object.entries(value)) {
    const normalized = text(key, "Outcome metric name");
    if (!Number.isFinite(measurement)) throw new TypeError(`Outcome metric "${normalized}" must be finite.`);
    result[normalized] = measurement;
  }
  return Object.freeze(result);
}
function date(value: Date, field: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`); return result; }
function text(value: string, field: string): string { const normalized = value.trim(); if (!normalized) throw new TypeError(`${field} cannot be empty.`); return normalized; }
