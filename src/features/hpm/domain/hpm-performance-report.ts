import type {
  HpmPillar,
} from "./hpm-pillar";

import type {
  HpmCompositeScore,
  HpmPillarScore,
} from "./hpm-score";

export type HpmPerformanceScope =
  | {
      type: "portfolio";
      propertyId: null;
      propertyCount: number;
    }
  | {
      type: "property";
      propertyId: string;
      propertyCount: 1;
    };

export type HpmDataCoverage = {
  measuredPillars: HpmPillar[];
  partialPillars: HpmPillar[];
  unavailablePillars: HpmPillar[];
  measuredPillarCount: number;
  totalPillarCount: number;
  coveragePercentage: number;
};

export type HpmPerformanceReport = {
  scope: HpmPerformanceScope;
  overall: HpmCompositeScore;
  pillars: Record<HpmPillar, HpmPillarScore>;
  dataCoverage: HpmDataCoverage;
  generatedAt: string;
};
