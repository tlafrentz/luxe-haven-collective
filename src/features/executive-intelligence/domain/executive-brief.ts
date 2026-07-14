export type ExecutiveBriefTone =
  | "positive"
  | "balanced"
  | "warning"
  | "critical";

export type ExecutiveBrief = {
  headline: string;
  summary: string;
  tone: ExecutiveBriefTone;
  highlights: string[];
  concerns: string[];
  recommendedFocus: string;
};
