import type { Property } from "@/types/database";
import { lines } from "./shared";

type Props = {
  values: Partial<Property> & Record<string, unknown>;
};

export function AmenitiesSection({ values }: Props) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <label className="grid gap-2 text-sm">
        Amenities
        <textarea name="amenities" defaultValue={lines(values.amenities as string[])} className="input-dark min-h-40" />
      </label>

      <label className="grid gap-2 text-sm">
        Highlights
        <textarea name="highlights" defaultValue={lines(values.highlights as string[])} className="input-dark min-h-40" />
      </label>
    </div>
  );
}
