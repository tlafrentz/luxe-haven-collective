import type { PropertyStatus } from "@/types/database";

const styles: Record<PropertyStatus, string> = {
  draft: "border-white/10 bg-white/5 text-white/60",
  active: "border-emerald-300/20 bg-emerald-500/10 text-emerald-200",
  paused: "border-amber-300/20 bg-amber-500/10 text-amber-200",
  archived: "border-red-300/20 bg-red-500/10 text-red-200",
};

export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
        styles[status] ?? styles.draft
      }`}
    >
      {status}
    </span>
  );
}
