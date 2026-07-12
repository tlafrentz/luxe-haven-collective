import {
  bookingSourceConcentrationOpportunityDetector,
  cancellationsOpportunityDetector,
  gapNightOpportunityDetector,
  lowWeekdayOccupancyOpportunityDetector,
  paymentsOpportunityDetector,
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
  ];
