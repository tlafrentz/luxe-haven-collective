import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params,
    preview = (await searchParams).preview === "1",
    db = createAdminClient(),
    { data: p } = await db
      .from("commerce_products")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
  if (!p) notFound();
  const [
    { data: d },
    { data: variants },
    { data: deliverables },
    { data: prices },
  ] = await Promise.all([
    db
      .from("commerce_offer_definitions")
      .select("*")
      .eq("product_id", p.id)
      .maybeSingle(),
    db
      .from("commerce_offer_variants")
      .select("*")
      .eq("product_id", p.id)
      .eq("status", "published"),
    db
      .from("commerce_offer_deliverables")
      .select("*")
      .eq("product_id", p.id)
      .order("sort_order"),
    db
      .from("commerce_prices")
      .select("*")
      .eq("product_id", p.id)
      .eq("status", "active")
      .order("version", { ascending: false }),
  ]);
  if (!preview && d?.catalog_status !== "published") notFound();
  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      {preview ? (
        <p
          role="status"
          className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 font-semibold"
        >
          Preview mode · Not publicly visible · No live order will be created
        </p>
      ) : null}
      <Link href="/store" className="text-sm font-semibold">
        ← Store
      </Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
        <section>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">
            {String(d?.offer_type ?? p.product_type).replaceAll("_", " ")}
          </p>
          <h1 className="mt-3 text-5xl font-semibold">{p.name}</h1>
          <p className="mt-5 text-lg text-stone-600">{p.long_description}</p>
          <h2 className="mt-10 text-2xl font-semibold">What is included</h2>
          <ul className="mt-4 space-y-3">
            {(deliverables ?? []).map((x) => (
              <li key={x.id} className="rounded-xl border p-4">
                <strong>{x.name}</strong>
                <span className="block text-sm text-stone-500">
                  {x.description}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <aside className="rounded-2xl border bg-white p-6">
          <p className="text-sm text-stone-500">Starting at</p>
          <p className="mt-2 text-4xl font-semibold">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: prices?.[0]?.currency ?? "USD",
            }).format(Number(prices?.[0]?.amount_minor ?? 0) / 100)}
          </p>
          {variants?.length ? (
            <select
              aria-label="Offer variant"
              className="mt-5 w-full rounded-xl border px-3 py-3"
            >
              {variants.map((x) => (
                <option key={x.id}>{x.name}</option>
              ))}
            </select>
          ) : null}
          <button
            disabled={preview}
            className="mt-5 w-full rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {preview ? "Checkout disabled in preview" : "Continue to checkout"}
          </button>
          <p className="mt-4 text-sm text-stone-500">
            Next:{" "}
            {String(
              d?.expected_time_to_value ??
                "Activation instructions follow purchase.",
            )}
          </p>
        </aside>
      </div>
    </main>
  );
}
