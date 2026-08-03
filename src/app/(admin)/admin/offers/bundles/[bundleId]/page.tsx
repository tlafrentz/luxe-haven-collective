import Link from "next/link";
import { notFound } from "next/navigation";
import { getOfferCatalog } from "@/app/actions/offer-catalog";
import {
  Money,
  OfferHeader,
  Status,
} from "@/components/offers/offer-navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ bundleId: string }>;
}) {
  const { bundleId } = await params,
    data = await getOfferCatalog(),
    b = data.bundles.find((x: Record<string, unknown>) => x.id === bundleId) as
      | Record<string, unknown>
      | undefined;
  if (!b) notFound();
  const items = data.bundleItems.filter(
    (x: Record<string, unknown>) => x.bundle_id === bundleId,
  );
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <OfferHeader
        title={String(b.name)}
        description={String(b.description)}
        current="bundles"
      />
      <nav className="text-sm">
        <Link href="/admin/offers/bundles">Bundles</Link> › {String(b.name)}
      </nav>
      <section className="grid gap-4 sm:grid-cols-3">
        <Card l="Bundle price">
          <Money minor={b.amount_minor} />
        </Card>
        <Card l="Included offers">{items.length}</Card>
        <Card l="Status">
          <Status value={String(b.status)} />
        </Card>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Activation order</h2>
        <ol className="mt-4 space-y-3">
          {items
            .sort(
              (a: Record<string, unknown>, c: Record<string, unknown>) =>
                Number(a.activation_order) - Number(c.activation_order),
            )
            .map((x: Record<string, unknown>) => {
              const p = data.products.find(
                (p: Record<string, unknown>) => p.id === x.product_id,
              ) as Record<string, unknown> | undefined;
              return (
                <li key={String(x.id)} className="rounded-xl bg-stone-50 p-4">
                  <strong>
                    {String(x.activation_order)}.{" "}
                    {String(p?.name ?? x.product_id)}
                  </strong>
                  <p className="text-sm text-stone-500">
                    Retains independent entitlement and fulfillment
                    requirements.
                  </p>
                </li>
              );
            })}
        </ol>
      </section>
    </main>
  );
}
function Card({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border bg-white p-5">
      <p className="text-xs font-bold uppercase text-stone-500">{l}</p>
      <p className="mt-3 text-xl font-semibold">{children}</p>
    </article>
  );
}
