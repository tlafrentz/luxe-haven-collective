import type { Property } from "@/types/database";
import { inputClass } from "./shared";

type Props = {
  values: Partial<Property> & Record<string, unknown>;
};

export function PublishingSection({ values }: Props) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <label className="grid gap-2 text-sm">
        Status
        <select name="status" defaultValue={String(values.status ?? "draft")} className={inputClass()}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </select>
      </label>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
        Active properties appear on the public Luxe Haven website.
      </div>
    </div>
  );
}
