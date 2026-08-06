export type FaqAudience = "owners" | "guests" | "partners" | "investors";

export const faqAudiences: {
  slug: FaqAudience;
  label: string;
  blurb: string;
}[] = [
  {
    slug: "owners",
    label: "Owners",
    blurb: "Managing or optimizing properties",
  },
  {
    slug: "guests",
    label: "Guests",
    blurb: "Before, during, and after your stay",
  },
  {
    slug: "partners",
    label: "Partners",
    blurb: "Referrals, integrations, and partnerships",
  },
  {
    slug: "investors",
    label: "Investors",
    blurb: "Investment, due diligence, and performance",
  },
];

export const faqCategoriesByAudience: Record<
  FaqAudience,
  { slug: string; label: string }[]
> = {
  owners: [
    { slug: "property-management", label: "Property Management" },
    { slug: "revenue-pricing", label: "Revenue & Pricing" },
    { slug: "guidebooks", label: "Guidebooks" },
    { slug: "platform-reporting", label: "Platform & Reporting" },
    { slug: "consulting", label: "Consulting" },
    { slug: "general", label: "General" },
  ],
  guests: [
    { slug: "booking", label: "Booking & Reservations" },
    { slug: "during-stay", label: "During Your Stay" },
    { slug: "guidebooks", label: "Guidebooks" },
    { slug: "general", label: "General" },
  ],
  partners: [
    { slug: "referrals", label: "Referrals" },
    { slug: "integrations", label: "Integrations" },
    { slug: "partnerships", label: "Partnerships" },
    { slug: "general", label: "General" },
  ],
  investors: [
    { slug: "investment", label: "Investment" },
    { slug: "due-diligence", label: "Due Diligence" },
    { slug: "performance", label: "Performance" },
    { slug: "general", label: "General" },
  ],
};

export type Faq = {
  id: string;
  audience: FaqAudience;
  category: string;
  question: string;
  answer: string;
};

export const faqs: Faq[] = [
  // Owners
  {
    id: "manage-properties-directly",
    audience: "owners",
    category: "property-management",
    question: "Do you manage properties directly?",
    answer:
      "Yes. Luxe Haven supports hospitality operations through defined management, co-hosting, consulting, and platform engagements based on property fit and market coverage.",
  },
  {
    id: "already-listed",
    audience: "owners",
    category: "property-management",
    question: "Can you help if my property is already listed?",
    answer:
      "Yes. Existing properties can benefit from a focused audit, listing optimization, guidebook work, furnishing improvements, or ongoing operational support.",
  },
  {
    id: "increase-revenue",
    audience: "owners",
    category: "revenue-pricing",
    question: "How do you help increase revenue?",
    answer:
      "We evaluate pricing, positioning, conversion, availability strategy, guest experience, and operating constraints before recommending prioritized actions.",
  },
  {
    id: "annual-billing",
    audience: "owners",
    category: "revenue-pricing",
    question: "Do you offer annual billing on the platform?",
    answer:
      "Yes. Switching to annual billing on any Hospitality Performance Platform plan saves 20% compared to paying monthly. You can toggle between monthly and annual pricing on the Compare Plans page.",
  },
  {
    id: "guidebook-help",
    audience: "owners",
    category: "guidebooks",
    question: "Can you help create a guidebook for my property?",
    answer:
      "Yes. Guidebook Studio offers DIY templates, a done-for-you design service, and premium options with advanced integrations depending on how hands-on you'd like to be.",
  },
  {
    id: "hpm-definition",
    audience: "owners",
    category: "platform-reporting",
    question: "What is a Hospitality Performance System?",
    answer:
      "It is a connected operating model that helps teams observe performance, understand drivers, decide what matters, execute work, and learn from measured outcomes.",
  },
  {
    id: "owner-portal",
    audience: "owners",
    category: "platform-reporting",
    question: "Is there an owner portal?",
    answer:
      "Yes. Authorized owners can access the workspace and property information made available to them according to their relationship and permissions.",
  },
  {
    id: "reporting-frequency",
    audience: "owners",
    category: "platform-reporting",
    question: "How often will I receive reporting?",
    answer:
      "Reporting frequency depends on the selected service or plan. Reports remain period-bound records and are distinct from continuously updated dashboards.",
  },
  {
    id: "data-security",
    audience: "owners",
    category: "platform-reporting",
    question: "How is my data protected?",
    answer:
      "Property, financial, and guest data are encrypted in transit and at rest, and access is scoped to the users you authorize on your workspace.",
  },
  {
    id: "consulting-engagements",
    audience: "owners",
    category: "consulting",
    question: "Do you offer one-off consulting engagements?",
    answer:
      "Yes. Beyond ongoing management and the platform, you can request a focused audit, revenue strategy session, or operational review without committing to a full engagement.",
  },
  {
    id: "getting-started",
    audience: "owners",
    category: "general",
    question: "How do we get started?",
    answer:
      "Choose Find My Best Fit or contact us. We will identify your intended outcome, current property stage, and the best next step.",
  },
  {
    id: "cancel-anytime",
    audience: "owners",
    category: "general",
    question: "Can I cancel anytime?",
    answer:
      "Yes. You can cancel a monthly or annual platform subscription at any time. Your workspace remains available through the end of the current billing period.",
  },

  // Guests
  {
    id: "guest-account-required",
    audience: "guests",
    category: "booking",
    question: "Do I need to create an account to book a stay?",
    answer:
      "No. You can browse and book published properties directly without creating an account. An account is only needed if you want to manage upcoming or past stays in one place.",
  },
  {
    id: "guest-payment-methods",
    audience: "guests",
    category: "booking",
    question: "What payment methods do you accept for bookings?",
    answer:
      "We accept major credit and debit cards. Payment is processed securely at the time of booking, and full details are provided during checkout.",
  },
  {
    id: "guest-check-in",
    audience: "guests",
    category: "during-stay",
    question: "How do I get check-in instructions?",
    answer:
      "Check-in instructions, door codes, and property details are shared through your digital guidebook and confirmation email ahead of your arrival date.",
  },
  {
    id: "guest-contact-during-stay",
    audience: "guests",
    category: "during-stay",
    question: "Who do I contact if something comes up during my stay?",
    answer:
      "Your guidebook includes direct contact information for your host or property team, along with answers to the most common questions guests have during a stay.",
  },
  {
    id: "guest-guidebook-explainer",
    audience: "guests",
    category: "guidebooks",
    question: "What is a digital guidebook and how do I use it?",
    answer:
      "It's a mobile-friendly guide to your property and the local area—covering check-in, amenities, house rules, and recommendations—accessible from any device, no app required.",
  },
  {
    id: "guest-leave-review",
    audience: "guests",
    category: "general",
    question: "How do I leave a review after my stay?",
    answer:
      "You'll receive a follow-up message after checkout with a link to share feedback. Reviews help us and the property owner keep improving the guest experience.",
  },

  // Partners
  {
    id: "partner-referral-program",
    audience: "partners",
    category: "referrals",
    question: "Do you offer a referral program?",
    answer:
      "Yes. Partners who refer property owners or investors can participate in our referral program. Contact us for current terms and how referrals are tracked.",
  },
  {
    id: "partner-integrations",
    audience: "partners",
    category: "integrations",
    question: "Which property management systems do you integrate with?",
    answer:
      "We're actively expanding provider integrations, starting with Hospitable, with Airbnb, Vrbo, Guesty, and Hostaway on our roadmap for direct connections.",
  },
  {
    id: "partner-become-a-partner",
    audience: "partners",
    category: "partnerships",
    question: "How do I become a Luxe Haven partner?",
    answer:
      "Reach out through our contact form describing your business and the kind of partnership you're interested in. Our team will follow up to explore fit.",
  },
  {
    id: "partner-contact",
    audience: "partners",
    category: "general",
    question: "Who do I contact about a partnership opportunity?",
    answer:
      "Use the contact form and select \"Partnership opportunity\" as the inquiry type, and the right person on our team will respond.",
  },

  // Investors
  {
    id: "investor-evaluate-purchase",
    audience: "investors",
    category: "investment",
    question: "Can you help evaluate a potential property purchase?",
    answer:
      "Yes. Investment Intelligence offers analysis ranging from a quick review to full professional underwriting, so you can evaluate an opportunity with transparent assumptions and evidence.",
  },
  {
    id: "investor-due-diligence-scope",
    audience: "investors",
    category: "due-diligence",
    question: "What does an investment due diligence review include?",
    answer:
      "Market and location analysis, financial underwriting and projections, comparable-set benchmarking, risk assessment, and a clear investment summary and recommendation.",
  },
  {
    id: "investor-performance-reporting",
    audience: "investors",
    category: "performance",
    question: "How do you report on portfolio performance?",
    answer:
      "Portfolio-level dashboards and periodic reports cover revenue, occupancy, and profitability trends, so you can track how your investments are performing over time.",
  },
  {
    id: "investor-get-started",
    audience: "investors",
    category: "general",
    question: "How do I get started with investment services?",
    answer:
      "Choose Find My Best Fit or explore Investment Intelligence packages directly. We'll help identify the right level of analysis for your situation.",
  },
];
