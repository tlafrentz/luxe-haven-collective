export type InsightCard = {
  eyebrow: string;
  category: string;
  title: string;
  description: string;
  href: string;
  action: string;
  meta: string;
};

export const insightsCategories = [
  "All Topics",
  "Revenue",
  "Operations",
  "Guest Experience",
  "Technology",
  "Investment",
];

export const insightsCards: InsightCard[] = [
  {
    eyebrow: "Revenue",
    category: "Revenue",
    title: "Dynamic Pricing Strategies That Actually Work",
    description:
      "Balance occupancy, rate integrity, seasonality, and local demand.",
    href: "/solutions/revenue",
    action: "Explore revenue",
    meta: "Jul 1, 2026 · 7 min read",
  },
  {
    eyebrow: "Operations",
    category: "Operations",
    title: "Automation That Saves Time and Protects Reviews",
    description:
      "Use automation where consistency matters while preserving human hospitality.",
    href: "/solutions/operations",
    action: "Explore operations",
    meta: "Jun 28, 2026 · 6 min read",
  },
  {
    eyebrow: "Technology",
    category: "Technology",
    title: "Stop Guessing: Use Data to Make Better Decisions",
    description:
      "Turn signals into priorities without creating another dashboard to monitor.",
    href: "/performance/overview",
    action: "See the platform",
    meta: "Jun 25, 2026 · 5 min read",
  },
  {
    eyebrow: "Guest Experience",
    category: "Guest Experience",
    title: "Your Guidebook Is Your Silent Guest Service Team",
    description:
      "Give guests answers at the right moment and reduce repetitive questions.",
    href: "/solutions/guest-experience",
    action: "Explore guidebooks",
    meta: "Jun 20, 2026 · 6 min read",
  },
  {
    eyebrow: "Revenue",
    category: "Revenue",
    title: "How to Price for Events Without Losing Weekday Bookings",
    description:
      "A practical approach to event compression, minimum stays, and surrounding-night demand.",
    href: "/contact?service=optimization",
    action: "Discuss pricing",
    meta: "Jul 15, 2026 · 6 min read",
  },
  {
    eyebrow: "Guest Experience",
    category: "Guest Experience",
    title: "The Small Touches That Drive 5-Star Reviews",
    description:
      "Operational details guests remember—and teams can deliver consistently.",
    href: "/solutions/guest-experience",
    action: "Read insight",
    meta: "Jul 10, 2026 · 5 min read",
  },
  {
    eyebrow: "Operations",
    category: "Operations",
    title: "Turnover Checklists That Protect Quality",
    description:
      "Build clear ownership and verification into every property reset.",
    href: "/resources/templates",
    action: "View templates",
    meta: "Jul 8, 2026 · Template",
  },
  {
    eyebrow: "Investment",
    category: "Investment",
    title: "What Investors Look for in Short-Term Rentals",
    description:
      "Evaluate demand, constraints, operating risk, and realistic upside.",
    href: "/solutions/investment",
    action: "Explore investment",
    meta: "Jul 6, 2026 · 8 min read",
  },
];
