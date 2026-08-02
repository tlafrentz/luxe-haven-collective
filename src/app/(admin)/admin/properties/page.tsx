import Image from "next/image";
import Link from "next/link";

import { deletePropertyAction } from "@/app/actions/properties";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { PropertyStatusBadge } from "@/components/admin/property-status-badge";
import {
  getAllPropertiesForAdmin,
  propertyImage,
} from "@/lib/properties";

export default async function AdminPropertiesPage() {
  const properties =
    await getAllPropertiesForAdmin();

  const activeCount = properties.filter(
    (property) =>
      property.status === "active",
  ).length;

  const draftCount = properties.filter(
    (property) =>
      property.status === "draft",
  ).length;

  const archivedCount = properties.filter(
    (property) =>
      property.status === "archived",
  ).length;

  return (
    <section className="py-8">
      <AdminPageHeader
        title="Properties"
        description="Manage canonical property records and their customer relationships."
        actions={
          <Link
            href="/admin/properties/new"
            className="inline-flex items-center justify-center rounded-lg bg-stone-950 px-5 py-3 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Add Property
          </Link>
        }
      />

      <div className="mt-10 grid gap-4 md:grid-cols-4">
        <AdminStatCard
          label="Total"
          value={properties.length}
          detail="All managed properties"
        />

        <AdminStatCard
          label="Active"
          value={activeCount}
          detail="Visible on the website"
        />

        <AdminStatCard
            label="Inactive"
          value={draftCount}
            detail="Draft lifecycle state"
        />

        <AdminStatCard
            label="Maintenance"
          value={archivedCount}
            detail="No canonical maintenance property state"
        />
      </div>

      <AdminSectionCard className="mt-8">
        <div className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-xs text-stone-500">
              <tr>
                <th className="p-5">
                  Property
                </th>
                <th className="p-5">
                  Location
                </th>
                <th className="p-5">
                  Rate
                </th>
                <th className="p-5">
                  Status
                </th>
                <th className="p-5 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {properties.map((property) => (
                <tr
                  key={property.id}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-2xl">
                        <Image
                          src={propertyImage(
                            property,
                          )}
                          alt={`${property.name} property`}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      </div>

                      <div>
                        <p className="font-semibold text-stone-950">
                          {property.name}
                        </p>

                        <p className="text-stone-500">
                          /{property.slug}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="p-5 text-stone-600">
                    {property.city},{" "}
                    {property.state}
                  </td>

                  <td className="p-5 text-stone-600">
                    $
                    {Number(
                      property.nightly_rate,
                    ).toLocaleString()}
                    /night
                  </td>

                  <td className="p-5">
                    <PropertyStatusBadge
                      status={property.status}
                    />
                  </td>

                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/properties/${property.id}`}
                        className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                      >
                        View
                      </Link>

                      <Link
                        href={`/admin/properties/${property.id}/edit`}
                        className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                      >
                        Edit
                      </Link>

                      <form
                        action={
                          deletePropertyAction
                        }
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={property.id}
                        />

                        <button
                          type="submit"
                          className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Archive
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}

              {properties.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-10 text-center text-stone-500"
                  >
                    No properties yet. Create
                    the first Luxe Haven stay.
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
