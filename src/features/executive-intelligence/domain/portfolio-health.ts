import type {
  HpmHealthStatus,
  HpmMeasurementStatus,
  HpmScoreChange,
} from "@/features/hpm";

export type PortfolioHealth = {
  score: number | null;
  healthStatus: HpmHealthStatus;
  measurementStatus: HpmMeasurementStatus;
  confidence: number | null;
  change: HpmScoreChange | null;
  headline: string;
  summary: string;
};
