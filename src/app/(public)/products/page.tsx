import Link from "next/link";
import { getCommerceCatalog, defaultCommerceCatalog } from "@/platform/commerce";
export default async function ProductsPage() {
  const catalog = await getCommerceCatalog(defaultCommerceCatalog);
  return <main className="mx-auto max-w-6xl px-5 py-16"><p className="eyebrow">Luxe Haven Commerce</p><h1 className="mt-3 font-serif text-5xl">Products and services</h1><p className="mt-4 max-w-2xl text-stone-600">Canonical offerings with clear eligibility, fulfillment, and entitlement behavior.</p><div className="mt-10 grid gap-6 md:grid-cols-2">{catalog.products.map(({ id, name, shortDescription, slug, prices }) => <article key={id} className="rounded-3xl border border-stone-200 p-7"><h2 className="text-2xl font-semibold">{name}</h2><p className="mt-3 text-stone-600">{shortDescription}</p><p className="mt-6 font-semibold">{prices[0]?.type === "custom-quote" ? "Custom quote" : prices[0]?.amount.format() ?? "Pricing unavailable"}</p><Link className="mt-6 inline-flex font-semibold underline" href={`/products/${slug}`}>View product</Link></article>)}</div></main>;
}
