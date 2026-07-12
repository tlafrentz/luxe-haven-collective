import {
  bookingSourceConcentrationOpportunityDetector,
  cancellationsOpportunityDetector,
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
  ];
