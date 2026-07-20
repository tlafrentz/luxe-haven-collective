import type { ActionCenterPriority as ActionPriority } from "../domain";

type ActionPriorityBadgeProps = {
  priority: ActionPriority;
};

const priorityClasses: Record<
  ActionPriority,
  string
> = {
  critical:
    "border-amber-500 bg-amber-500 text-stone-950",
  high:
    "border-amber-300 bg-white text-amber-800",
  medium:
    "border-stone-300 bg-white text-stone-600",
  low:
    "border-stone-200 bg-stone-50 text-stone-500",
};

export function ActionPriorityBadge({
  priority,
}: ActionPriorityBadgeProps) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
        priorityClasses[priority],
      ].join(" ")}
    >
      {priority}
    </span>
  );
}
