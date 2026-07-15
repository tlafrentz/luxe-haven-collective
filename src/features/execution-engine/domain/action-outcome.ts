export type ActionMeasuredImpact = {
  revenue?: number;
  occupancy?: number;
  costSavings?: number;
  reviewScore?: number;
};

export type ActionOutcome = {
  summary: string;

  successful: boolean;

  measuredImpact?: ActionMeasuredImpact;

  lessonsLearned?: string[];
};
