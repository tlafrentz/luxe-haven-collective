import type { Identifier } from "../../kernel";
import type { ConfidenceLevel } from "../../scoring";
import { LearningReport, type LearningArtifact } from "./learning-report";
import type { LearningReportId } from "./learning-id";

export class LearningCollection implements Iterable<LearningReport> {
  private constructor(private readonly values: readonly LearningReport[]) { const ids = values.map((value) => value.id.value); if (new Set(ids).size !== ids.length) throw new RangeError("Learning report IDs must be unique."); this.values = Object.freeze([...values]); }
  public static empty(): LearningCollection { return new LearningCollection([]); }
  public static create(values: readonly LearningReport[]): LearningCollection { return new LearningCollection(values); }
  public get size(): number { return this.values.length; } public get isEmpty(): boolean { return this.size === 0; }
  public get(id: LearningReportId): LearningReport | undefined { return this.values.find((value) => value.id.equals(id)); }
  public require(id: LearningReportId): LearningReport { const value = this.get(id); if (!value) throw new RangeError(`Learning report not found: ${id.value}.`); return value; }
  public add(value: LearningReport): LearningCollection { return LearningCollection.create([...this.values, value]); }
  public filter(predicate: (value: LearningReport) => boolean): LearningCollection { return LearningCollection.create(this.values.filter(predicate)); }
  public withConfidence(level: ConfidenceLevel): LearningCollection { return this.filter((value) => value.confidence.level === level); }
  public containing(kind: LearningArtifact["kind"]): LearningCollection { return this.filter((value) => value.artifacts.some((artifact) => artifact.kind === kind)); }
  public tracing(id: Identifier): LearningCollection { return this.filter((value) => value.artifacts.some((artifact) => artifact.explainability.supportingOutcomeIds.some((entry) => entry.equals(id)) || artifact.explainability.supportingIntelligenceIds.some((entry) => entry.equals(id)) || Object.values(artifact.explainability.lineage).some((ids) => ids.some((entry) => entry.equals(id))))); }
  public groupByConfidence(): ReadonlyMap<ConfidenceLevel, LearningCollection> { const groups = new Map<ConfidenceLevel, LearningReport[]>(); for (const value of this.values) groups.set(value.confidence.level, [...(groups.get(value.confidence.level) ?? []), value]); return new Map([...groups].map(([level, reports]) => [level, LearningCollection.create(reports)])); }
  public countArtifacts(): Readonly<Record<LearningArtifact["kind"], number>> { const values = this.values.flatMap((report) => report.artifacts); return Object.freeze({ "learning-insight": values.filter((value) => value.kind === "learning-insight").length, "policy-improvement": values.filter((value) => value.kind === "policy-improvement").length, "scoring-improvement": values.filter((value) => value.kind === "scoring-improvement").length, "confidence-calibration": values.filter((value) => value.kind === "confidence-calibration").length }); }
  public toArray(): readonly LearningReport[] { return [...this.values]; } public [Symbol.iterator](): Iterator<LearningReport> { return this.values[Symbol.iterator](); }
}
