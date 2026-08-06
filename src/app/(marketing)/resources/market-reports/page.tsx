import { ResourcePage } from "@/components/marketing/resource-page";

const markets = ["Phoenix", "Scottsdale", "Dallas", "Austin", "Los Angeles"];

const cards = markets.map((market) => ({
  eyebrow: "July 2026",
  category: market,
  title: `${market}, ${market === "Los Angeles" ? "CA" : market === "Dallas" || market === "Austin" ? "TX" : "AZ"} Market Report`,
  description:
    "Market context for ADR, occupancy, demand patterns, and supply—presented with source and limitation context.",
  href: "/contact?service=investment",
  action: "Request report",
}));

const categories = ["All Markets", ...markets];

export default async function MarketReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const activeCategory = category && categories.includes(category) ? category : categories[0];

  const visibleCards = cards.filter(
    (card) => activeCategory === categories[0] || card.category === activeCategory,
  );

  return (
    <ResourcePage
      active="Market Reports"
      eyebrow="Market reports"
      title="Data-driven market intelligence."
      description="Market context for short-term rental operators and investors. Request a tailored report for your property or opportunity."
      cards={visibleCards}
      categories={categories}
      activeCategory={activeCategory}
      basePath="/resources/market-reports"
    />
  );
}
