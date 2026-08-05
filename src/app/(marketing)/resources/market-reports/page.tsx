import { ResourcePage } from "@/components/marketing/resource-page";
const cards = ["Phoenix, AZ", "Scottsdale, AZ", "Dallas, TX", "Austin, TX"].map(
  (market) => ({
    eyebrow: "July 2026",
    title: `${market} Market Report`,
    description:
      "Market context for ADR, occupancy, demand patterns, and supply—presented with source and limitation context.",
    href: `/contact?service=investment`,
    action: "Request report",
  }),
);
export default function MarketReportsPage() {
  return (
    <ResourcePage
      active="Market Reports"
      eyebrow="Market reports"
      title="Data-driven market intelligence."
      description="Market context for short-term rental operators and investors. Request a tailored report for your property or opportunity."
      cards={cards}
      categories={[
        "All Markets",
        "Phoenix",
        "Scottsdale",
        "Dallas",
        "Fort Worth",
        "Austin",
        "Los Angeles",
      ]}
    />
  );
}
