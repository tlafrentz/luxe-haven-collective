import type {
  AcquisitionRecommendationPolicy,
} from "./acquisition-recommendation-policy";

import type {
  InvestmentEvidencePolicy,
} from "./investment-evidence-policy";

import type {
  InvestmentRiskPolicy,
} from "./investment-risk-policy";

import type {
  InvestmentScoringPolicy,
} from "./investment-scoring-policy";

export type InvestmentDecisionPolicies = {
  readonly risk?: InvestmentRiskPolicy;
  readonly scoring?: InvestmentScoringPolicy;
  readonly evidence?: InvestmentEvidencePolicy;
  readonly recommendation?: AcquisitionRecommendationPolicy;
};
