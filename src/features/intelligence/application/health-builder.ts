import type { IntelligenceAnalysis, IntelligenceHealth } from "../domain";
export interface HealthBuilder<TAnalysis extends IntelligenceAnalysis>{
  build(analyses: readonly TAnalysis[]): IntelligenceHealth;
}
