import Link from "next/link";
const items = [
  ["Overview", "/admin/furnishing"],
  ["Projects", "/admin/furnishing/projects"],
  ["Product Catalog", "/admin/furnishing/products"],
  ["Packages", "/admin/furnishing/packages"],
  ["Design / Style", "/admin/furnishing/styles"],
  ["Procurement", "/admin/furnishing/procurement"],
  ["Installation", "/admin/furnishing/installation"],
] as const;
export function FurnishingNavigation({ current }: { current: string }) {
  return (
    <nav aria-label="Furnishing Studio" className="overflow-x-auto border-b">
      <ul className="flex min-w-max gap-7">
        {items.map(([label, href]) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={
                current === label.toLowerCase() ? "page" : undefined
              }
              className={`block border-b-2 py-3 text-sm font-semibold ${current === label.toLowerCase() ? "border-emerald-700 text-stone-950" : "border-transparent text-stone-600"}`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
export function FurnishingHeader({
  title,
  description,
  current,
  action,
}: {
  title: string;
  description: string;
  current: string;
  action?: React.ReactNode;
}) {
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">
            Package · project · installation
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-stone-600">{description}</p>
        </div>
        {action}
      </header>
      <FurnishingNavigation current={current} />
    </>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-800">
      {value.replaceAll("_", " ")}
    </span>
  );
}
export function Money({ value }: { value: unknown }) {
  return (
    <>
      {new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(Number(value) || 0)}
    </>
  );
}
