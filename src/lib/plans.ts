import { hpmTierMonthlyPrices } from "./pricing/hpm-tier-prices";

export type LifecycleStage =
  | "observe"
  | "understand"
  | "decide"
  | "execute"
  | "learn";

export const lifecycleStages: {
  slug: LifecycleStage;
  label: string;
  description: string;
  capabilities: { name: string; description: string }[];
}[] = [
  {
    slug: "observe",
    label: "Observe",
    description:
      "See what is happening across every property with connected revenue and financial signals.",
    capabilities: [
      {
        name: "Revenue Intelligence",
        description:
          "Track pricing, occupancy, and demand signals as they happen.",
      },
      {
        name: "Financial Intelligence",
        description:
          "Consolidate income, expenses, and owner statements in one view.",
      },
    ],
  },
  {
    slug: "understand",
    label: "Understand",
    description:
      "Turn raw signals into drivers leadership and owners can act on.",
    capabilities: [
      {
        name: "Executive Intelligence",
        description:
          "Portfolio-level summaries built for owners and leadership.",
      },
      {
        name: "Portfolio Intelligence",
        description:
          "Compare performance across properties and identify outliers.",
      },
    ],
  },
  {
    slug: "decide",
    label: "Decide",
    description:
      "Weigh the options with evidence before committing resources.",
    capabilities: [
      {
        name: "Investment Intelligence",
        description:
          "Underwrite new opportunities with traceable assumptions.",
      },
      {
        name: "Revenue Decisions",
        description:
          "Prioritize pricing and positioning changes with the clearest upside.",
      },
    ],
  },
  {
    slug: "execute",
    label: "Execute",
    description:
      "Turn decisions into tracked work without losing context along the way.",
    capabilities: [
      {
        name: "Actions",
        description: "Assign and track the work that follows every decision.",
      },
      {
        name: "Automation",
        description:
          "Automate the repeatable steps so teams focus on judgment calls.",
      },
      {
        name: "Operations",
        description:
          "Run day-to-day property operations from a single workspace.",
      },
    ],
  },
  {
    slug: "learn",
    label: "Learn",
    description:
      "Close the loop by measuring outcomes and feeding them back into future decisions.",
    capabilities: [
      {
        name: "Outcomes",
        description: "Measure whether executed actions delivered results.",
      },
      {
        name: "Knowledge",
        description:
          "Preserve what worked so it informs the next decision.",
      },
      {
        name: "Improvement",
        description:
          "Continuously refine playbooks based on measured performance.",
      },
    ],
  },
];

export const lifecycleStageBySlug: Record<
  LifecycleStage,
  (typeof lifecycleStages)[number]
> = Object.fromEntries(
  lifecycleStages.map((stage) => [stage.slug, stage]),
) as Record<LifecycleStage, (typeof lifecycleStages)[number]>;

export type PlanSlug = "starter" | "professional" | "portfolio" | "enterprise";

const ANNUAL_DISCOUNT = 0.2;

function annualMonthlyEquivalent(monthlyPrice: number | null) {
  if (monthlyPrice === null) return null;
  return Math.round(monthlyPrice * (1 - ANNUAL_DISCOUNT));
}

function annualSavingsLabel(monthlyPrice: number | null) {
  if (monthlyPrice === null) return null;
  const annualSavings = Math.round(monthlyPrice * 12 * ANNUAL_DISCOUNT);
  return `Save $${annualSavings.toLocaleString()}/yr`;
}

export type ComparisonValue = boolean | string;

export type Plan = {
  slug: PlanSlug;
  name: string;
  tagline: string;
  bestFor: string;
  popular?: boolean;
  monthlyPrice: number | null;
  annualMonthlyEquivalent: number | null;
  annualSavingsLabel: string | null;
  /** commerce_offers.id for the monthly-billed offer. Unset until populated in the commerce catalog. */
  offerIdMonthly?: string;
  /** commerce_offers.id for the annual-billed offer. Unset until populated in the commerce catalog. */
  offerIdAnnual?: string;
  featuresByStage: Record<LifecycleStage, string[]>;
  comparisonRow: {
    properties: string;
    users: string;
    observe: ComparisonValue;
    understand: ComparisonValue;
    decide: ComparisonValue;
    execute: ComparisonValue;
    learn: ComparisonValue;
    guidebookStudio: ComparisonValue;
    investmentIntelligence: ComparisonValue;
    prioritySupport: ComparisonValue;
    api: ComparisonValue;
    customReports: ComparisonValue;
    training: ComparisonValue;
  };
  whoItsFor: string[];
  implementation: string;
  support: string;
  roadmap?: string;
};

export const plans: Plan[] = [
  {
    slug: "starter",
    name: "Starter",
    tagline: "For individual owners getting their first performance system.",
    bestFor: "For individual owners",
    monthlyPrice: hpmTierMonthlyPrices.starter,
    annualMonthlyEquivalent: annualMonthlyEquivalent(
      hpmTierMonthlyPrices.starter,
    ),
    annualSavingsLabel: annualSavingsLabel(hpmTierMonthlyPrices.starter),
    offerIdMonthly: "oc001-hpm-starter-monthly",
    offerIdAnnual: "oc001-hpm-starter-annual",
    featuresByStage: {
      observe: ["Revenue Intelligence dashboard"],
      understand: ["Single-property performance summary"],
      decide: ["Basic pricing recommendations"],
      execute: ["Task tracking"],
      learn: ["Monthly outcome summary"],
    },
    comparisonRow: {
      properties: "1",
      users: "1",
      observe: true,
      understand: true,
      decide: "Basic",
      execute: true,
      learn: "Basic",
      guidebookStudio: false,
      investmentIntelligence: false,
      prioritySupport: false,
      api: false,
      customReports: false,
      training: false,
    },
    whoItsFor: [
      "First-time owners running a single property",
      "Owners who want a performance system without a team",
    ],
    implementation: "Self-serve setup, live in under a day.",
    support: "Email support with next-business-day response.",
  },
  {
    slug: "professional",
    name: "Professional",
    tagline: "For growing operators managing a handful of properties.",
    bestFor: "For growing operators",
    popular: true,
    monthlyPrice: hpmTierMonthlyPrices.professional,
    annualMonthlyEquivalent: annualMonthlyEquivalent(
      hpmTierMonthlyPrices.professional,
    ),
    annualSavingsLabel: annualSavingsLabel(hpmTierMonthlyPrices.professional),
    offerIdMonthly: "oc001-hpm-professional-monthly",
    offerIdAnnual: "oc001-hpm-professional-annual",
    featuresByStage: {
      observe: ["Revenue Intelligence", "Financial Intelligence"],
      understand: ["Executive Intelligence dashboards"],
      decide: ["Revenue decision recommendations"],
      execute: ["Actions", "Automation for repeatable tasks"],
      learn: ["Outcome tracking", "Knowledge library"],
    },
    comparisonRow: {
      properties: "Up to 5",
      users: "Up to 5",
      observe: true,
      understand: true,
      decide: true,
      execute: true,
      learn: true,
      guidebookStudio: true,
      investmentIntelligence: false,
      prioritySupport: true,
      api: false,
      customReports: "Standard",
      training: "Onboarding session",
    },
    whoItsFor: [
      "Operators managing 2-5 properties",
      "Teams ready to move from spreadsheets to one system",
    ],
    implementation: "Guided onboarding with a dedicated setup session.",
    support: "Priority email and chat support.",
  },
  {
    slug: "portfolio",
    name: "Portfolio",
    tagline: "For portfolio operators running properties as a team.",
    bestFor: "For enterprise teams",
    monthlyPrice: hpmTierMonthlyPrices.portfolio,
    annualMonthlyEquivalent: annualMonthlyEquivalent(
      hpmTierMonthlyPrices.portfolio,
    ),
    annualSavingsLabel: annualSavingsLabel(hpmTierMonthlyPrices.portfolio),
    offerIdMonthly: "oc001-hpm-portfolio-monthly",
    offerIdAnnual: "oc001-hpm-portfolio-annual",
    featuresByStage: {
      observe: ["Revenue Intelligence", "Financial Intelligence"],
      understand: ["Executive Intelligence", "Portfolio Intelligence"],
      decide: ["Investment Intelligence", "Revenue Decisions"],
      execute: ["Actions", "Automation", "Operations workspace"],
      learn: ["Outcomes", "Knowledge", "Improvement playbooks"],
    },
    comparisonRow: {
      properties: "Up to 20",
      users: "Up to 20",
      observe: true,
      understand: true,
      decide: true,
      execute: true,
      learn: true,
      guidebookStudio: true,
      investmentIntelligence: true,
      prioritySupport: true,
      api: "Read-only",
      customReports: true,
      training: "Team onboarding program",
    },
    whoItsFor: [
      "Portfolio operators running 6-20 properties",
      "Teams that need shared visibility across owners and staff",
    ],
    implementation: "Dedicated onboarding specialist and data migration support.",
    support: "Priority support with a named account contact.",
    roadmap: "Early access to new Investment Intelligence capabilities.",
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    tagline: "For large operators and management companies at scale.",
    bestFor: "For large operators and management companies",
    monthlyPrice: null,
    annualMonthlyEquivalent: null,
    annualSavingsLabel: null,
    featuresByStage: {
      observe: ["Revenue Intelligence", "Financial Intelligence"],
      understand: ["Executive Intelligence", "Portfolio Intelligence"],
      decide: ["Investment Intelligence", "Revenue Decisions"],
      execute: ["Actions", "Automation", "Operations workspace"],
      learn: ["Outcomes", "Knowledge", "Improvement playbooks"],
    },
    comparisonRow: {
      properties: "Unlimited",
      users: "Unlimited",
      observe: true,
      understand: true,
      decide: true,
      execute: true,
      learn: true,
      guidebookStudio: true,
      investmentIntelligence: true,
      prioritySupport: "Dedicated CSM",
      api: "Full API access",
      customReports: true,
      training: "Custom onboarding program",
    },
    whoItsFor: [
      "Management companies and large multi-owner portfolios",
      "Teams that need custom integrations or contractual SLAs",
    ],
    implementation: "White-glove implementation with a dedicated project team.",
    support: "Dedicated customer success manager and SLA-backed support.",
    roadmap: "Direct input into platform roadmap prioritization.",
  },
];

export const plansBySlug: Record<PlanSlug, Plan> = Object.fromEntries(
  plans.map((plan) => [plan.slug, plan]),
) as Record<PlanSlug, Plan>;

export function resolvePlanOfferId(
  plan: Plan,
  billing: "monthly" | "annual",
): string | null {
  return (billing === "annual" ? plan.offerIdAnnual : plan.offerIdMonthly) ?? null;
}

export const comparisonRowLabels: {
  key: keyof Plan["comparisonRow"];
  label: string;
}[] = [
  { key: "properties", label: "Properties" },
  { key: "users", label: "Users" },
  { key: "observe", label: "Observe" },
  { key: "understand", label: "Understand" },
  { key: "decide", label: "Decide" },
  { key: "execute", label: "Execute" },
  { key: "learn", label: "Learn" },
  { key: "guidebookStudio", label: "Guidebook Studio" },
  { key: "investmentIntelligence", label: "Investment Intelligence" },
  { key: "prioritySupport", label: "Priority Support" },
  { key: "api", label: "API" },
  { key: "customReports", label: "Custom Reports" },
  { key: "training", label: "Training" },
];
