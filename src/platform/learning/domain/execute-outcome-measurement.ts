import type { LearningMetricValue } from "./outcome-measurement";
import type { LearningConfidence } from "./learning-lineage";

export type ExecuteMeasurementStatus =
  | "draft" | "scheduled" | "awaiting-data" | "ready-to-measure" | "in-progress"
  | "awaiting-review" | "finalized" | "inconclusive" | "not-measurable"
  | "cancelled" | "archived";

export type ExecuteOutcomeClassification =
  | "achieved" | "partially-achieved" | "not-achieved" | "inconclusive" | "not-measurable";

export type ExecuteDataQuality = "complete" | "sufficient" | "limited" | "conflicting" | "stale" | "missing" | "invalid";

export type ExecuteMeasurementWindow = Readonly<{
  start: string;
  end: string;
  earliestMeasurementAt?: string;
  targetMeasurementAt?: string;
  followUpAt?: string;
  gracePeriodDays: number;
  timezone: string;
}>;

export type ExecuteComparisonRule = Readonly<{
  type: "absolute-change" | "percentage-change" | "percentage-point-change" | "threshold" | "range" | "boolean";
  direction: "increase" | "decrease" | "at-least" | "at-most" | "within" | "equals";
  target: LearningMetricValue;
  tolerance?: number;
  minimumMeaningfulChange?: number;
  partialAchievementThreshold?: number;
}>;

export type ExecuteGuardrailEvaluation = Readonly<{
  id: string;
  required: boolean;
  evaluated: boolean;
  passed?: boolean;
}>;

export type ExecuteOutcomeEvaluation = Readonly<{
  classification: ExecuteOutcomeClassification;
  absoluteVariance?: number;
  relativeVariance?: number;
  proposedByPolicy: true;
  policyVersion: string;
  confidence: LearningConfidence;
  reasons: readonly string[];
}>;

const transitions: Readonly<Record<ExecuteMeasurementStatus, readonly ExecuteMeasurementStatus[]>> = Object.freeze({
  draft: ["scheduled", "cancelled"],
  scheduled: ["awaiting-data", "ready-to-measure", "cancelled"],
  "awaiting-data": ["ready-to-measure", "in-progress", "not-measurable", "cancelled"],
  "ready-to-measure": ["in-progress", "not-measurable", "cancelled"],
  "in-progress": ["awaiting-review", "finalized", "inconclusive", "not-measurable"],
  "awaiting-review": ["finalized", "in-progress", "inconclusive", "not-measurable"],
  finalized: ["in-progress", "archived"],
  inconclusive: ["in-progress", "archived"],
  "not-measurable": ["in-progress", "archived"],
  cancelled: ["archived"],
  archived: [],
});

export class ExecuteOutcomeMeasurementError extends Error {
  public constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ExecuteOutcomeMeasurementError";
    Object.freeze(this);
  }
}

export function transitionExecuteMeasurement(from: ExecuteMeasurementStatus, to: ExecuteMeasurementStatus, reason?: string): ExecuteMeasurementStatus {
  if (!transitions[from].includes(to)) throw new ExecuteOutcomeMeasurementError("MEASUREMENT_TRANSITION_INVALID", `Invalid measurement transition: ${from} to ${to}.`);
  if (from === "finalized" && to === "in-progress" && !reason?.trim()) throw new ExecuteOutcomeMeasurementError("MEASUREMENT_OVERRIDE_REASON_REQUIRED", "Reopening a finalized measurement requires a reason.");
  return to;
}

export function validateExecuteMeasurementWindow(window: ExecuteMeasurementWindow): ExecuteMeasurementWindow {
  const start = Date.parse(window.start), end = Date.parse(window.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || window.gracePeriodDays < 0 || !window.timezone.trim()) {
    throw new ExecuteOutcomeMeasurementError("MEASUREMENT_WINDOW_INVALID", "Measurement window is invalid.");
  }
  if (window.earliestMeasurementAt && Date.parse(window.earliestMeasurementAt) > end) {
    throw new ExecuteOutcomeMeasurementError("MEASUREMENT_WINDOW_INVALID", "Earliest measurement cannot occur after the window closes.");
  }
  return Object.freeze({ ...window });
}

export function evaluateExecuteOutcome(input: Readonly<{
  baseline: LearningMetricValue;
  actual: LearningMetricValue;
  rule: ExecuteComparisonRule;
  guardrails: readonly ExecuteGuardrailEvaluation[];
  dataQuality: ExecuteDataQuality;
  confidence: LearningConfidence;
  policyVersion: string;
}>): ExecuteOutcomeEvaluation {
  assertCompatible(input.baseline, input.actual, input.rule.target);
  if (["missing", "invalid"].includes(input.dataQuality)) return result("not-measurable", input, ["Required measurement data is unavailable or invalid."]);
  if (["conflicting", "limited", "stale"].includes(input.dataQuality)) return result("inconclusive", input, ["Data quality cannot support a reliable conclusion."]);
  if (input.guardrails.some((guardrail) => guardrail.required && !guardrail.evaluated)) {
    throw new ExecuteOutcomeMeasurementError("MEASUREMENT_GUARDRAIL_INCOMPLETE", "Every required guardrail must be evaluated.");
  }
  const failedGuardrail = input.guardrails.some((guardrail) => guardrail.required && guardrail.passed === false);
  const baseline = numeric(input.baseline), actual = numeric(input.actual), target = numeric(input.rule.target);
  const absoluteVariance = actual - baseline;
  const relativeVariance = baseline === 0 ? undefined : absoluteVariance / Math.abs(baseline);
  const tolerance = input.rule.tolerance ?? 0;
  const met = compare(actual, target, input.rule, tolerance);
  const meaningful = meaningfulChange(absoluteVariance, relativeVariance, input.rule);
  const partial = !met && meaningful && partialThreshold(actual, baseline, target, input.rule);
  const classification: ExecuteOutcomeClassification = failedGuardrail ? "not-achieved" : met ? "achieved" : partial ? "partially-achieved" : "not-achieved";
  return Object.freeze({ classification, absoluteVariance, ...(relativeVariance === undefined ? {} : { relativeVariance }), proposedByPolicy: true, policyVersion: input.policyVersion, confidence: input.confidence, reasons: Object.freeze(failedGuardrail ? ["A required guardrail failed."] : [met ? "The configured target was met." : partial ? "Meaningful improvement occurred without fully meeting the target." : "The configured target was not met."]) });
}

function result(classification: ExecuteOutcomeClassification, input: { policyVersion: string; confidence: LearningConfidence }, reasons: string[]): ExecuteOutcomeEvaluation {
  return Object.freeze({ classification, proposedByPolicy: true, policyVersion: input.policyVersion, confidence: input.confidence, reasons: Object.freeze(reasons) });
}
function numeric(value: LearningMetricValue): number {
  if (typeof value.value !== "number" || !Number.isFinite(value.value)) throw new ExecuteOutcomeMeasurementError("MEASUREMENT_UNIT_MISMATCH", "This comparison requires numeric values.");
  return value.value;
}
function assertCompatible(...values: LearningMetricValue[]): void {
  const [first, ...rest] = values;
  if (!first || rest.some((value) => value.type !== first.type || value.unit !== first.unit || value.currency !== first.currency)) throw new ExecuteOutcomeMeasurementError("MEASUREMENT_UNIT_MISMATCH", "Baseline, target, and actual units must match.");
}
function compare(actual: number, target: number, rule: ExecuteComparisonRule, tolerance: number): boolean {
  if (rule.direction === "at-least" || rule.direction === "increase") return actual >= target - tolerance;
  if (rule.direction === "at-most" || rule.direction === "decrease") return actual <= target + tolerance;
  if (rule.direction === "equals") return Math.abs(actual - target) <= tolerance;
  if (rule.direction === "within") return Math.abs(actual - target) <= tolerance;
  return false;
}
function meaningfulChange(absolute: number, relative: number | undefined, rule: ExecuteComparisonRule): boolean {
  const threshold = rule.minimumMeaningfulChange ?? 0;
  const change = rule.type === "percentage-change" ? relative : absolute;
  if (change === undefined) throw new ExecuteOutcomeMeasurementError("MEASUREMENT_DATA_INSUFFICIENT", "A percentage change cannot be calculated from a zero baseline.");
  return rule.direction === "decrease" || rule.direction === "at-most" ? change <= -threshold : change >= threshold;
}
function partialThreshold(actual: number, baseline: number, target: number, rule: ExecuteComparisonRule): boolean {
  const threshold = rule.partialAchievementThreshold;
  if (threshold === undefined) return false;
  const required = Math.abs(target - baseline);
  return required > 0 && Math.abs(actual - baseline) / required >= threshold;
}
