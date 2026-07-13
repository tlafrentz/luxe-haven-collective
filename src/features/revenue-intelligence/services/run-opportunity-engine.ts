import {
  deduplicateOpportunities,
} from "../engine/deduplicator";
import {
  opportunityDetectors,
} from "../engine/registry";
import {
  sortOpportunities,
} from "../engine/sorter";
import {
  summarizeOpportunities,
} from "../engine/summarizer";

import type {
  OpportunityDetectionContext,
  OpportunityDetector,
  OpportunityReport,
  RevenueOpportunity,
} from "../types";

type RunOpportunityEngineParams = {
  context: OpportunityDetectionContext;
  detectors?: readonly OpportunityDetector[];
};

function executeDetectors({
  detectors,
  context,
}: {
  detectors: readonly OpportunityDetector[];
  context: OpportunityDetectionContext;
}): RevenueOpportunity[] {
  return detectors.flatMap(
    (detector) => detector.detect(context),
  );
}

export function runOpportunityEngine({
  context,
  detectors = opportunityDetectors,
}: RunOpportunityEngineParams): OpportunityReport {
  const detectedOpportunities =
    executeDetectors({
      detectors,
      context,
    });

  const uniqueOpportunities =
    deduplicateOpportunities(
      detectedOpportunities,
    );

  const opportunities =
    sortOpportunities(uniqueOpportunities);

  return {
    opportunities,
    summary:
      summarizeOpportunities(opportunities),
    generatedAt: context.detectedAt,
  };
}
