import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
export default function SupportPage() { return <div className="space-y-8 py-8"><AdminPageHeader title="Support" description="View and manage customer support operations." /><AdminSectionCard title="Ticket lifecycle unavailable" description="Contact inquiries exist, but they are not presented as support tickets because no canonical ticket assignment, priority, SLA, or lifecycle model exists."><Link className="inline-flex rounded-lg bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white" href="/admin/inquiries">Open contact inquiries</Link></AdminSectionCard></div>; }
