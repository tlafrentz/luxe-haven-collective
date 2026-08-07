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
    name: "DIY",
    price: 99,
    priceLabel: "$99",
    tagline: "Best for hands-on hosts.",
    description:
      "Use our professional templates and tools to build and publish your own guidebook.",
    highlights: [
      "Use our templates",
      "Build it yourself",
      "Publish instantly",
      "Email support",
    ],
    features: [
      "Access to the full template library",
      "Guided step-by-step builder",
      "Mobile-optimized digital guidebook",
      "Publish and share instantly",
      "Email support",
    ],
    offerId: "commerce-offer-guidebook-diy",
  },
  {
    slug: "done-for-you",
    name: "Done For You",
    price: 249,
    priceLabel: "$249",
    startingAt: true,
    tagline: "Best balance of quality and convenience.",
    description:
      "Our team builds a stunning guidebook customized to your property and guests.",
    popular: true,
    highlights: [
      "We'll build it for you",
      "You approve and request edits",
      "Two rounds of revisions",
      "Priority support",
    ],
    features: [
      "Custom template selection",
      "Professional content writing",
      "Property-specific integration",
      "Two rounds of revisions",
      "Priority support",
    ],
    offerId: "commerce-offer-guidebook-done-for-you",
  },
  {
    slug: "premium",
    name: "Premium",
    price: 499,
    priceLabel: "$499",
    startingAt: true,
    tagline: "Advanced features and integrations.",
    description:
      "A fully custom, branded guidebook experience with unlimited edits and concierge support.",
    highlights: [
      "Custom design",
      "Unlimited edits",
      "Branded domain",
      "Concierge support",
    ],
    features: [
      "Fully custom design and branding",
      "Unlimited revisions",
      "Branded custom domain",
      "Advanced integrations",
      "Dedicated concierge support",
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
  {
    slug: "extra-revisions",
    name: "Extra Revisions",
    price: 49,
    priceLabel: "$49",
    description: "One additional round of revisions beyond what's included.",
  },
  {
    slug: "rush-delivery",
    name: "Rush Delivery",
    price: 99,
    priceLabel: "$99",
    description: "Delivered within 3 business days.",
  },
  {
    slug: "additional-language",
    name: "Additional Language",
    price: 49,
    priceLabel: "$49",
    description: "Your guidebook translated into one additional language.",
  },
];

export const guidebookPlanIncludes = [
  "Mobile-optimized digital guidebook",
  "QR code for easy guest access",
  "Guidebook analytics",
];
