export const HPM_PILLARS = [
  "investment",
  "financial",
  "revenue",
  "operations",
  "guest-experience",
  "risk",
  "growth",
] as const;

export type HpmPillar =
  (typeof HPM_PILLARS)[number];

export const HPM_PILLAR_LABELS: Record<
  HpmPillar,
  string
> = {
  investment: "Investment",
  financial: "Financial",
  revenue: "Revenue",
  operations: "Operations",
  "guest-experience": "Guest experience",
  risk: "Risk",
  growth: "Growth",
};

export const HPM_PILLAR_QUESTIONS: Record<
  HpmPillar,
  string
> = {
  investment:
    "Did we acquire the right hospitality asset?",
  financial:
    "Is the business financially healthy?",
  revenue:
    "Are we maximizing revenue potential?",
  operations:
    "Can we consistently deliver exceptional hospitality?",
  "guest-experience":
    "Are guests delighted?",
  risk:
    "What threatens future performance?",
  growth:
    "Are we building a stronger business over time?",
};
