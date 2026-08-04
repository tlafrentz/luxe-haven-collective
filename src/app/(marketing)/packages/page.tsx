import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Packages | Luxe Haven Collective",
  description:
    "Browse published Luxe Haven guidebook, furnishing, investment, revenue, launch, and platform offers.",
};

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category = "", q = "" } = await searchParams;
  const db = createAdminClient();
  const [{ data: definitions }, { data: prices }] = await Promise.all([
    db
      .from("commerce_offer_definitions")
      .select(
        "product_id,offer_type,payment_model,fulfillment_model,expected_time_to_value,commerce_products!inner(slug,name,short_description,category_id)",
      )
      .eq("catalog_status", "published"),
    db
      .from("commerce_prices")
      .select("product_id,amount_minor,currency,status")
      .eq("status", "active"),
  ]);
  const offers = (definitions ?? []).filter((row: Record<string, unknown>) => {
    const product = row.commerce_products as Record<string, unknown>;
    const matchesCategory =
      !category ||
      String(product.category_id ?? row.offer_type)
        .toLowerCase()
        .includes(category.toLowerCase());
    const haystack =
      `${product.name ?? ""} ${product.short_description ?? ""}`.toLowerCase();
    return matchesCategory && (!q || haystack.includes(q.toLowerCase()));
  });
  return (
    <main>
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <p className="text-sm font-bold uppercase tracking-[.24em] text-[#9a6d0b]">
            Luxe Haven packages
          </p>
          <h1 className="mt-4 font-serif text-5xl md:text-7xl">
            Choose a clear path to value.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5f6963]">
            Every published offer connects checkout to a defined entitlement,
            activation journey, and specialist workspace.
          </p>
          <form className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-[1fr_220px_auto]">
            <input
              name="q"
              defaultValue={q}
              aria-label="Search packages"
              placeholder="Search packages"
              className="min-h-12 rounded-md border bg-white px-4"
            />
            <select
              name="category"
              defaultValue={category}
              aria-label="Package category"
              className="min-h-12 rounded-md border bg-white px-4"
            >
              <option value="">All categories</option>
              <option value="guidebook">Guidebooks</option>
              <option value="furnishing">Furnishing</option>
              <option value="property-launch">Property launch</option>
              <option value="revenue">Revenue</option>
              <option value="investment">Investment</option>
              <option value="platform">Platform</option>
            </select>
            <button className="min-h-12 rounded-md bg-[#074e38] px-6 font-semibold text-white">
              Filter
            </button>
          </form>
        </div>
      </section>
      <section className="bg-[#f9faf8] py-16">
        <div className="container-shell">
          {offers.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {offers.map((row: Record<string, unknown>) => {
                const product = row.commerce_products as Record<
                  string,
                  unknown
                >;
                const activePrice = (prices ?? []).find(
                  (price) => price.product_id === row.product_id,
                );
                const price = activePrice
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: String(activePrice.currency ?? "USD"),
                      maximumFractionDigits: 0,
                    }).format(Number(activePrice.amount_minor ?? 0) / 100)
                  : "Contact us";
                return (
                  <article
                    key={String(row.product_id)}
                    className="flex flex-col rounded-[2rem] border border-[#dce2dd] bg-white p-7"
                  >
                    <p className="text-xs font-bold uppercase tracking-[.18em] text-[#087251]">
                      {String(row.offer_type).replaceAll("_", " ")}
                    </p>
                    <h2 className="mt-4 font-serif text-3xl">
                      {String(product.name)}
                    </h2>
                    <p className="mt-4 flex-1 leading-7 text-[#5f6963]">
                      {String(product.short_description ?? "")}
                    </p>
                    <div className="mt-6 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[.15em] text-[#737c76]">
                          Starting at
                        </p>
                        <p className="mt-1 text-xl font-bold">{price}</p>
                      </div>
                      <Link
                        href={`/packages/${product.slug}`}
                        className="rounded-md bg-[#074e38] px-5 py-3 text-sm font-semibold text-white"
                      >
                        View package
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed bg-white p-12 text-center">
              <h2 className="font-serif text-3xl">
                No matching published offers.
              </h2>
              <p className="mt-3 text-[#5f6963]">
                Try another category or clear the search.
              </p>
              <Link
                href="/packages"
                className="mt-5 inline-flex font-semibold text-[#074e38]"
              >
                Clear filters
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
