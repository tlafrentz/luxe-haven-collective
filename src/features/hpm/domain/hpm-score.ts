import type {
  HpmPillar,
} from "./hpm-pillar";

export type HpmMeasurementStatus =
  | "measured"
  | "partial"
  | "unavailable";

export type HpmHealthStatus =
  | "excellent"
  | "healthy"
  | "watch"
  | "needs-attention"
  | "critical"
  | "unavailable";

export type HpmScoreDirection =
  | "up"
  | "down"
  | "neutral"
  | "unavailable";

export type HpmScoreChange = {
  difference: number;
  direction: HpmScoreDirection;
};

export type HpmScoreContributorType =
  | "strength"
  | "risk"
  | "opportunity"
  | "limitation";

export type HpmScoreContributor = {
  id: string;
  type: HpmScoreContributorType;
  title: string;
  description: string;
  impact?: number;
};

export type HpmPillarScore = {
  pillar: HpmPillar;
  measurementStatus: HpmMeasurementStatus;
  score: number | null;
  healthStatus: HpmHealthStatus;
  confidence: number | null;
  change: HpmScoreChange | null;
  contributors: HpmScoreContributor[];
  unavailableReason?: string;
};

export type HpmCompositeScore = {
  score: number | null;
  healthStatus: HpmHealthStatus;
  measurementStatus: HpmMeasurementStatus;
  confidence: number | null;
  change: HpmScoreChange | null;
};
