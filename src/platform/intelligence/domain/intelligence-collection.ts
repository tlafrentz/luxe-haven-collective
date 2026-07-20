import type { Identifier } from "../../kernel";
import type { ConfidenceLevel } from "../../scoring";
import { IntelligenceReport, type IntelligenceArtifact } from "./intelligence-report";
import type { IntelligenceReportId } from "./intelligence-id";

export class IntelligenceCollection implements Iterable<IntelligenceReport> {
  private constructor(private readonly values: readonly IntelligenceReport[]) {
    const ids = values.map((value) => value.id.value); if (new Set(ids).size !== ids.length) throw new RangeError("Intelligence report IDs must be unique.");
    this.values = Object.freeze([...values]);
  }
  public static empty(): IntelligenceCollection { return new IntelligenceCollection([]); }
  public static create(values: readonly IntelligenceReport[]): IntelligenceCollection { return new IntelligenceCollection(values); }
  public get size(): number { return this.values.length; }
  public get isEmpty(): boolean { return this.size === 0; }
  public get(id: IntelligenceReportId): IntelligenceReport | undefined { return this.values.find((value) => value.id.equals(id)); }
  public require(id: IntelligenceReportId): IntelligenceReport { const value = this.get(id); if (!value) throw new RangeError(`Intelligence report not found: ${id.value}.`); return value; }
  public add(value: IntelligenceReport): IntelligenceCollection { return IntelligenceCollection.create([...this.values, value]); }
  public filter(predicate: (value: IntelligenceReport) => boolean): IntelligenceCollection { return IntelligenceCollection.create(this.values.filter(predicate)); }
  public withConfidence(level: ConfidenceLevel): IntelligenceCollection { return this.filter((value) => value.confidence.level === level); }
  public containing(kind: IntelligenceArtifact["kind"]): IntelligenceCollection { return this.filter((value) => value.artifacts.some((artifact) => artifact.kind === kind)); }
  public tracing(id: Identifier): IntelligenceCollection { return this.filter((value) => value.artifacts.some((artifact) => artifact.explainability.supportingOutcomeIds.some((outcomeId) => outcomeId.equals(id)) || Object.values(artifact.explainability.lineage).some((ids) => ids.some((entry) => entry.equals(id))))); }
  public groupByConfidence(): ReadonlyMap<ConfidenceLevel, IntelligenceCollection> { const groups = new Map<ConfidenceLevel, IntelligenceReport[]>(); for (const value of this.values) groups.set(value.confidence.level, [...(groups.get(value.confidence.level) ?? []), value]); return new Map([...groups].map(([level, reports]) => [level, IntelligenceCollection.create(reports)])); }
  public countArtifacts(): Readonly<Record<IntelligenceArtifact["kind"], number>> { const artifacts = this.values.flatMap((value) => value.artifacts); return Object.freeze({ insight: artifacts.filter((value) => value.kind === "insight").length, trend: artifacts.filter((value) => value.kind === "trend").length, opportunity: artifacts.filter((value) => value.kind === "opportunity").length, forecast: artifacts.filter((value) => value.kind === "forecast").length, anomaly: artifacts.filter((value) => value.kind === "anomaly").length }); }
  public toArray(): readonly IntelligenceReport[] { return [...this.values]; }
  public [Symbol.iterator](): Iterator<IntelligenceReport> { return this.values[Symbol.iterator](); }
}
