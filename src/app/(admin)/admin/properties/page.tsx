import Link from "next/link";
import { deletePropertyAction } from "@/app/actions/properties";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { PropertyStatusBadge } from "@/components/admin/property-status-badge";
import { getAllPropertiesForAdmin, propertyImage } from "@/lib/properties";

export default async function AdminPropertiesPage() {
  const properties = await getAllPropertiesForAdmin();

  const activeCount = properties.filter((property) => property.status === "active").length;
  const draftCount = properties.filter((property) => property.status === "draft").length;
  const archivedCount = properties.filter((property) => property.status === "archived").length;

  return (
    <section>
      <AdminPageHeader
        eyebrow="Inventory"
        title="Managed properties"
        description="Create, publish, pause, and maintain the homes that power the Luxe Haven marketing site and future booking engine."
        actions={
          <Link
            href="/admin/properties/new"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            New property
          </Link>
        }
      />

      <div className="mt-10 grid gap-4 md:grid-cols-4">
        <AdminStatCard label="Total" value={properties.length} detail="All managed properties" />
        <AdminStatCard label="Active" value={activeCount} detail="Visible on the website" />
        <AdminStatCard label="Drafts" value={draftCount} detail="Not yet published" />
        <AdminStatCard label="Archived" value={archivedCount} detail="Hidden from inventory" />
      </div>

      <AdminSectionCard className="mt-8">
        <div className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-[0.22em] text-white/45">
              <tr>
                <th className="p-5">Property</th>
                <th className="p-5">Location</th>
                <th className="p-5">Rate</th>
                <th className="p-5">Status</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {properties.map((property) => (
                <tr key={property.id} className="border-b border-white/5 last:border-0">
                  <td className="p-5">
                    <div className="flex items-center gap-4">
                      <img
                        src={propertyImage(property)}
                        alt=""
                        className="h-16 w-24 rounded-2xl object-cover"
                      />
                      <div>
                        <p className="font-semibold text-white">{property.name}</p>
                        <p className="text-white/45">/{property.slug}</p>
                      </div>
                    </div>
                  </td>

                  <td className="p-5 text-white/65">
                    {property.city}, {property.state}
                  </td>

                  <td className="p-5 text-white/65">
                    ${Number(property.nightly_rate).toLocaleString()}/night
                  </td>

                  <td className="p-5">
                    <PropertyStatusBadge status={property.status} />
                  </td>

                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10"
                        href={`/admin/properties/${property.id}`}
                      >
                        View
                      </Link>

                      <Link
                        className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10"
                        href={`/admin/properties/${property.id}/edit`}
                      >
                        Edit
                      </Link>

                      <form action={deletePropertyAction}>
                        <input type="hidden" name="id" value={property.id} />
                        <button className="rounded-full border border-red-300/20 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10">
                          Archive
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}

              {!properties.length ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-white/50">
                    No properties yet. Create the first Luxe Haven stay.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminSectionCard>
    </section>
  );
}
