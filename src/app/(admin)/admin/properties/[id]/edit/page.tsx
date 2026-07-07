import Link from "next/link";
import { PropertyForm } from "@/components/admin/property-form";
import { getPropertyByIdForAdmin } from "@/lib/properties";

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = await getPropertyByIdForAdmin(id);
  return (
    <section>
      <Link href={`/admin/properties/${property.id}`} className="text-sm text-white/50 hover:text-white">← Back to property</Link>
      <h1 className="mt-4 font-serif text-5xl">Edit {property.name}</h1>
      <div className="mt-10"><PropertyForm property={property} /></div>
    </section>
  );
}
