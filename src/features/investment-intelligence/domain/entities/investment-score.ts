import type { Score } from "../value-objects";

export interface InvestmentScore {
  readonly overall: Score;

  readonly revenuePotential: Score;
  readonly financialStrength: Score;
  readonly marketStrength: Score;
  readonly competitivePosition: Score;
  readonly riskExposure: Score;
}
