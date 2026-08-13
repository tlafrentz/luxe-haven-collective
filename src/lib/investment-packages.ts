export type InvestmentPackageSlug = "essentials" | "pro";

export type InvestmentPackage = {
  slug: InvestmentPackageSlug;
  name: string;
  price: number;
  priceLabel: string;
  tagline: string;
  description: string;
  popular?: boolean;
  /** Short bullet list shown on the Compare Packages cards. */
  highlights: string[];
  /** Fuller bullet list shown on the Package Detail page. */
  features: string[];
  comparison: {
    marketAnalysis: string;
    financialModeling: string;
    comparableProperties: string;
    riskAssessment: string;
    scenarios: string;
    expertReview: boolean;
    turnaround: string;
  };
  exclusions: string[];
  cancellationPolicy: string;
  eligibilityLimitations: string;
  /** commerce_offers.id for this package's one-time offer (Phase B). */
  offerId?: string;
};

export const investmentPackages: InvestmentPackage[] = [
  {
    slug: "essentials",
    name: "Single Analysis",
    price: 199,
    priceLabel: "$199",
    tagline: "One persisted, decision-ready analysis.",
    description:
      "Validate assumptions, preserve market evidence, and save one usable analysis without requiring HPM.",
    highlights: [
      "One analysis credit",
      "Financial outputs and market evidence",
      "Score and recommendation",
      "Saved opportunity access",
    ],
    features: [
      "One persisted Investment Intelligence analysis",
      "Validated customer assumptions kept separate from provider observations",
      "Financial outputs and disclosed market evidence",
      "Score and recommendation",
      "Saved opportunity access",
    ],
    comparison: {
      marketAnalysis: "Snapshot",
      financialModeling: "Single scenario",
      comparableProperties: "Up to 5",
      riskAssessment: "Summary",
      scenarios: "1 (base case)",
      expertReview: false,
      turnaround: "24–48 hours",
    },
    exclusions: [
      "HPM access",
      "Appraisal or financing approval",
      "Guaranteed returns",
    ],
    cancellationPolicy:
      "Full refund if requested before your analysis is generated. Once generated, the analysis credit has been fulfilled and is non-refundable.",
    eligibilityLimitations:
      "One materially new analysis or reanalysis consumes the credit; a verified platform retry does not.",
    offerId: "commerce-offer-investment-starter",
  },
  {
    slug: "pro",
    name: "Analysis Pack",
    price: 399,
    priceLabel: "$399",
    tagline: "Five account-bound analysis credits.",
    description:
      "Run up to five persisted analyses with the same canonical outputs as Single Analysis and priority support.",
    popular: true,
    highlights: [
      "Five analysis credits",
      "Persisted decision-ready analyses",
      "Saved opportunity access",
      "Priority support",
    ],
    features: [
      "Five account-bound analysis credits",
      "Validated assumptions and separate provider-observation lineage",
      "Persisted financial outputs, market evidence, score, and recommendation",
      "Saved opportunity access",
      "Credits expire 12 months after purchase",
    ],
    comparison: {
      marketAnalysis: "Full market intelligence",
      financialModeling: "Full model, all assumptions",
      comparableProperties: "Up to 15",
      riskAssessment: "Full sensitivity analysis",
      scenarios: "3 (base/optimistic/conservative)",
      expertReview: false,
      turnaround: "24–48 hours",
    },
    exclusions: [
      "HPM access",
      "Transferable credits",
      "Refunds for used credits",
    ],
    cancellationPolicy:
      "Full refund if requested before your analysis is generated. Once generated, the analysis credit has been fulfilled and is non-refundable.",
    eligibilityLimitations:
      "Each materially new analysis consumes one credit; credits are non-transferable and expire after 12 months.",
    offerId: "commerce-offer-investment-pro",
  },
];

export const investmentPackagesBySlug: Record<
  InvestmentPackageSlug,
  InvestmentPackage
> = Object.fromEntries(
  investmentPackages.map((item) => [item.slug, item]),
) as Record<InvestmentPackageSlug, InvestmentPackage>;

export type InvestmentAddOn = {
  slug: string;
  name: string;
  price: number;
  priceLabel: string;
  description: string;
};

export const investmentAddOns: InvestmentAddOn[] = [];

export type InvestmentSampleReport = {
  slug: string;
  propertyLabel: string;
  market: string;
  strategy: string;
  packageName: string;
  headline: string;
  description: string;
};

export const investmentSampleReports: InvestmentSampleReport[] = [
  {
    slug: "scottsdale-luxury-4br",
    propertyLabel: "Scottsdale, AZ — Luxury 4BR Home",
    market: "Scottsdale, AZ",
    strategy: "Short-Term Rental",
    packageName: "Pro Analysis",
    headline: "Strong investment opportunity",
    description:
      "A 4-bedroom, 3-bath luxury home evaluated for short-term rental conversion — full market intelligence, three-scenario financial model, comparable-set benchmarking, and a proceed recommendation.",
  },
  {
    slug: "austin-mid-term-3br",
    propertyLabel: "Austin, TX — 3BR Townhome",
    market: "Austin, TX",
    strategy: "Mid-Term Rental",
    packageName: "Pro Analysis",
    headline: "Proceed with caution",
    description:
      "A 3-bedroom townhome evaluated for mid-term corporate rental positioning — market seasonality, financing sensitivity, and a caution recommendation with specific risk flags.",
  },
  {
    slug: "gulf-shores-condo",
    propertyLabel: "Gulf Shores, AL — 2BR Condo",
    market: "Gulf Shores, AL",
    strategy: "Vacation Home",
    packageName: "Essentials",
    headline: "Quick-look snapshot",
    description:
      "A baseline single-scenario snapshot for a 2-bedroom beach condo — market data, projected cash flow, and an overall recommendation delivered in under 48 hours.",
  },
];

export const investmentMethodologyPillars = [
  {
    title: "Curated Data Sources",
    description:
      "Market rates, occupancy, and comparable-property data are pulled from licensed short-term-rental market data providers and refreshed on a defined cadence — never scraped or estimated ad hoc.",
  },
  {
    title: "Proven Methodology",
    description:
      "Every analysis follows the same documented underwriting framework: market intelligence, financial modeling, comparable benchmarking, and risk assessment — so results are consistent and explainable.",
  },
  {
    title: "Expert Oversight",
    description:
      "Premier analyses add a licensed analyst's review of assumptions and conclusions. Every tier's calculations are inspectable — you can trace any number back to its source and formula.",
  },
  {
    title: "Clear Limitations",
    description:
      "An investment analysis is a decision-support tool, not a guarantee of performance or a substitute for legal, tax, or financing advice. Every report states its data sources, assumptions, and confidence level explicitly.",
  },
];
