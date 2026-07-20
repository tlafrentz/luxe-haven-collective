import {
  ObservationBuilder,
  type AnyObservation,
  type ObservationUnitInput,
} from "@/platform/observations";

import type {
  OpportunityEvidence,
  RevenueOpportunity,
} from "../types";

import {
  COUNT_UNIT,
  CURRENCY_UNIT,
  DAYS_UNIT,
  NIGHTS_UNIT,
  PERCENTAGE_UNIT,
  REVENUE_OBSERVATION_SOURCE,
} from "./revenue-observation-shared";
import {
  REVENUE_OBSERVATION_TYPES,
} from "./revenue-observation-types";

export function mapOpportunityEvidence(
  opportunity: RevenueOpportunity,
  recordedAt: Date,
): readonly AnyObservation[] {
  return opportunity.evidence.map(
    (evidence) =>
      buildOpportunityEvidenceObservation(
        opportunity,
        evidence,
        recordedAt,
      ),
  );
}

function buildOpportunityEvidenceObservation(
  opportunity: RevenueOpportunity,
  evidence: OpportunityEvidence,
  recordedAt: Date,
): AnyObservation {
  const observedAt = new Date(
    opportunity.detectedAt,
  );

  if (Number.isNaN(observedAt.getTime())) {
    throw new TypeError(
      "Revenue opportunity detectedAt must be a valid date string.",
    );
  }

  const subject =
    opportunity.propertyId === null
      ? {
          type: "portfolio",
          id: "portfolio",
        }
      : {
          type: "property",
          id: opportunity.propertyId,
        };

  let builder = ObservationBuilder.create()
    .withType(
      createOpportunityEvidenceType(
        opportunity,
        evidence,
      ),
    )
    .concerning(subject)
    .withLabel(evidence.label)
    .withValue(evidence.value)
    .fromSource({
      ...REVENUE_OBSERVATION_SOURCE,
      referenceId: opportunity.id,
    })
    .observedAt(observedAt)
    .recordedAt(recordedAt)
    .withProvenance({
      retrievedAt: recordedAt,
      effectiveAt: observedAt,
      notes:
        `Mapped from ${opportunity.type} opportunity evidence.`,
    })
    .withMetadata({
      opportunityId: opportunity.id,
      detectorId: opportunity.detectorId,
      opportunityType: opportunity.type,
      category: opportunity.category,
      severity: opportunity.severity,
      confidence: opportunity.confidence,
      status: opportunity.status,
      evidenceKey: evidence.key,
      ...(opportunity.dateRange
        ? {
            dateRangeStart:
              opportunity.dateRange.startDate,
            dateRangeEnd:
              opportunity.dateRange.endDate,
          }
        : {}),
    });

  const unit = mapEvidenceUnit(evidence);

  if (unit) {
    builder = builder.measuredIn(unit);
  }

  return builder.build();
}

function createOpportunityEvidenceType(
  opportunity: RevenueOpportunity,
  evidence: OpportunityEvidence,
): string {
  return [
    REVENUE_OBSERVATION_TYPES
      .opportunityEvidence,
    normalizeTypeSegment(opportunity.type),
    normalizeTypeSegment(evidence.key),
  ].join(".");
}

function normalizeTypeSegment(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapEvidenceUnit(
  evidence: OpportunityEvidence,
): ObservationUnitInput | undefined {
  switch (evidence.unit) {
    case "currency":
      return CURRENCY_UNIT;
    case "percentage":
      return PERCENTAGE_UNIT;
    case "days":
      return DAYS_UNIT;
    case "nights":
      return NIGHTS_UNIT;
    case "count":
      return COUNT_UNIT;
    case undefined:
      return undefined;
  }
}
