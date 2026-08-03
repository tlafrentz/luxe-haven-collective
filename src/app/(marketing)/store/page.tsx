import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export default async function Page() {
  const db = createAdminClient(),
    { data: definitions } = await db
      .from("commerce_offer_definitions")
      .select(
        "product_id,offer_type,payment_model,commerce_products!inner(slug,name,short_description)",
      )
      .eq("catalog_status", "published");
  return (
    <main className="mx-auto max-w-7xl px-5 py-16">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">
          Luxe Haven
        </p>
        <h1 className="mt-3 text-5xl font-semibold">
          Offers built for hospitality performance.
        </h1>
        <p className="mt-4 text-stone-600">
          Products, packages, and services with a clear path to value.
        </p>
      </header>
      <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {(definitions ?? []).map((x: Record<string, unknown>) => {
          const p = x.commerce_products as Record<string, unknown>;
          return (
            <article
              key={String(x.product_id)}
              className="rounded-2xl border bg-white p-6"
            >
              <p className="text-xs font-bold uppercase text-emerald-700">
                {String(x.offer_type).replaceAll("_", " ")}
              </p>
              <h2 className="mt-2 text-xl font-semibold">{String(p.name)}</h2>
              <p className="mt-3 text-sm text-stone-600">
                {String(p.short_description)}
              </p>
              <Link
                href={`/store/${p.slug}`}
                className="mt-5 inline-flex font-semibold text-emerald-800"
              >
                View offer →
              </Link>
            </article>
          );
        })}
      </section>
      {!definitions?.length ? (
        <p className="mt-10 rounded-2xl border border-dashed p-12 text-center">
          No offers are publicly available.
        </p>
      ) : null}
    </main>
  );
}
