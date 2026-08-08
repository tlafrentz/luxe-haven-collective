export type InvestmentPackageSlug = "essentials" | "pro" | "premier";

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
    name: "Essentials",
    price: 199,
    priceLabel: "$199",
    tagline: "A quick, transparent snapshot before you go further.",
    description:
      "A high-level investment snapshot with market data, a baseline financial projection, and a clear recommendation — ideal for a first-look screen.",
    highlights: [
      "Market & location snapshot",
      "Baseline financial projection",
      "Overall recommendation",
      "Delivered in 24-48 hours",
    ],
    features: [
      "Property and market data pull (ADR, occupancy, RevPAR)",
      "Baseline revenue and expense projection",
      "Single-scenario cash flow estimate",
      "Overall recommendation with confidence level",
      "Inspectable calculations — every number traces to its source",
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
      "Scenario comparison (optimistic/conservative/custom)",
      "Comparable-set benchmarking beyond 5 properties",
      "Human expert review of your analysis",
      "Executive report export",
    ],
    cancellationPolicy:
      "Full refund if requested before your analysis is generated. Once generated, the analysis credit has been fulfilled and is non-refundable.",
    eligibilityLimitations:
      "Best suited to a first-look evaluation of a single property. Compare Pro or Premier for scenario modeling and expert review.",
    offerId: "commerce-offer-investment-starter",
  },
  {
    slug: "pro",
    name: "Pro",
    price: 499,
    priceLabel: "$499",
    tagline: "Comprehensive underwriting with full scenario modeling.",
    description:
      "A complete investment decision analysis with market intelligence, full financial modeling, scenario comparison, and risk assessment — everything you need to underwrite a purchase or rental arbitrage opportunity with confidence.",
    popular: true,
    highlights: [
      "Full market intelligence report",
      "Base / optimistic / conservative scenarios",
      "Comparable-set benchmarking",
      "Risk assessment & sensitivity analysis",
    ],
    features: [
      "Full market intelligence: ADR, occupancy, RevPAR, seasonality",
      "Complete financial modeling across purchase, financing, and operating assumptions",
      "Base, optimistic, and conservative scenario comparison",
      "Comparable-property benchmarking (up to 15 properties)",
      "Risk assessment and sensitivity analysis",
      "Overall recommendation with confidence level and key strengths",
      "Save and revisit as an opportunity in your workspace",
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
      "Human expert review of your analysis",
      "Custom scenario beyond the three standard cases",
    ],
    cancellationPolicy:
      "Full refund if requested before your analysis is generated. Once generated, the analysis credit has been fulfilled and is non-refundable.",
    eligibilityLimitations:
      "Available for purchase and rental arbitrage strategies. Best suited to a serious, single-property purchase decision.",
    offerId: "commerce-offer-investment-pro",
  },
  {
    slug: "premier",
    name: "Premier",
    price: 999,
    priceLabel: "$999",
    tagline: "Full underwriting plus a human expert review.",
    description:
      "Everything in Pro, plus a custom scenario, a licensed analyst's expert review of your assumptions and conclusions, and a polished executive report ready to share with lenders or partners.",
    highlights: [
      "Everything in Pro",
      "Custom scenario modeling",
      "Expert analyst review",
      "Executive report export",
    ],
    features: [
      "Everything included in the Pro package",
      "A fourth, fully custom scenario built to your assumptions",
      "Expert analyst review of assumptions, methodology, and conclusions",
      "Polished executive report export (PDF) for lenders or partners",
      "Priority turnaround",
    ],
    comparison: {
      marketAnalysis: "Full market intelligence",
      financialModeling: "Full model + custom scenario",
      comparableProperties: "Up to 15",
      riskAssessment: "Full sensitivity analysis",
      scenarios: "4 (base/optimistic/conservative/custom)",
      expertReview: true,
      turnaround: "12–24 hours, priority queue",
    },
    exclusions: ["Ongoing portfolio advisory (see Portfolio Advisory for multi-property engagements)"],
    cancellationPolicy:
      "Full refund if requested before your analysis is generated or before expert review begins, whichever is first. Once expert review has started, the fee is non-refundable.",
    eligibilityLimitations:
      "Available for purchase and rental arbitrage strategies. Recommended for decisions involving outside lenders, partners, or committee approval.",
    offerId: "commerce-offer-investment-premier",
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

export const investmentAddOns: InvestmentAddOn[] = [
  {
    slug: "expert-review",
    name: "Expert Review",
    price: 149,
    priceLabel: "$149",
    description:
      "A licensed analyst reviews your assumptions, methodology, and conclusions before you receive your final report. Included automatically with Premier.",
  },
];

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
