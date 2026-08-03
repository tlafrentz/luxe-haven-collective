import Link from "next/link";
const items = [
  ["Overview", "/admin/offers"],
  ["Offers", "/admin/offers/catalog"],
  ["Bundles", "/admin/offers/bundles"],
  ["Pricing", "/admin/offers/pricing"],
  ["Add-ons", "/admin/offers/add-ons"],
  ["Checkout", "/admin/offers/checkout"],
  ["Activation", "/admin/offers/activation"],
  ["Orders", "/admin/offers/orders"],
  ["Settings", "/admin/offers/settings"],
] as const;
export function OfferNavigation({ current }: { current: string }) {
  return (
    <nav aria-label="Offer Catalog" className="overflow-x-auto border-b">
      <ul className="flex min-w-max gap-7">
        {items.map(([label, href]) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={
                current === label.toLowerCase() ? "page" : undefined
              }
              className={`block border-b-2 py-3 text-sm font-semibold ${current === label.toLowerCase() ? "border-emerald-700" : "border-transparent text-stone-600"}`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
export function OfferHeader({
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
            Commercial control plane
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-stone-600">{description}</p>
        </div>
        {action}
      </header>
      <OfferNavigation current={current} />
    </>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-800">
      {value.replaceAll("_", " ").replaceAll("-", " ")}
    </span>
  );
}
export function Money({
  minor,
  currency = "USD",
}: {
  minor: unknown;
  currency?: string;
}) {
  return (
    <>
      {new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format((Number(minor) || 0) / 100)}
    </>
  );
}
