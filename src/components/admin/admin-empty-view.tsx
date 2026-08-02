import { AdminPageHeader } from "./admin-page-header";
import { AdminSectionCard } from "./admin-section-card";

export function AdminUnavailableView({ title, description, capability }: { title: string; description: string; capability: string }) {
  return <div className="space-y-8 py-8">
    <AdminPageHeader title={title} description={description} />
    <AdminSectionCard title="Data unavailable" description={capability}>
      <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        No values are shown because this environment does not yet have a canonical, authorized data source for this capability.
      </p>
    </AdminSectionCard>
  </div>;
}
