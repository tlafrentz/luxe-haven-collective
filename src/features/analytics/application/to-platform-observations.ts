import { Observation, ObservationCollection, createObservationId, type AnyObservation } from "@/platform/observations";

import type { AnalyticsMetricProjection } from "../types";

/** Explicit interoperability boundary; Analytics calculations remain fact-native. */
export function toPlatformObservations(metrics: readonly AnalyticsMetricProjection[]): ObservationCollection {
  return ObservationCollection.create(metrics.map((metric): AnyObservation => {
    const measuredAt = validDate(metric.measuredAt);
    return Observation.create({
      id: createObservationId(`observation-analytics-${slug(metric.scope.id)}-${metric.metric}-${metric.period.startDate}-${metric.period.endDate}`),
      type: `analytics.${metric.metric}`,
      subject: metric.scope,
      label: metric.label,
      value: metric.value,
      source: { type: "calculation", name: "analytics", referenceId: `${metric.scope.id}:${metric.metric}`, version: metric.calculationVersion },
      observedAt: measuredAt,
      recordedAt: measuredAt,
      unit: { type: metric.unit, symbol: unitSymbol(metric.unit) },
      provenance: { retrievedAt: measuredAt, effectiveAt: measuredAt, notes: `Calculated by ${metric.calculationVersion}.` },
      metadata: { periodStart: metric.period.startDate, periodEnd: metric.period.endDate, calculationVersion: metric.calculationVersion },
    });
  }));
}

function unitSymbol(unit: AnalyticsMetricProjection["unit"]): string { return unit === "currency" || unit === "currency-per-night" ? "USD" : unit === "percentage" ? "%" : unit === "days" ? "days" : "count"; }
function validDate(value: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError("Analytics metric measuredAt must be valid."); return result; }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
