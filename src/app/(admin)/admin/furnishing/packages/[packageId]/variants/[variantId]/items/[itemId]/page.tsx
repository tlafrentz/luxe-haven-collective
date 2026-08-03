import Link from "next/link";
import { notFound } from "next/navigation";
import { getFurnishingStudio } from "@/app/actions/furnishing-studio";
import {
  FurnishingHeader,
  Money,
} from "@/components/furnishing/furnishing-navigation";
import { sanitizeAffiliateUrl } from "@/features/furnishing-studio";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ packageId: string; variantId: string; itemId: string }>;
}) {
  const { packageId, variantId, itemId } = await params,
    data = await getFurnishingStudio(),
    pkg = data.packages.find(
      (x: Record<string, unknown>) => x.id === packageId,
    ) as Record<string, unknown> | undefined,
    item = data.items.find((x: Record<string, unknown>) => x.id === itemId) as
      | Record<string, unknown>
      | undefined,
    room = data.rooms.find(
      (x: Record<string, unknown>) => x.id === item?.room_id,
    ) as Record<string, unknown> | undefined;
  if (!pkg || !item) notFound();
  const products = data.products.filter(
    (x: Record<string, unknown>) => x.item_id === itemId,
  );
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title={String(item.name)}
        description={`${String(room?.name ?? "Room")} · ${String(item.category)} · ${item.required ? "Required" : "Optional"}`}
        current="packages"
      />
      <nav className="text-sm">
        <Link href="/admin/furnishing/packages">Packages</Link> ›{" "}
        <Link
          href={`/admin/furnishing/packages/${packageId}/variants/${variantId}`}
        >
          {String(pkg.name)}
        </Link>{" "}
        › {String(item.name)}
      </nav>
      <div className="grid gap-6 lg:grid-cols-[.7fr_1.3fr]">
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold">Item definition</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-stone-500">Recommended quantity</dt>
              <dd className="font-semibold">{String(item.quantity)}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Hospitality notes</dt>
              <dd className="font-semibold">
                {String(
                  item.notes ||
                    "Select durable, cleanable products suitable for repeated guest use.",
                )}
              </dd>
            </div>
          </dl>
        </section>
        <section>
          <h2 className="text-xl font-semibold">
            Product options and alternatives
          </h2>
          <div className="mt-4 space-y-4">
            {products.length ? (
              products.map((p: Record<string, unknown>) => {
                const href = sanitizeAffiliateUrl(
                  String(p.affiliate_url ?? p.product_url ?? ""),
                );
                return (
                  <article
                    key={String(p.id)}
                    className="rounded-2xl border bg-white p-5"
                  >
                    <div className="flex flex-wrap justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase text-stone-500">
                          {String(p.vendor)}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold">
                          {String(p.product_name)}
                        </h3>
                        <p className="mt-2 text-sm capitalize text-stone-500">
                          {String(p.availability)} · Last verified{" "}
                          {p.last_verified_at
                            ? new Date(
                                String(p.last_verified_at),
                              ).toLocaleDateString()
                            : "not verified"}
                        </p>
                      </div>
                      <p className="text-2xl font-semibold">
                        <Money value={p.current_price} />
                      </p>
                    </div>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="mt-5 inline-flex rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
                        aria-label={`Open external purchase page for ${String(p.product_name)}`}
                      >
                        Purchase from {String(p.vendor)} ↗
                      </a>
                    ) : null}
                    {p.commission_disclosure_required ? (
                      <p className="mt-3 text-xs text-stone-500">
                        Luxe Haven may earn a commission from qualifying
                        purchases.
                      </p>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <section className="rounded-2xl border border-dashed bg-white p-10 text-center text-stone-500">
                No product selected and no alternatives available.
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
