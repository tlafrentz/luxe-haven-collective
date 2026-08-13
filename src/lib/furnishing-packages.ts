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
    name: "Consultation", price: 249, priceLabel: "$249", tagline: "Focused furnishing direction for one property.",
    description: "A 60-minute virtual consultation with preliminary budget guidance and a written summary within two business days.",
    highlights: ["Pre-call questionnaire","60-minute virtual consultation","Priority room recommendations","Written summary"],
    features: ["Review of supplied listing, photographs, floor plan, or measurements","Target-guest and design-direction discussion","Preliminary furnishing-budget range","Written summary within two business days"],
    comparison: {
      propertySize:"One property",designServiceLevel:"Consultation",furnitureQualityLevel:"Recommendations",roomCoverage:"Priority rooms",revisions:"Not included",delivery:false,installation:false,styling:false,concierge:false,typicalTimeline:"Summary within 2 business days",
    },
    exclusions:["Mood boards","Detailed layouts","Complete shopping lists","Procurement, ordering, delivery, assembly, or installation"],
    cancellationPolicy:"Refundable before work begins; after work begins, refunds are limited to undelivered scope.",
    eligibilityLimitations:"The $249 fee may be credited once toward a Design Plan for the same customer and property when purchased within 30 days.",
    offerId: "commerce-offer-furnishing-essential",
  },
  {
    slug: "elevated",
    name: "Design Plan", price:1495, priceLabel:"$1,495 base", startingAt:true, tagline:"A reviewed design plan for a base 2BR/2BA property.",
    description:"Submit your scope for review. Checkout opens only after Luxe Haven approves the authoritative configuration and price.",
    popular: true,
    highlights:["Base 2BR/2BA property scope","Room-by-room furnishing plan","Curated products and budgets","One consolidated revision"],
    features:["Design profile, color, and material palette","Layouts from customer-supplied measurements","Mood and design boards","Curated products, quantities, substitutes, and room budgets","Final implementation guide and review call"],
    comparison: {
      propertySize:"Base 2 bed / 2 bath",designServiceLevel:"Detailed design plan",furnitureQualityLevel:"Curated recommendations",roomCoverage:"Living, dining, kitchen, workspace, TVs and mounts",revisions:"1 consolidated revision",delivery:false,installation:false,styling:false,concierge:false,typicalTimeline:"Begins after scope approval and verified payment",
    },
    exclusions:["Purchasing","Procurement","Delivery management","Assembly","Installation","Styling","Photography"],
    cancellationPolicy:"Refundable before work begins; after work begins, refunds are limited to undelivered scope.",
    eligibilityLimitations:"Requires scope review before checkout. Additional rooms are $250 each and additional consolidated revisions are $150 each.",
    offerId: "commerce-offer-furnishing-elevated",
  },
  {
    slug: "luxury",
    name:"Full-Service Furnishing",price:0,priceLabel:"Unavailable",tagline:"Deferred pending separate commercial approval.",
    description:"This offer is not currently purchasable and does not promise procurement, ordering, delivery, installation, or styling.",
    highlights:["Internal draft only","No public price","No checkout","No active Stripe mapping"],features:[],
    comparison: {
      propertySize:"Custom",designServiceLevel:"Deferred",furnitureQualityLevel:"Not defined",roomCoverage:"Not defined",revisions:"Not defined",delivery:false,installation:false,styling:false,concierge:false,typicalTimeline:"Unavailable",
    },
    exclusions:["Procurement","Ordering","Delivery","Installation","Styling"],cancellationPolicy:"Not available for purchase.",eligibilityLimitations:"Deferred and unpublished.",
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
  {slug:"additional-room",name:"Additional Room",price:250,priceLabel:"$250",description:"One additional room included in an approved Design Plan configuration."},
  {slug:"additional-revision",name:"Additional Revision",price:150,priceLabel:"$150",description:"One additional consolidated revision requested through the approved project operation."},
];

export const furnishingPlanIncludes = [
  "Room-by-room design direction",
  "Product-level budget estimate",
  "Curated products with purchase links",
  "No procurement, ordering, delivery, assembly, or installation",
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
