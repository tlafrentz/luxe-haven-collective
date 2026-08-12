export type InsightCard = {
  eyebrow: string;
  category: string;
  title: string;
  description: string;
  href: string;
  action: string;
  meta: string;
  image: string;
};

export type InsightArticle = InsightCard & {
  slug: string;
  publishedAt: string;
  readingTimeMinutes: number;
  heroAlt: string;
  ogImage: string;
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
    href: "/resources/insights/dynamic-pricing-strategies-that-actually-work",
    action: "Read insight",
    meta: "Jul 1, 2026 · 7 min read",
    image:
      "/images/journal/dynamic-pricing-strategies-that-actually-work/dynamic-pricing-hero.jpg",
  },
  {
    eyebrow: "Operations",
    category: "Operations",
    title: "Automation That Saves Time and Protects Reviews",
    description:
      "Use automation where consistency matters while preserving human hospitality.",
    href: "/resources/insights/automation-that-saves-time-and-protects-reviews",
    action: "Read insight",
    meta: "Jun 28, 2026 · 6 min read",
    image:
      "/images/journal/automation-that-saves-time-and-protects-reviews/automation-hero-v2.png",
  },
  {
    eyebrow: "Technology",
    category: "Technology",
    title: "Stop Guessing: Use Data to Make Better Decisions",
    description:
      "Turn signals into priorities without creating another dashboard to monitor.",
    href: "/resources/insights/stop-guessing-use-data-to-make-better-decisions",
    action: "Read insight",
    meta: "Jun 25, 2026 · 5 min read",
    image:
      "/images/journal/stop-guessing-use-data-to-make-better-decisions/decision-intelligence-hero-v2.png",
  },
  {
    eyebrow: "Guest Experience",
    category: "Guest Experience",
    title: "Your Guidebook Is Your Silent Guest Service Team",
    description:
      "Give guests answers at the right moment and reduce repetitive questions.",
    href: "/resources/insights/your-guidebook-is-your-silent-guest-service-team",
    action: "Read insight",
    meta: "Jun 20, 2026 · 6 min read",
    image:
      "/images/journal/your-guidebook-is-your-silent-guest-service-team/guidebook-hero.jpg",
  },
  {
    eyebrow: "Revenue",
    category: "Revenue",
    title: "How to Price for Events Without Losing Weekday Bookings",
    description:
      "A practical approach to event compression, minimum stays, and surrounding-night demand.",
    href: "/resources/insights/how-to-price-for-events-without-losing-weekday-bookings",
    action: "Read insight",
    meta: "Jul 15, 2026 · 6 min read",
    image:
      "/images/journal/how-to-price-for-events-without-losing-weekday-bookings/event-pricing-hero.jpg",
  },
  {
    eyebrow: "Guest Experience",
    category: "Guest Experience",
    title: "The Small Touches That Drive 5-Star Reviews",
    description:
      "Operational details guests remember—and teams can deliver consistently.",
    href: "/resources/insights/the-small-touches-that-drive-5-star-reviews",
    action: "Read insight",
    meta: "Jul 10, 2026 · 5 min read",
    image:
      "/images/journal/the-small-touches-that-drive-5-star-reviews/small-touches-hero.jpg",
  },
  {
    eyebrow: "Operations",
    category: "Operations",
    title: "Turnover Checklists That Protect Quality",
    description:
      "Build clear ownership and verification into every property reset.",
    href: "/resources/insights/turnover-checklists-that-protect-quality",
    action: "Read insight",
    meta: "Jul 8, 2026 · Template",
    image:
      "/images/journal/turnover-checklists-that-protect-quality/turnover-hero.jpg",
  },
  {
    eyebrow: "Investment",
    category: "Investment",
    title: "What Investors Look for in Short-Term Rentals",
    description:
      "Evaluate demand, constraints, operating risk, and realistic upside.",
    href: "/resources/insights/what-investors-look-for-in-short-term-rentals",
    action: "Read insight",
    meta: "Jul 6, 2026 · 8 min read",
    image:
      "/images/journal/what-investors-look-for-in-short-term-rentals/investor-hero.jpg",
  },
];

const articleDetails: Record<
  string,
  Omit<InsightArticle, keyof InsightCard>
> = {
  "dynamic-pricing-strategies-that-actually-work": {
    slug: "dynamic-pricing-strategies-that-actually-work",
    publishedAt: "2026-07-01",
    readingTimeMinutes: 7,
    heroAlt: "Resort-style pool at a hospitality property",
    ogImage:
      "/images/journal/dynamic-pricing-strategies-that-actually-work/dynamic-pricing-og.png",
  },
  "automation-that-saves-time-and-protects-reviews": {
    slug: "automation-that-saves-time-and-protects-reviews",
    publishedAt: "2026-06-28",
    readingTimeMinutes: 6,
    heroAlt: "Hospitality operations prepared for a guest arrival",
    ogImage:
      "/images/journal/automation-that-saves-time-and-protects-reviews/automation-og.png",
  },
  "stop-guessing-use-data-to-make-better-decisions": {
    slug: "stop-guessing-use-data-to-make-better-decisions",
    publishedAt: "2026-06-25",
    readingTimeMinutes: 5,
    heroAlt: "Hospitality analytics in a modern workspace",
    ogImage:
      "/images/journal/stop-guessing-use-data-to-make-better-decisions/decision-intelligence-og.png",
  },
  "your-guidebook-is-your-silent-guest-service-team": {
    slug: "your-guidebook-is-your-silent-guest-service-team",
    publishedAt: "2026-06-20",
    readingTimeMinutes: 7,
    heroAlt: "A welcoming guest arrival experience",
    ogImage:
      "/images/journal/your-guidebook-is-your-silent-guest-service-team/guidebook-og.png",
  },
  "how-to-price-for-events-without-losing-weekday-bookings": {
    slug: "how-to-price-for-events-without-losing-weekday-bookings",
    publishedAt: "2026-07-15",
    readingTimeMinutes: 8,
    heroAlt: "A hospitality destination during event demand",
    ogImage:
      "/images/journal/how-to-price-for-events-without-losing-weekday-bookings/event-pricing-og.png",
  },
  "the-small-touches-that-drive-5-star-reviews": {
    slug: "the-small-touches-that-drive-5-star-reviews",
    publishedAt: "2026-07-10",
    readingTimeMinutes: 7,
    heroAlt: "Thoughtful details in a guest-ready room",
    ogImage:
      "/images/journal/the-small-touches-that-drive-5-star-reviews/small-touches-og.png",
  },
  "turnover-checklists-that-protect-quality": {
    slug: "turnover-checklists-that-protect-quality",
    publishedAt: "2026-07-08",
    readingTimeMinutes: 8,
    heroAlt: "A carefully prepared hospitality property",
    ogImage:
      "/images/journal/turnover-checklists-that-protect-quality/turnover-og.png",
  },
  "what-investors-look-for-in-short-term-rentals": {
    slug: "what-investors-look-for-in-short-term-rentals",
    publishedAt: "2026-07-06",
    readingTimeMinutes: 9,
    heroAlt: "A short-term rental considered as an investment",
    ogImage:
      "/images/journal/what-investors-look-for-in-short-term-rentals/investor-og.png",
  },
};

export const insightArticles: InsightArticle[] = insightsCards.map((card) => {
  const slug = card.href.split("/").at(-1)!;
  return { ...card, ...articleDetails[slug]! };
});

export function findInsightArticle(slug: string) {
  return insightArticles.find((article) => article.slug === slug);
}
