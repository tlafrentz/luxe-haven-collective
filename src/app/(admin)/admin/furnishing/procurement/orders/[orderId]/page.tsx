import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getFurnishingStudio,
  updateOrderStatusAction,
} from "@/app/actions/furnishing-studio";
import {
  Badge,
  FurnishingHeader,
  Money,
} from "@/components/furnishing/furnishing-navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params,
    data = await getFurnishingStudio(),
    order = data.orders.find(
      (x: Record<string, unknown>) => x.id === orderId,
    ) as Record<string, unknown> | undefined;
  if (!order) notFound();
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title={String(order.po_number)}
        description={`${String(order.vendor)} purchase order`}
        current="procurement"
      />
      <nav className="text-sm">
        <Link href="/admin/furnishing">Furnishing Studio</Link> ›{" "}
        <Link href="/admin/furnishing/procurement">Procurement</Link> ›{" "}
        {String(order.po_number)}
      </nav>
      <section className="grid gap-4 sm:grid-cols-3">
        <Card l="Total">
          <Money value={order.total} />
        </Card>
        <Card l="Status">
          <Badge value={String(order.status)} />
        </Card>
        <Card l="Expected">
          {String(order.estimated_delivery ?? "Not set")}
        </Card>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Order record</h2>
        <dl className="mt-5 grid gap-5 md:grid-cols-2">
          <D
            l="Project"
            v={String(
              (order.furnishing_projects as Record<string, unknown>)?.name ??
                "—",
            )}
          />
          <D l="Tracking" v={String(order.tracking_number ?? "Not recorded")} />
          <D l="Receipt" v={String(order.receipt_url ?? "Missing receipt")} />
          <D l="Notes" v={String(order.notes ?? "No notes")} />
        </dl>
        <form action={updateOrderStatusAction} className="mt-6 flex gap-3">
          <input type="hidden" name="orderId" value={orderId} />
          <select
            name="status"
            defaultValue={String(order.status)}
            className="rounded-xl border px-3 py-2"
          >
            {[
              "draft",
              "ready_to_order",
              "ordered",
              "partially_fulfilled",
              "shipped",
              "delivered",
              "cancelled",
              "returned",
              "refunded",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <button className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
            Record status
          </button>
        </form>
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
function D({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase text-stone-500">{l}</dt>
      <dd className="mt-1 font-semibold">{v}</dd>
    </div>
  );
}
