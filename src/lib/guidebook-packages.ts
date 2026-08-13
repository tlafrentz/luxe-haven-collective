export type GuidebookPackageSlug = "diy" | "done-for-you" | "premium";

export type GuidebookPackage = {
  slug: GuidebookPackageSlug;
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
  /** commerce_offers.id for this package's one-time offer (Phase B). Unset until the offer catalog migration lands. */
  offerId?: string;
};

export const guidebookPackages: GuidebookPackage[] = [
  {
    slug: "diy",
    name: "Self-Service",
    price: 99,
    priceLabel: "$99",
    tagline: "Best for hands-on hosts.",
    description:
      "Create and maintain one standalone property guidebook with 12 months of hosting.",
    highlights: [
      "Use our templates",
      "Build it yourself",
      "Preview before publishing",
      "12 months of hosting",
    ],
    features: [
      "Access to the full template library",
      "Guided step-by-step builder",
      "Mobile-optimized digital guidebook",
      "Customer-approved publishing",
      "Customer-managed revisions and standard support",
    ],
    offerId: "commerce-offer-guidebook-diy",
  },
  {
    slug: "done-for-you",
    name: "Guided Setup",
    price: 249,
    priceLabel: "$249",
    tagline: "Best balance of quality and convenience.",
    description:
      "Create your guidebook with guided intake, content-structure assistance, and a review call.",
    popular: true,
    highlights: [
      "Everything in Self-Service",
      "Guided intake and structure help",
      "One review call",
      "One consolidated revision",
    ],
    features: [
      "Standalone property context and editor",
      "Guided intake and content-structure assistance",
      "One review call",
      "One consolidated revision",
      "12 months of hosting",
    ],
    offerId: "commerce-offer-guidebook-done-for-you",
  },
  {
    slug: "premium",
    name: "Done-for-You",
    price: 499,
    priceLabel: "$499",
    tagline: "Managed creation from your supplied information.",
    description:
      "Luxe Haven organizes and drafts one branded guidebook, with your approval before publishing.",
    highlights: [
      "Managed setup and drafting",
      "Branded layout",
      "One review call",
      "One consolidated revision",
    ],
    features: [
      "Content organization and drafting from supplied information",
      "Branded layout",
      "One review call",
      "One consolidated revision",
      "Customer-approved publishing and 12 months hosting",
    ],
    offerId: "commerce-offer-guidebook-premium",
  },
];

export const guidebookPackagesBySlug: Record<
  GuidebookPackageSlug,
  GuidebookPackage
> = Object.fromEntries(
  guidebookPackages.map((item) => [item.slug, item]),
) as Record<GuidebookPackageSlug, GuidebookPackage>;

export type GuidebookAddOn = {
  slug: string;
  name: string;
  price: number;
  priceLabel: string;
  description: string;
};

export const guidebookAddOns: GuidebookAddOn[] = [
  {slug:"additional-self-service",name:"Additional Self-Service Guidebook",price:79,priceLabel:"$79",description:"One additional self-service guidebook with its first 12 months of hosting."},
  {slug:"additional-guided",name:"Additional Guided Guidebook",price:99,priceLabel:"$99",description:"One additional guided guidebook with the approved setup scope and 12 months of hosting."},
  {slug:"additional-done-for-you",name:"Additional Done-for-You Guidebook",price:199,priceLabel:"$199",description:"One additional managed guidebook with the approved creation scope and 12 months of hosting."},
  {slug:"hosting-renewal",name:"Annual Guidebook Hosting",price:49,priceLabel:"$49 / year",description:"Twelve additional months of hosting for one existing guidebook."},
];

export const guidebookPlanIncludes = [
  "Mobile-optimized digital guidebook",
  "One property and one guidebook",
  "12 months of hosting, then $49/year per guidebook",
];
