import Link from "next/link";

const items = [
  ["Overview", "/dashboard/furnishing"],
  ["Projects", "/dashboard/furnishing/projects"],
  ["Packages", "/dashboard/furnishing/packages"],
  ["Procurement", "/dashboard/furnishing/procurement"],
  ["Installation", "/dashboard/furnishing/installation"],
  ["Analytics", "/dashboard/furnishing/analytics"],
  ["Settings", "/dashboard/furnishing/settings"],
] as const;

export function CustomerFurnishingNavigation({ current }: { current: string }) {
  return (
    <nav
      aria-label="Furnishing Studio"
      className="overflow-x-auto border-b border-[#ddd6ca]"
    >
      <ul className="flex min-w-max gap-7">
        {items.map(([label, href]) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={
                current === label.toLowerCase() ? "page" : undefined
              }
              className={`block border-b-2 py-3 text-sm font-semibold ${current === label.toLowerCase() ? "border-[#17483b] text-[#17483b]" : "border-transparent text-stone-500 hover:text-stone-900"}`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
