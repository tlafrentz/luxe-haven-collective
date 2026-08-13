import { formatMonthlyPrice, hpmTierMonthlyPrices } from "./pricing/hpm-tier-prices";

export const platformLinks = [
  ["HPM Platform", "/performance/overview"],
  ["Guidebook Studio", "/guidebook-studio"],
  ["Furnishing Studio", "/furnishing"],
  ["Investment Intelligence", "/investment-intelligence"],
] as const;

export const journeySteps = [
  "journey",
  "select-package",
  "package-details",
  "customize",
  "review",
  "checkout",
  "confirmation",
] as const;
export type JourneyStep = (typeof journeySteps)[number];

type Journey = {
  name: string;
  shortName: string;
  description: string;
  category: string;
  accent: string;
  packages: {
    name: string;
    price: string;
    description: string;
    popular?: boolean;
  }[];
  includes: string[];
  customization: string[];
  confirmationTitle: string;
  destination: string;
};

export const platformJourneys: Record<string, Journey> = {
  "investment-intelligence": {
    name: "Investment Intelligence Journey",
    shortName: "Investment Intelligence",
    description:
      "Make confident investment decisions with data, insights, and expertise.",
    category: "investment",
    accent: "Investment",
    packages: [
      {
        name: "Quick Review",
        price: "$199",
        description: "High-level investment snapshot.",
      },
      {
        name: "Professional Underwriting",
        price: "$599",
        description: "Comprehensive underwriting and risk analysis.",
        popular: true,
      },
      {
        name: "Portfolio Advisory",
        price: "Custom",
        description: "Strategic analysis for multi-property portfolios.",
      },
    ],
    includes: [
      "Market and location analysis",
      "Financial underwriting and projections",
      "Comparable-set performance benchmarking",
      "Risk assessment and sensitivity analysis",
      "Investment summary and recommendation",
    ],
    customization: [
      "Property address",
      "Property type",
      "Bedrooms and bathrooms",
      "Estimated purchase price",
      "Short-term rental history",
    ],
    confirmationTitle: "Your analysis request has been received.",
    destination: "/dashboard/investments",
  },
  "furnishing-studio": {
    name: "Furnishing Studio Journey",
    shortName: "Furnishing Studio",
    description:
      "Professional furnishing packages that make your property guest-ready.",
    category: "furnishing",
    accent: "Furnishing",
    packages: [
      {
        name: "Essential",
        price: "From $4,900",
        description: "Core, durable guest-ready essentials.",
      },
      {
        name: "Signature",
        price: "From $8,900",
        description: "Elevated style with quality finishes.",
        popular: true,
      },
      {
        name: "Luxury",
        price: "From $14,900",
        description: "High-end design and materials.",
      },
    ],
    includes: [
      "Living room, bedrooms, dining, and décor",
      "Kitchen essentials and small appliances",
      "Linens, towels, and bath accessories",
      "Wall art, plants, and styling",
      "Delivery and installation coordination",
    ],
    customization: [
      "Property type",
      "Bedrooms and bathrooms",
      "Design style",
      "Budget range",
      "Optional rooms and add-ons",
    ],
    confirmationTitle: "Your furnishing project has been requested.",
    destination: "/dashboard",
  },
  "guidebook-studio": {
    name: "Guidebook Studio Journey",
    shortName: "Guidebook Studio",
    description: "Beautiful digital guidebooks that guests love to use.",
    category: "guidebook",
    accent: "Guidebook",
    packages: [
      {
        name: "DIY",
        price: "$99",
        description: "Templates and tools to build it yourself.",
      },
      {
        name: "Done For You",
        price: "$249",
        description: "We build and design your guidebook.",
        popular: true,
      },
      {
        name: "Premium",
        price: "$499",
        description: "Advanced features and integrations.",
      },
    ],
    includes: [
      "Professional content and copywriting",
      "Custom design and branding",
      "Mobile-optimized digital guidebook",
      "Unlimited sections and pages",
      "Publishing review and revisions",
    ],
    customization: [
      "Property name",
      "Location",
      "Bedrooms and bathrooms",
      "Check-in and checkout times",
      "Amenities and neighborhood highlights",
    ],
    confirmationTitle: "Your guidebook project has been requested.",
    destination: "/dashboard/guidebooks",
  },
  hpm: {
    name: "HPM Platform Journey",
    shortName: "HPM Platform",
    description: "The operating system for hospitality performance.",
    category: "platform",
    accent: "HPM Platform",
    packages: [
      {
        name: "Starter",
        price: formatMonthlyPrice(hpmTierMonthlyPrices.starter),
        description: "For individual owners.",
      },
      {
        name: "Growth",
        price: formatMonthlyPrice(hpmTierMonthlyPrices.professional),
        description: "For growing operators.",
        popular: true,
      },
      {
        name: "Portfolio",
        price: "Unavailable",
        description: "Deferred custom offer.",
      },
    ],
    includes: [
      "Hospitality Performance Management flywheel",
      "Revenue and financial intelligence",
      "Executive dashboards and reporting",
      "Owner reporting",
      "Guidebook analytics",
      "Priority support",
    ],
    customization: [
      "Workspace name",
      "Property count",
      "Team size",
      "Integration needs",
      "Preferred onboarding date",
    ],
    confirmationTitle: "Your HPM workspace request is ready.",
    destination: "/dashboard",
  },
};
