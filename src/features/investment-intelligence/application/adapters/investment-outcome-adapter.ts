/** Compatibility exports; canonical capture creates one Outcome and no Learning. */
export {
  recordInvestmentActionOutcome as recordInvestmentOutcome,
} from "../record-investment-action-outcome";

export type {
  RecordInvestmentActionOutcomeCommand as RecordInvestmentOutcomeInput,
} from "../types/investment-outcome-types";
