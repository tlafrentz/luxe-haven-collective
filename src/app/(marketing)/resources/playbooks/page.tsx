import { ResourcePage } from "@/components/marketing/resource-page";
const cards = [
  {
    eyebrow: "LHP-001",
    title: "Investment Due Diligence Playbook",
    description: "Underwrite smarter and reduce risk before you buy.",
    href: "/contact?service=investment",
    action: "Request playbook",
  },
  {
    eyebrow: "LHP-002",
    title: "Guest Experience Playbook",
    description: "Create five-star stays that drive reviews and loyalty.",
    href: "/contact?service=guidebook",
    action: "Request playbook",
  },
  {
    eyebrow: "LHP-003",
    title: "Listing Optimization Playbook",
    description: "Build listings that attract the right guests and convert.",
    href: "/contact?service=optimization",
    action: "Request playbook",
  },
  {
    eyebrow: "LHP-004",
    title: "Operations Excellence Playbook",
    description: "Build systems that deliver consistent five-star stays.",
    href: "/solutions/operations",
    action: "Explore operations",
  },
  {
    eyebrow: "LHP-005",
    title: "Owner Performance Checklist",
    description: "Assess your property across key performance areas.",
    href: "/lead-magnet",
    action: "Download PDF",
  },
];
export default function PlaybooksPage() {
  return (
    <ResourcePage
      active="Playbooks"
      eyebrow="Playbooks"
      title="Professional playbooks for modern hospitality businesses."
      description="Step-by-step frameworks for better decisions, stronger operations, and higher performance."
      cards={cards}
      categories={[
        "All Playbooks",
        "Investment",
        "Revenue",
        "Guest Experience",
        "Operations",
        "Listing & Marketing",
      ]}
    />
  );
}
