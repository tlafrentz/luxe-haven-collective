import type { Property } from "@/types/database";
import { inputClass } from "./shared";

type Props = {
  values: Partial<Property> & Record<string, unknown>;
};

export function SeoSection({ values }: Props) {
  return (
    <div className="grid gap-5">
      <label className="grid gap-2 text-sm">
        SEO title
        <input name="seo_title" defaultValue={String(values.seo_title ?? "")} className={inputClass()} />
      </label>

      <label className="grid gap-2 text-sm">
        SEO description
        <textarea name="seo_description" defaultValue={String(values.seo_description ?? "")} className="input-dark min-h-28" />
      </label>
    </div>
  );
}
