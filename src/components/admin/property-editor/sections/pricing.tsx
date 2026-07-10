import type { Property } from "@/types/database";
import { inputClass } from "./shared";

type Props = {
  values: Partial<Property> & Record<string, unknown>;
};

export function PricingSection({ values }: Props) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      <label className="grid gap-2 text-sm">Nightly rate<input type="number" name="nightly_rate" defaultValue={Number(values.nightly_rate ?? 200)} className={inputClass()} /></label>
      <label className="grid gap-2 text-sm">Cleaning fee<input type="number" name="cleaning_fee" defaultValue={Number(values.cleaning_fee ?? 150)} className={inputClass()} /></label>
      <label className="grid gap-2 text-sm">Service fee<input type="number" name="service_fee" defaultValue={Number(values.service_fee ?? 0)} className={inputClass()} /></label>
      <label className="grid gap-2 text-sm">Tax rate<input type="number" step="0.0001" name="tax_rate" defaultValue={Number(values.tax_rate ?? 0)} className={inputClass()} /></label>
      <label className="grid gap-2 text-sm">Security deposit<input type="number" name="security_deposit" defaultValue={Number(values.security_deposit ?? 0)} className={inputClass()} /></label>
      <label className="grid gap-2 text-sm">Minimum nights<input type="number" name="minimum_nights" defaultValue={Number(values.minimum_nights ?? 2)} className={inputClass()} /></label>
      <label className="grid gap-2 text-sm">Bedrooms<input type="number" name="bedrooms" defaultValue={Number(values.bedrooms ?? 2)} className={inputClass()} /></label>
      <label className="grid gap-2 text-sm">Bathrooms<input type="number" step="0.5" name="bathrooms" defaultValue={Number(values.bathrooms ?? 2)} className={inputClass()} /></label>
      <label className="grid gap-2 text-sm">Beds<input type="number" name="beds" defaultValue={Number(values.beds ?? 2)} className={inputClass()} /></label>
      <label className="grid gap-2 text-sm">Max guests<input type="number" name="max_guests" defaultValue={Number(values.max_guests ?? 4)} className={inputClass()} /></label>
      <label className="grid gap-2 text-sm">Check-in<input name="check_in_time" defaultValue={String(values.check_in_time ?? "4:00 PM")} className={inputClass()} /></label>
      <label className="grid gap-2 text-sm">Check-out<input name="check_out_time" defaultValue={String(values.check_out_time ?? "10:00 AM")} className={inputClass()} /></label>
    </div>
  );
}
