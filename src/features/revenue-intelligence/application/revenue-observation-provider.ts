import {
  ObservationCollection,
  type AnyObservation,
  type ObservationProvider,
} from "@/platform/observations";

import type {
  RevenueIntelligence,
} from "../types";

import {
  mapBookingPerformance,
} from "./map-booking-performance";
import {
  mapOccupancyPerformance,
} from "./map-occupancy-performance";
import {
  mapOpportunityEvidence,
} from "./map-opportunity-evidence";
import {
  mapRevenuePerformance,
} from "./map-revenue-performance";
import {
  parseRevenueObservationDate,
} from "./revenue-observation-shared";
import {
  REVENUE_OBSERVATION_CAPABILITY,
} from "./revenue-observation-types";

export class RevenueObservationProvider
implements ObservationProvider<RevenueIntelligence> {
  public readonly capability =
    REVENUE_OBSERVATION_CAPABILITY;

  public build(
    input: RevenueIntelligence,
  ): ObservationCollection {
    const recordedAt =
      parseRevenueObservationDate(
        input.generatedAt,
        "Revenue intelligence generatedAt",
      );

    const current = input.report.current;

    const observations: AnyObservation[] = [
      ...mapRevenuePerformance(
        current,
        recordedAt,
      ),
      ...mapOccupancyPerformance(
        current,
        recordedAt,
      ),
      ...mapBookingPerformance(
        current,
        recordedAt,
      ),
      ...input.opportunityReport.opportunities.flatMap(
        (opportunity) =>
          mapOpportunityEvidence(
            opportunity,
            recordedAt,
          ),
      ),
    ];

    return ObservationCollection.create(
      observations,
    );
  }
}

export const revenueObservationProvider =
  new RevenueObservationProvider();
