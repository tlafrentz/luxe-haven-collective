export type AcquisitionRecommendationPolicy = {
  readonly strongBuyMinimumScore: number;
  readonly buyMinimumScore: number;
  readonly buyWithConditionsMinimumScore: number;
  readonly waitMinimumScore: number;

  readonly strongBuyMaximumRiskExposure: number;
  readonly buyMaximumRiskExposure: number;
  readonly buyWithConditionsMaximumRiskExposure: number;

  readonly strongBuyMinimumPositiveEvidence: number;
  readonly buyMinimumPositiveEvidence: number;
};

export const DEFAULT_ACQUISITION_RECOMMENDATION_POLICY: AcquisitionRecommendationPolicy = {
  strongBuyMinimumScore: 85,
  buyMinimumScore: 70,
  buyWithConditionsMinimumScore: 55,
  waitMinimumScore: 40,

  strongBuyMaximumRiskExposure: 25,
  buyMaximumRiskExposure: 45,
  buyWithConditionsMaximumRiskExposure: 65,

  strongBuyMinimumPositiveEvidence: 3,
  buyMinimumPositiveEvidence: 2,
};
