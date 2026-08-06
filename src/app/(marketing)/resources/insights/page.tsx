import { ResourcePage } from "@/components/marketing/resource-page";
const cards = [
  {
    eyebrow: "Revenue",
    title: "How to Price for Events Without Losing Weekday Bookings",
    description:
      "A practical approach to event compression, minimum stays, and surrounding-night demand.",
    href: "/contact?service=optimization",
    action: "Discuss pricing",
  },
  {
    eyebrow: "Guest experience",
    title: "The Small Touches That Drive 5-Star Reviews",
    description:
      "Operational details guests remember—and teams can deliver consistently.",
    href: "/solutions/guest-experience",
    action: "Read insight",
  },
  {
    eyebrow: "Operations",
    title: "Turnover Checklists That Protect Quality",
    description:
      "Build clear ownership and verification into every property reset.",
    href: "/resources/templates",
    action: "View templates",
  },
  {
    eyebrow: "Investment",
    title: "What Investors Look for in Short-Term Rentals",
    description:
      "Evaluate demand, constraints, operating risk, and realistic upside.",
    href: "/solutions/investment",
    action: "Explore investment",
  },
  {
    eyebrow: "Performance",
    title: "Stop Guessing: Use Data to Make Better Decisions",
    description:
      "Turn signals into priorities without creating another dashboard to monitor.",
    href: "/performance/overview",
    action: "See the platform",
  },
  {
    eyebrow: "Technology",
    title: "Automation That Saves Time and Protects Reviews",
    description:
      "Use automation where consistency matters while preserving human hospitality.",
    href: "/solutions/operations",
    action: "Explore operations",
  },
  {
    eyebrow: "Revenue",
    title: "Dynamic Pricing Strategies That Actually Work",
    description:
      "Balance occupancy, rate integrity, seasonality, and local demand.",
    href: "/solutions/revenue",
    action: "Explore revenue",
  },
  {
    eyebrow: "Guest experience",
    title: "Your Guidebook Is Your Silent Guest Service Team",
    description:
      "Give guests answers at the right moment and reduce repetitive questions.",
    href: "/solutions/guest-experience",
    action: "Explore guidebooks",
  },
];
export default function InsightsPage() {
  return (
    <ResourcePage
      active="Insights"
      eyebrow="Insights"
      title="Ideas and insights for hospitality performance."
      description="Real-world perspectives, strategies, and data to help you grow revenue, improve guest experience, and operate better."
      cards={cards}
      categories={[
        "All Topics",
        "Revenue",
        "Guest Experience",
        "Operations",
        "Investment",
        "Technology",
        "Hospitality Performance",
      ]}
    />
  );
}
