import type { ObservationValue } from "../../observations";
import type { ConfidenceAssessment } from "../../scoring";
import { date, text } from "./artifact-support";
import type { Anomaly } from "./anomaly";
import type { Forecast } from "./forecast";
import type { Insight } from "./insight";
import type { IntelligenceReportId } from "./intelligence-id";
import type { Opportunity } from "./opportunity";
import type { Trend } from "./trend";

export type IntelligenceArtifact = Insight | Trend | Opportunity | Forecast | Anomaly;
export type IntelligenceReportInput = Readonly<{
  id: IntelligenceReportId; title: string; summary: string; reportingPeriod: Readonly<{ start: Date; end: Date }>;
  insights?: readonly Insight[]; trends?: readonly Trend[]; opportunities?: readonly Opportunity[];
  forecasts?: readonly Forecast[]; anomalies?: readonly Anomaly[]; confidence: ConfidenceAssessment;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;
export class IntelligenceReport {
  public readonly id: IntelligenceReportId; public readonly title: string; public readonly summary: string;
  public readonly reportingPeriod: Readonly<{ start: Date; end: Date }>;
  public readonly insights: readonly Insight[]; public readonly trends: readonly Trend[]; public readonly opportunities: readonly Opportunity[];
  public readonly forecasts: readonly Forecast[]; public readonly anomalies: readonly Anomaly[];
  public readonly confidence: ConfidenceAssessment; public readonly metadata: Readonly<Record<string, ObservationValue>>;
  private constructor(input: IntelligenceReportInput) {
    const start = date(input.reportingPeriod.start, "Intelligence reporting period start"), end = date(input.reportingPeriod.end, "Intelligence reporting period end");
    if (end < start) throw new RangeError("Intelligence reporting period end cannot precede its start.");
    const artifacts = [...(input.insights ?? []), ...(input.trends ?? []), ...(input.opportunities ?? []), ...(input.forecasts ?? []), ...(input.anomalies ?? [])];
    const ids = artifacts.map((artifact) => artifact.id.value); if (new Set(ids).size !== ids.length) throw new RangeError("Intelligence artifact IDs must be unique within a report.");
    this.id = input.id; this.title = text(input.title, "Intelligence report title"); this.summary = text(input.summary, "Intelligence report summary");
    this.reportingPeriod = Object.freeze({ start, end }); this.insights = Object.freeze([...(input.insights ?? [])]); this.trends = Object.freeze([...(input.trends ?? [])]);
    this.opportunities = Object.freeze([...(input.opportunities ?? [])]); this.forecasts = Object.freeze([...(input.forecasts ?? [])]); this.anomalies = Object.freeze([...(input.anomalies ?? [])]);
    this.confidence = input.confidence; this.metadata = Object.freeze({ ...input.metadata }); Object.freeze(this);
  }
  public static create(input: IntelligenceReportInput): IntelligenceReport { return new IntelligenceReport(input); }
  public get artifacts(): readonly IntelligenceArtifact[] { return [...this.insights, ...this.trends, ...this.opportunities, ...this.forecasts, ...this.anomalies]; }
  public get artifactCount(): number { return this.artifacts.length; }
}
