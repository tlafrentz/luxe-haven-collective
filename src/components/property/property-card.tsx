import Link from "next/link";
import { BedDouble, Bath, Users } from "lucide-react";
import type { Property } from "@/types/database";
import { currency } from "@/lib/utils";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link href={`/stays/${property.slug}`} className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="h-64 bg-cover bg-center transition duration-500 group-hover:scale-[1.02]" style={{ backgroundImage: `url(${property.images[0]})` }} />
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div><h3 className="text-xl font-semibold">{property.name}</h3><p className="mt-1 text-sm text-muted-foreground">{property.city}, {property.state}</p></div>
          <p className="text-right text-sm"><span className="font-semibold">{currency.format(property.nightly_rate)}</span><br /><span className="text-muted-foreground">/ night</span></p>
        </div>
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{property.description}</p>
        <div className="mt-5 flex gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-1"><BedDouble size={16} />{property.bedrooms}</span><span className="flex items-center gap-1"><Bath size={16} />{property.bathrooms}</span><span className="flex items-center gap-1"><Users size={16} />{property.max_guests}</span></div>
      </div>
    </Link>
  );
}
