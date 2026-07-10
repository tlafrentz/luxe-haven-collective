import type { Property } from "@/types/database";
import type { PropertyFormState } from "../types";
import { FieldError, inputClass } from "./shared";

type Props = {
  values: Partial<Property> & Record<string, unknown>;
  state: PropertyFormState;
};

export function OverviewSection({ values, state }: Props) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <label className="grid gap-2 text-sm">
        Name
        <input name="name" defaultValue={String(values.name ?? "")} className={inputClass()} />
        <FieldError message={state.errors?.name} />
      </label>

      <label className="grid gap-2 text-sm">
        Slug
        <input name="slug" defaultValue={String(values.slug ?? "")} className={inputClass()} />
        <FieldError message={state.errors?.slug} />
      </label>

      <label className="grid gap-2 text-sm md:col-span-2">
        Headline
        <input name="headline" defaultValue={String(values.headline ?? "")} className={inputClass()} />
      </label>

      <label className="grid gap-2 text-sm md:col-span-2">
        Short description
        <textarea name="short_description" defaultValue={String(values.short_description ?? "")} className="input-dark min-h-24" />
      </label>

      <label className="grid gap-2 text-sm md:col-span-2">
        Full description
        <textarea name="description" defaultValue={String(values.description ?? "")} className="input-dark min-h-44" />
        <FieldError message={state.errors?.description} />
      </label>

      <label className="grid gap-2 text-sm">
        Property type
        <input name="property_type" defaultValue={String(values.property_type ?? "home")} className={inputClass()} />
      </label>

      <label className="grid gap-2 text-sm">
        Featured listing
        <select name="is_featured" defaultValue={String(values.is_featured ?? false)} className={inputClass()}>
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </label>
    </div>
  );
}
