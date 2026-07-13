import Image from "next/image";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { propertyImage } from "@/lib/properties";
import type { Property } from "@/types/database";

export function PropertyCard({
  property,
}: {
  property: Property;
}) {
  return (
    <Card className="group overflow-hidden">
      <Link href={`/stays/${property.slug}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <Image
            src={propertyImage(property)}
            alt={property.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-serif text-2xl">
                {property.name}
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                {property.city}, {property.state}
              </p>
            </div>

            <p className="text-right text-sm font-semibold">
              $
              {Number(
                property.nightly_rate,
              ).toLocaleString()}
              <span className="font-normal text-muted-foreground">
                /night
              </span>
            </p>
          </div>

          <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">
            {property.short_description ||
              property.description}
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>
              {property.bedrooms} bedrooms
            </span>
            <span>•</span>
            <span>
              {property.bathrooms} baths
            </span>
            <span>•</span>
            <span>
              {property.max_guests} guests
            </span>
          </div>
        </div>
      </Link>
    </Card>
  );
}
