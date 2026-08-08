export type FurnishingPackageSlug = "essential" | "elevated" | "luxury";

export type FurnishingPackage = {
  slug: FurnishingPackageSlug;
  name: string;
  price: number;
  priceLabel: string;
  startingAt?: boolean;
  tagline: string;
  description: string;
  popular?: boolean;
  /** Short bullet list shown on the Compare Packages cards. */
  highlights: string[];
  /** Fuller bullet list shown on the Package Detail page. */
  features: string[];
  comparison: {
    propertySize: string;
    designServiceLevel: string;
    furnitureQualityLevel: string;
    roomCoverage: string;
    revisions: string;
    delivery: boolean;
    installation: boolean;
    styling: boolean;
    concierge: boolean;
    typicalTimeline: string;
  };
  exclusions: string[];
  cancellationPolicy: string;
  eligibilityLimitations: string;
  /** commerce_offers.id for this package's one-time offer (Phase B). Unset until the offer catalog is extended. */
  offerId?: string;
};

export const furnishingPackages: FurnishingPackage[] = [
  {
    slug: "essential",
    name: "Essential",
    price: 4995,
    priceLabel: "$4,995",
    startingAt: true,
    tagline: "A focused, guest-ready foundation.",
    description:
      "Core furniture and décor across the rooms that matter most, coordinated for a durable, guest-ready launch.",
    highlights: [
      "Essential furniture package",
      "Core décor selections",
      "Delivery coordination",
      "1 design revision",
    ],
    features: [
      "Design direction for core living spaces",
      "Curated, durable furniture and décor selections",
      "Room-by-room budget estimate",
      "Delivery coordination with your selected retailers",
      "One round of design revision",
      "Launch-readiness handoff checklist",
    ],
    comparison: {
      propertySize: "Up to 2 bed / 2 bath",
      designServiceLevel: "Guided template direction",
      furnitureQualityLevel: "Durable, guest-grade",
      roomCoverage: "Core rooms (living, primary bedroom, kitchen)",
      revisions: "1 round",
      delivery: true,
      installation: false,
      styling: false,
      concierge: false,
      typicalTimeline: "3–5 weeks",
    },
    exclusions: [
      "Installation and placement labor",
      "Professional styling pass",
      "Outdoor and secondary-bedroom coverage",
    ],
    cancellationPolicy:
      "Full refund before design direction is approved; a pro-rated refund applies afterward based on work completed. See your order confirmation for exact terms.",
    eligibilityLimitations:
      "Best suited to properties of 2 bedrooms or fewer. Larger properties should compare the Elevated or Luxury package.",
    offerId: "commerce-offer-furnishing-essential",
  },
  {
    slug: "elevated",
    name: "Elevated",
    price: 7995,
    priceLabel: "$7,995",
    startingAt: true,
    tagline: "A cohesive, professionally curated property.",
    description:
      "A fully coordinated design across every core and secondary room, with delivery and installation support included.",
    popular: true,
    highlights: [
      "Upgraded furniture & premium décor",
      "Delivery & installation included",
      "Up to 3 bed / 2 bath coverage",
      "2 design revisions",
    ],
    features: [
      "Custom design direction across all bedrooms and living spaces",
      "Upgraded furniture and premium décor selections",
      "Room-by-room budget estimate with product-level detail",
      "Delivery and installation coordination",
      "Two rounds of design revision",
      "Launch-readiness handoff checklist",
    ],
    comparison: {
      propertySize: "Up to 3 bed / 2 bath",
      designServiceLevel: "Custom design direction",
      furnitureQualityLevel: "Upgraded, premium finishes",
      roomCoverage: "All bedrooms, living, dining, kitchen",
      revisions: "2 rounds",
      delivery: true,
      installation: true,
      styling: true,
      concierge: false,
      typicalTimeline: "4–6 weeks",
    },
    exclusions: [
      "Whole-property outdoor furnishing beyond one seating area",
      "Dedicated concierge project manager",
    ],
    cancellationPolicy:
      "Full refund before design direction is approved; a pro-rated refund applies afterward based on work completed. See your order confirmation for exact terms.",
    eligibilityLimitations:
      "Best suited to properties up to 3 bedrooms / 2 bathrooms. Larger or more complex properties should compare Luxury.",
    offerId: "commerce-offer-furnishing-elevated",
  },
  {
    slug: "luxury",
    name: "Luxury",
    price: 12995,
    priceLabel: "$12,995",
    startingAt: true,
    tagline: "A fully expressive, differentiated stay.",
    description:
      "Whole-property design with custom curation, art and accessories, and white-glove installation from a dedicated concierge team.",
    highlights: [
      "Whole-property custom curation",
      "Art & accessories included",
      "White-glove installation",
      "Unlimited revisions",
    ],
    features: [
      "Whole-property custom design direction, including outdoor spaces",
      "Custom-curated furniture, art, and accessories",
      "Room-by-room budget estimate with product-level detail",
      "White-glove delivery and installation",
      "Unlimited design revisions",
      "Dedicated concierge project manager",
      "Launch-readiness handoff checklist",
    ],
    comparison: {
      propertySize: "Whole property, any size",
      designServiceLevel: "Concierge custom design",
      furnitureQualityLevel: "Custom & curated",
      roomCoverage: "Whole property, including outdoor",
      revisions: "Unlimited",
      delivery: true,
      installation: true,
      styling: true,
      concierge: true,
      typicalTimeline: "5–8 weeks",
    },
    exclusions: ["Structural or renovation work"],
    cancellationPolicy:
      "Full refund before design direction is approved; a pro-rated refund applies afterward based on work completed. See your order confirmation for exact terms.",
    eligibilityLimitations:
      "Available for any property size. Timeline extends for properties over 5 bedrooms.",
    offerId: "commerce-offer-furnishing-luxury",
  },
];

export const furnishingPackagesBySlug: Record<
  FurnishingPackageSlug,
  FurnishingPackage
> = Object.fromEntries(
  furnishingPackages.map((item) => [item.slug, item]),
) as Record<FurnishingPackageSlug, FurnishingPackage>;

export type FurnishingAddOn = {
  slug: string;
  name: string;
  price: number;
  priceLabel: string;
  description: string;
};

export const furnishingAddOns: FurnishingAddOn[] = [
  {
    slug: "outdoor-upgrade",
    name: "Outdoor Upgrade",
    price: 1495,
    priceLabel: "$1,495",
    description:
      "Weather-appropriate seating, dining, and lighting for patio, balcony, or yard space.",
  },
  {
    slug: "art-package",
    name: "Art Package",
    price: 895,
    priceLabel: "$895",
    description:
      "Curated wall art and accessories selected to match your design direction.",
  },
  {
    slug: "smart-home-package",
    name: "Smart Home Package",
    price: 695,
    priceLabel: "$695",
    description:
      "Smart locks, thermostat, and lighting configured for guest self check-in.",
  },
];

export const furnishingPlanIncludes = [
  "Room-by-room design direction",
  "Product-level budget estimate",
  "Procurement & receiving coordination",
  "Launch-readiness handoff",
];

export type FurnishingRoomExample = {
  slug: string;
  name: string;
  description: string;
  typicalCategories: string[];
};

export const furnishingRoomExamples: FurnishingRoomExample[] = [
  {
    slug: "living-room",
    name: "Living Room",
    description:
      "A durable, guest-ready seating and gathering area sized to the property's typical guest count.",
    typicalCategories: [
      "Sofa & seating",
      "Coffee & side tables",
      "Media console",
      "Area rug",
      "Wall art",
    ],
  },
  {
    slug: "bedroom",
    name: "Bedroom",
    description:
      "Guest-grade bedding and storage furniture, sized and styled per bedroom for a consistent look across the property.",
    typicalCategories: ["Bed frame & mattress", "Nightstands", "Dresser", "Bedding & linens", "Lighting"],
  },
  {
    slug: "kitchen-dining",
    name: "Kitchen & Dining",
    description:
      "Everyday cookware, small appliances, and a dining set sized to the property's maximum guest capacity.",
    typicalCategories: ["Dining table & seating", "Cookware & bakeware", "Small appliances", "Bar stools"],
  },
  {
    slug: "bathroom",
    name: "Bathroom",
    description: "Guest-count-appropriate towels, bath accessories, and storage.",
    typicalCategories: ["Towels & bath linens", "Bath mats", "Storage & organization", "Accessories"],
  },
  {
    slug: "outdoor",
    name: "Outdoor",
    description:
      "Weather-appropriate seating and dining for available patio, balcony, or yard space.",
    typicalCategories: ["Outdoor seating", "Outdoor dining", "Shade & lighting", "Planters"],
  },
];
