import type { Property } from "@/types/database";
import { inputClass } from "./shared";

type Props = {
  values: Partial<Property> & Record<string, unknown>;
};

export function LocationSection({ values }: Props) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      <label className="grid gap-2 text-sm md:col-span-2">
        Address line 1
        <input name="address_line_1" defaultValue={String(values.address_line_1 ?? "")} className={inputClass()} />
      </label>

      <label className="grid gap-2 text-sm">
        Address line 2
        <input name="address_line_2" defaultValue={String(values.address_line_2 ?? "")} className={inputClass()} />
      </label>

      <label className="grid gap-2 text-sm">
        Neighborhood
        <input name="neighborhood" defaultValue={String(values.neighborhood ?? "")} className={inputClass()} />
      </label>

      <label className="grid gap-2 text-sm">
        City
        <input name="city" defaultValue={String(values.city ?? "")} className={inputClass()} />
      </label>

      <label className="grid gap-2 text-sm">
        State
        <input name="state" defaultValue={String(values.state ?? "")} className={inputClass()} />
      </label>

      <label className="grid gap-2 text-sm">
        Postal code
        <input name="postal_code" defaultValue={String(values.postal_code ?? "")} className={inputClass()} />
      </label>

      <label className="grid gap-2 text-sm">
        Country
        <input name="country" defaultValue={String(values.country ?? "US")} className={inputClass()} />
      </label>
    </div>
  );
}
