import type { CompositionConcentrationPolicy } from "./contracts";
export const COMPOSITION_CONCENTRATION_POLICY: CompositionConcentrationPolicy = Object.freeze({
  version: "portfolio-composition-concentration-v1",
  minimumEvidenceCoverage: 0.6,
  moderateThreshold: 0.4,
  highThreshold: 0.6,
  criticalThreshold: 0.8,
  seasonalWindowMonths: 4,
});
