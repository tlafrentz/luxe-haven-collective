export type FaqCategory =
  | "pricing"
  | "implementation"
  | "security"
  | "support"
  | "billing"
  | "cancellation";

export const faqCategories: {
  slug: FaqCategory;
  label: string;
  blurb: string;
}[] = [
  {
    slug: "pricing",
    label: "Pricing",
    blurb: "Plans, billing cycles, and what's included at each tier.",
  },
  {
    slug: "implementation",
    label: "Implementation",
    blurb: "Getting your properties and team onto the platform.",
  },
  {
    slug: "security",
    label: "Security",
    blurb: "How your data and your guests' data are protected.",
  },
  {
    slug: "support",
    label: "Support",
    blurb: "What help looks like once you're live.",
  },
  {
    slug: "billing",
    label: "Billing",
    blurb: "Invoices, payment methods, and plan changes.",
  },
  {
    slug: "cancellation",
    label: "Cancellation",
    blurb: "Pausing, downgrading, or ending a subscription.",
  },
];

export type Faq = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
};

export const faqs: Faq[] = [
  {
    id: "plan-difference",
    category: "pricing",
    question: "What's the difference between the plans?",
    answer:
      "Starter, Professional, and Portfolio scale with the number of properties and users you manage and add capabilities like Guidebook Studio, Investment Intelligence, and priority support as you grow. Enterprise adds unlimited properties, a dedicated customer success manager, and full API access with custom pricing. Compare Plans has the full breakdown.",
  },
  {
    id: "annual-billing",
    category: "pricing",
    question: "Do you offer annual billing?",
    answer:
      "Yes. Switching to annual billing on any paid plan saves 20% compared to paying monthly. You can toggle between monthly and annual pricing on the Compare Plans page before choosing a plan.",
  },
  {
    id: "enterprise-pricing",
    category: "pricing",
    question: "How is Enterprise priced?",
    answer:
      "Enterprise pricing is custom based on property count, integration needs, and support requirements. Contact us for a tailored quote.",
  },
  {
    id: "manage-properties-directly",
    category: "implementation",
    question: "Do you manage properties directly?",
    answer:
      "Yes. Luxe Haven supports hospitality operations through defined management, co-hosting, consulting, and platform engagements based on property fit and market coverage.",
  },
  {
    id: "hpm-definition",
    category: "implementation",
    question: "What is a Hospitality Performance System?",
    answer:
      "It is a connected operating model that helps teams observe performance, understand drivers, decide what matters, execute work, and learn from measured outcomes.",
  },
  {
    id: "already-listed",
    category: "implementation",
    question: "Can you help if my property is already listed?",
    answer:
      "Yes. Existing properties can benefit from a focused audit, listing optimization, guidebook work, furnishing improvements, or ongoing operational support.",
  },
  {
    id: "getting-started",
    category: "implementation",
    question: "How long does onboarding take?",
    answer:
      "Starter plans are self-serve and can be live in under a day. Professional and Portfolio plans include a guided onboarding session, typically completed within a week. Enterprise onboarding is scoped with a dedicated project team.",
  },
  {
    id: "data-security",
    category: "security",
    question: "How is my data protected?",
    answer:
      "Property, financial, and guest data are encrypted in transit and at rest, and access is scoped to the users you authorize on your workspace.",
  },
  {
    id: "guest-data",
    category: "security",
    question: "Do guests need to create an account?",
    answer:
      "No. Guest-facing tools like guidebooks don't require guests to sign in or share data beyond what they choose to provide.",
  },
  {
    id: "owner-portal",
    category: "support",
    question: "Is there an owner portal?",
    answer:
      "Yes. Authorized owners can access the workspace and property information made available to them according to their relationship and permissions.",
  },
  {
    id: "reporting-frequency",
    category: "support",
    question: "How often will I receive reporting?",
    answer:
      "Reporting frequency depends on the selected plan. Reports remain period-bound records and are distinct from continuously updated dashboards.",
  },
  {
    id: "support-channels",
    category: "support",
    question: "What support channels are available?",
    answer:
      "Starter includes email support with next-business-day response. Professional and Portfolio add priority email and chat. Enterprise includes a dedicated customer success manager.",
  },
  {
    id: "upgrade-later",
    category: "billing",
    question: "Can I upgrade later?",
    answer:
      "Yes. You can move to a higher plan at any time and the new features are available immediately. Billing is prorated for the remainder of your current cycle.",
  },
  {
    id: "payment-methods",
    category: "billing",
    question: "What payment methods do you accept?",
    answer:
      "We accept major credit cards for monthly and annual subscriptions. Enterprise plans can also be invoiced.",
  },
  {
    id: "import-properties",
    category: "billing",
    question: "Can I import existing properties?",
    answer:
      "Yes. Existing properties and their historical data can be imported during onboarding at no additional cost on Professional and above.",
  },
  {
    id: "cancel-anytime",
    category: "cancellation",
    question: "Can I cancel anytime?",
    answer:
      "Yes. You can cancel a monthly or annual subscription at any time. Your workspace remains available through the end of the current billing period.",
  },
  {
    id: "downgrade",
    category: "cancellation",
    question: "What happens if I downgrade?",
    answer:
      "Downgrading takes effect at the start of your next billing cycle. Features and data specific to the higher plan become read-only or unavailable at that point.",
  },
];
