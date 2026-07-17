import type { IntelligenceAnalysis } from "../domain";
export interface Analyzer<TInput,TAnalysis extends IntelligenceAnalysis>{
  analyze(input:TInput):TAnalysis;
}
