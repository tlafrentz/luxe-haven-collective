import type {
  ActionStatus,
} from "@/features/execution-engine";

type ActionStatusBadgeProps = {
  status: ActionStatus;
};

const statusLabels: Record<
  ActionStatus,
  string
> = {
  proposed: "Proposed",
  accepted: "Accepted",
  scheduled: "Scheduled",
  "in-progress": "In progress",
  blocked: "Blocked",
  completed: "Completed",
  measured: "Measured",
  archived: "Archived",
};

const statusClasses: Record<
  ActionStatus,
  string
> = {
  proposed:
    "border-stone-200 bg-stone-50 text-stone-600",
  accepted:
    "border-amber-200 bg-amber-50 text-amber-800",
  scheduled:
    "border-sky-200 bg-sky-50 text-sky-700",
  "in-progress":
    "border-stone-300 bg-stone-950 text-white",
  blocked:
    "border-rose-200 bg-rose-50 text-rose-700",
  completed:
    "border-emerald-200 bg-emerald-50 text-emerald-700",
  measured:
    "border-violet-200 bg-violet-50 text-violet-700",
  archived:
    "border-stone-200 bg-stone-100 text-stone-500",
};

export function ActionStatusBadge({
  status,
}: ActionStatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
        statusClasses[status],
      ].join(" ")}
    >
      {statusLabels[status]}
    </span>
  );
}
