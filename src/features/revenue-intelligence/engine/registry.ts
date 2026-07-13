import {
  bookingSourceConcentrationOpportunityDetector,
  cancellationsOpportunityDetector,
  gapNightOpportunityDetector,
  lowWeekdayOccupancyOpportunityDetector,
  paymentsOpportunityDetector,
  weekendPricingOpportunityDetector,
} from "../detectors";

import type {
  OpportunityDetector,
} from "../types";

export const opportunityDetectors: readonly OpportunityDetector[] =
  [
    paymentsOpportunityDetector,
    cancellationsOpportunityDetector,
    bookingSourceConcentrationOpportunityDetector,
    lowWeekdayOccupancyOpportunityDetector,
    gapNightOpportunityDetector,
    weekendPricingOpportunityDetector,
  ];
