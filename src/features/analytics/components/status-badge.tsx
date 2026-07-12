type StatusBadgeProps = {
  value: string;
  type?: "booking" | "payment";
};

const bookingStyles: Record<string, string> = {
  confirmed:
    "bg-blue-50 text-blue-700 ring-blue-600/20",
  completed:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelled:
    "bg-red-50 text-red-700 ring-red-600/20",
  pending:
    "bg-amber-50 text-amber-700 ring-amber-600/20",
};

const paymentStyles: Record<string, string> = {
  paid:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  authorized:
    "bg-blue-50 text-blue-700 ring-blue-600/20",
  unpaid:
    "bg-amber-50 text-amber-700 ring-amber-600/20",
  refunded:
    "bg-purple-50 text-purple-700 ring-purple-600/20",
  failed:
    "bg-red-50 text-red-700 ring-red-600/20",
};

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StatusBadge({
  value,
  type = "booking",
}: StatusBadgeProps) {
  const styles =
    type === "payment"
      ? paymentStyles[value]
      : bookingStyles[value];

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        styles ??
        "bg-neutral-50 text-neutral-700 ring-neutral-600/20"
      }`}
    >
      {formatLabel(value)}
    </span>
  );
}
