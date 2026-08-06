import { ResourcePage } from "@/components/marketing/resource-page";

const cards = [
  {
    eyebrow: "Guidebook",
    category: "Guidebooks",
    title: "Welcome Message Template Pack",
    description: "Warm, practical copy for a confident guest arrival.",
    href: "/contact?service=guidebook",
    action: "Request template",
  },
  {
    eyebrow: "Operations",
    category: "Checklists",
    title: "Cleaning Checklist Template",
    description: "A room-by-room turnover standard for consistent quality.",
    href: "/contact?service=consulting",
    action: "Request template",
  },
  {
    eyebrow: "Operations",
    category: "SOPs",
    title: "Turnover SOP Template",
    description:
      "A standard operating procedure for consistent, verifiable property resets.",
    href: "/contact?service=consulting",
    action: "Request template",
  },
  {
    eyebrow: "Reports",
    category: "Reports",
    title: "Owner Monthly Report Template",
    description:
      "A clear operating summary for revenue, expenses, and actions.",
    href: "/dashboard/reports/owner",
    action: "View reports",
  },
  {
    eyebrow: "Guest communication",
    category: "Guest Communication",
    title: "Review Response Template",
    description: "Thoughtful response patterns for common guest feedback.",
    href: "/contact?service=guidebook",
    action: "Request template",
  },
  {
    eyebrow: "Custom",
    title: "Need a custom template?",
    description:
      "Tell us what workflow or guest experience you need to standardize.",
    href: "/contact?service=consulting",
    action: "Contact us",
  },
];

const categories = [
  "All Templates",
  "Guidebooks",
  "Checklists",
  "SOPs",
  "Reports",
  "Guest Communication",
];

export default async function TemplatesPage({
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
      active="Templates"
      eyebrow="Templates"
      title="Ready-to-use templates for daily operations."
      description="Save time, stay consistent, and deliver a better guest experience with proven templates."
      cards={visibleCards}
      categories={categories}
      activeCategory={activeCategory}
      basePath="/resources/templates"
      hideBottomBand
    />
  );
}
