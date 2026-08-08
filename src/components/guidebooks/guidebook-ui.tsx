import type { ReactNode } from "react";

export function GuidebookPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}>) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-3xl text-stone-600">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function GuidebookMetricCard({
  label,
  value,
  note,
}: Readonly<{ label: string; value: ReactNode; note?: ReactNode }>) {
  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-stone-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      {note ? <p className="mt-2 text-xs text-stone-500">{note}</p> : null}
    </article>
  );
}

export function GuidebookStatusBadge({ value }: Readonly<{ value: string }>) {
  const tone = value === "published" || value === "ready"
    ? "bg-emerald-50 text-emerald-800"
    : value === "archived"
      ? "bg-stone-100 text-stone-600"
      : value.includes("fail") || value.includes("error")
        ? "bg-rose-50 text-rose-800"
        : "bg-amber-50 text-amber-900";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone}`}>
      {value.replaceAll("-", " ")}
    </span>
  );
}
