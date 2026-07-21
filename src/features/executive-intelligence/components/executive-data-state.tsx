import Link from "next/link";
import { CircleDashed } from "lucide-react";

type ExecutiveUnavailableStateProps = Readonly<{ title: string; description: string; href?: string; linkLabel?: string }>;

export function ExecutiveUnavailableState({ title, description, href, linkLabel }: ExecutiveUnavailableStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5">
      <CircleDashed className="h-5 w-5 text-stone-400" />
      <p className="mt-3 text-sm font-semibold text-stone-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-stone-600">{description}</p>
      {href && linkLabel ? <Link href={href} className="mt-3 inline-flex text-xs font-semibold text-stone-950 hover:text-amber-700">{linkLabel}</Link> : null}
    </div>
  );
}

export function ExecutiveEmptyState({ children }: Readonly<{ children: string }>) {
  return <p className="rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-700">{children}</p>;
}
