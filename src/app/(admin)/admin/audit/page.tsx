import { AdminUnavailableView } from "@/components/admin/admin-empty-view";
export default function AuditPage() { return <AdminUnavailableView title="Audit" description="Review sanitized administrative activity." capability="The repository has domain-specific activity records but no unified append-only admin audit projection or authorized export command." />; }
