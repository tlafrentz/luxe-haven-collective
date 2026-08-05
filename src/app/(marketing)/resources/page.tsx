import { ResourcePage } from "@/components/marketing/resource-page";

const cards = [
  {
    eyebrow: "New release",
    title: "Owner Performance Checklist",
    description:
      "The practical owner checklist for reviewing revenue, guest experience, operations, and risk.",
    href: "/lead-magnet",
    action: "Download free",
  },
  {
    eyebrow: "Playbook",
    title: "Investment Due Diligence Playbook",
    description: "Underwrite smarter and reduce risk before you buy.",
    href: "/resources/playbooks",
    action: "View playbook",
  },
  {
    eyebrow: "Playbook",
    title: "Guest Experience Playbook",
    description: "Create five-star stays that drive reviews and repeat visits.",
    href: "/resources/playbooks",
    action: "View playbook",
  },
  {
    eyebrow: "Playbook",
    title: "Listing Optimization Playbook",
    description:
      "Write high-converting listings that attract the right guests.",
    href: "/resources/playbooks",
    action: "View playbook",
  },
];

export default function ResourcesPage() {
  return (
    <ResourcePage
      active="Luxe Haven Press"
      eyebrow="Resources"
      title="Luxe Haven Press"
      description="Knowledge that helps hospitality businesses perform better. Practical insights, proven playbooks, and operational templates built for owners and operators."
      cards={cards}
      categories={[
        "Featured publications",
        "Insights",
        "Playbooks",
        "Templates",
        "Market Reports",
      ]}
    />
  );
}
