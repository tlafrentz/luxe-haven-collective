import Link from "next/link";
import { PropertyForm } from "@/components/admin/property-form";

export default function NewPropertyPage() {
  return (
    <section>
      <Link href="/admin/properties" className="text-sm text-white/50 hover:text-white">← Back to properties</Link>
      <h1 className="mt-4 font-serif text-5xl">Create property</h1>
      <p className="mt-3 max-w-2xl text-white/60">Add the operational, marketing, pricing, and SEO details for a new Luxe Haven property.</p>
      <div className="mt-10"><PropertyForm /></div>
    </section>
  );
}
