import { plansBySlug, type LifecycleStage, type PlanSlug } from "@/lib/plans";

export type Audience =
  | "new-operator"
  | "existing-host"
  | "portfolio"
  | "enterprise";
export type PropertyCount = "1" | "2-5" | "6-20" | "20+";
export type PrimaryGoal =
  | "revenue"
  | "guest-experience"
  | "investment"
  | "operations"
  | "growth";

export type QuizAnswers = {
  audience?: Audience;
  propertyCount?: PropertyCount;
  primaryGoal?: PrimaryGoal;
  integrations?: string[];
};

const planOrder: PlanSlug[] = ["starter", "professional", "portfolio", "enterprise"];

const goalStageEmphasis: Record<PrimaryGoal, LifecycleStage> = {
  revenue: "decide",
  "guest-experience": "execute",
  investment: "decide",
  operations: "execute",
  growth: "understand",
};

export function recommendPlan(answers: QuizAnswers): {
  planSlug: PlanSlug;
  matchingFeatures: string[];
  alternatives: PlanSlug[];
} {
  const { audience, propertyCount, primaryGoal } = answers;

  let planSlug: PlanSlug = "professional";

  if (audience === "enterprise" || propertyCount === "20+") {
    planSlug = "enterprise";
  } else if (audience === "portfolio" || propertyCount === "6-20") {
    planSlug = "portfolio";
  } else if (
    audience === "existing-host" &&
    (propertyCount === "2-5" ||
      primaryGoal === "operations" ||
      primaryGoal === "growth")
  ) {
    planSlug = "professional";
  } else if (audience === "new-operator" && propertyCount === "1") {
    planSlug = "starter";
  }

  const plan = plansBySlug[planSlug];
  const emphasisStage = primaryGoal ? goalStageEmphasis[primaryGoal] : undefined;
  const emphasisFeatures = emphasisStage
    ? plan.featuresByStage[emphasisStage]
    : [];
  const otherFeatures = Object.entries(plan.featuresByStage)
    .filter(([stage]) => stage !== emphasisStage)
    .flatMap(([, features]) => features);

  const matchingFeatures = Array.from(
    new Set([...emphasisFeatures, ...otherFeatures]),
  ).slice(0, 3);

  const index = planOrder.indexOf(planSlug);
  const alternatives = planOrder.filter((_, i) => Math.abs(i - index) === 1);

  return { planSlug, matchingFeatures, alternatives };
}
