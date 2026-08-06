import { ResourcePage } from "@/components/marketing/resource-page";

const cards = [
  {
    eyebrow: "LHP-001",
    category: "Investment",
    title: "Investment Due Diligence Playbook",
    description: "Underwrite smarter and reduce risk before you buy.",
    href: "/contact?service=investment",
    action: "Request playbook",
  },
  {
    eyebrow: "LHP-002",
    category: "Guest Experience",
    title: "Guest Experience Playbook",
    description: "Create five-star stays that drive reviews and loyalty.",
    href: "/contact?service=guidebook",
    action: "Request playbook",
  },
  {
    eyebrow: "LHP-003",
    category: "Marketing",
    title: "Listing Optimization Playbook",
    description: "Build listings that attract the right guests and convert.",
    href: "/contact?service=optimization",
    action: "Request playbook",
  },
  {
    eyebrow: "LHP-004",
    category: "Operations",
    title: "Operations Excellence Playbook",
    description: "Build systems that deliver consistent five-star stays.",
    href: "/contact?service=operations",
    action: "Request playbook",
  },
  {
    eyebrow: "LHP-005",
    category: "Revenue",
    title: "Owner Performance Checklist",
    description: "Assess your property across key performance areas.",
    href: "/lead-magnet",
    action: "Download PDF",
  },
  {
    eyebrow: "Custom",
    title: "Need something custom?",
    description:
      "Tell us the workflow or decision you need a playbook for.",
    href: "/contact?service=consulting",
    action: "Contact us",
  },
];

const categories = [
  "All Playbooks",
  "Investment",
  "Revenue",
  "Guest Experience",
  "Operations",
  "Marketing",
];

export default async function PlaybooksPage({
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
      active="Playbooks"
      eyebrow="Playbooks"
      title="Professional playbooks for modern hospitality businesses."
      description="Step-by-step frameworks for better decisions, stronger operations, and higher performance."
      cards={visibleCards}
      categories={categories}
      activeCategory={activeCategory}
      basePath="/resources/playbooks"
      hideBottomBand
    />
  );
}
