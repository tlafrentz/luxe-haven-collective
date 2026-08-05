import Link from "next/link";
import { solutionLinks } from "@/lib/solution-journeys";
export function SolutionsNavigation({ active }: { active?: string }) {
  return (
    <nav aria-label="Solutions" className="overflow-x-auto border-y bg-white">
      <div className="container-shell flex min-w-max gap-7 py-4">
        {solutionLinks.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            aria-current={label === active ? "page" : undefined}
            className={
              label === active
                ? "rounded-full bg-emerald-950 px-4 py-2 text-xs font-semibold text-white"
                : "px-1 py-2 text-xs font-semibold text-stone-600 hover:text-emerald-900"
            }
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
