import { ResourcePage } from "@/components/marketing/resource-page";
const cards = [
  {
    eyebrow: "Guidebook",
    title: "Welcome Message Template Pack",
    description: "Warm, practical copy for a confident guest arrival.",
    href: "/contact?service=guidebook",
    action: "Request template",
  },
  {
    eyebrow: "Operations",
    title: "Cleaning Checklist Template",
    description: "A room-by-room turnover standard for consistent quality.",
    href: "/contact?service=consulting",
    action: "Request template",
  },
  {
    eyebrow: "Owner reports",
    title: "Owner Monthly Report Template",
    description:
      "A clear operating summary for revenue, expenses, and actions.",
    href: "/dashboard/reports/owner",
    action: "View reports",
  },
  {
    eyebrow: "Guest communication",
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
export default function TemplatesPage() {
  return (
    <ResourcePage
      active="Templates"
      eyebrow="Templates"
      title="Ready-to-use templates for daily operations."
      description="Save time, stay consistent, and deliver a better guest experience with proven templates."
      cards={cards}
      categories={[
        "All Templates",
        "Guidebooks",
        "Checklists",
        "SOPs",
        "Owner Reports",
        "Guest Communication",
      ]}
    />
  );
}
