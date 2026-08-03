import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createActivationRunAction,
  getOfferCatalog,
} from "@/app/actions/offer-catalog";
import {
  Money,
  OfferHeader,
  Status,
} from "@/components/offers/offer-navigation";
export const dynamic = "force-dynamic";
type Row = Record<string, unknown>;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { orderId } = await params,
    tab = (await searchParams).tab ?? "overview",
    data = await getOfferCatalog(),
    o = data.orders.find((x: Row) => x.id === orderId) as Row | undefined;
  if (!o) notFound();
  const lines = (o.commerce_order_lines as Row[]) ?? [],
    product = (lines[0]?.product_snapshot ?? {}) as Row,
    prices = lines.map((x) => x.price_snapshot),
    payments = data.payments.filter((x: Row) => x.order_id === orderId),
    fulfillments = data.fulfillments.filter((x: Row) => x.order_id === orderId),
    entitlements = data.entitlements.filter((x: Row) => x.order_id === orderId),
    runs = data.activationRuns.filter((x: Row) => x.order_id === orderId),
    runIds = runs.map((x: Row) => x.id),
    stepRuns = data.activationStepRuns.filter((x: Row) =>
      runIds.includes(x.run_id),
    ),
    tabs = [
      "overview",
      "payment",
      "activation",
      "fulfillment",
      "entitlements",
      "customer",
      "activity",
    ];
  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-5 py-8">
      <OfferHeader
        title={String(o.order_number)}
        description={`${String(product.name ?? "Purchased offer")} · immutable commercial snapshot`}
        current="orders"
      />
      <nav className="text-sm">
        <Link href="/admin/offers/orders">Orders</Link> ›{" "}
        {String(o.order_number)}
      </nav>
      <section className="grid gap-4 sm:grid-cols-4">
        <Card l="Amount">
          <Money
            minor={o.finalized_total_minor ?? o.total_minor}
            currency={String(o.currency)}
          />
        </Card>
        <Card l="Payment">
          <Status value={String(o.payment_status ?? o.status)} />
        </Card>
        <Card l="Activation">
          <Status value={String(o.activation_status)} />
        </Card>
        <Card l="Fulfillment">
          <Status value={String(o.fulfillment_status)} />
        </Card>
      </section>
      <nav className="flex flex-wrap gap-6 border-b">
        {tabs.map((x) => (
          <Link
            key={x}
            href={`?tab=${x}`}
            className={`border-b-2 py-3 text-sm font-semibold capitalize ${tab === x ? "border-emerald-700" : "border-transparent"}`}
          >
            {x}
          </Link>
        ))}
      </nav>
      {tab === "overview" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Purchased snapshot">
            <D l="Offer" v={String(product.name ?? "—")} />
            <D l="Variant" v={String(product.variantName ?? "Default")} />
            <D
              l="Description"
              v={String(product.shortDescription ?? product.description ?? "—")}
            />
            <D l="Price" v={JSON.stringify(prices[0] ?? {})} />
          </Panel>
          <Panel title="Next actions">
            <D
              l="Customer"
              v={String(o.customer_next_action ?? "No customer action")}
            />
            <D
              l="Internal"
              v={String(o.internal_next_action ?? "Review activation")}
            />
            <D l="Owner" v={String(o.internal_owner ?? "Unassigned")} />
          </Panel>
        </div>
      ) : null}
      {tab === "payment" ? (
        <Grid
          title="Payment history"
          rows={payments}
          fields={[
            "status",
            "amount_minor",
            "captured_amount_minor",
            "refunded_amount_minor",
            "created_at",
          ]}
        />
      ) : null}
      {tab === "activation" ? (
        <>
          <Grid
            title="Activation runs"
            rows={runs}
            fields={[
              "status",
              "current_step",
              "failure_code",
              "started_at",
              "completed_at",
            ]}
          />
          <Grid
            title="Activation steps"
            rows={stepRuns}
            fields={[
              "status",
              "attempts",
              "assigned_owner",
              "due_at",
              "target_type",
              "target_id",
              "failure_code",
            ]}
          />
          {product.id ? (
            <form action={createActivationRunAction}>
              <input type="hidden" name="orderId" value={orderId} />
              <input
                type="hidden"
                name="productId"
                value={String(product.id)}
              />
              <button className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white">
                Start or retry activation
              </button>
            </form>
          ) : null}
        </>
      ) : null}
      {tab === "fulfillment" ? (
        <Grid
          title="Specialist fulfillment"
          rows={fulfillments}
          fields={[
            "status",
            "target_type",
            "target_id",
            "failure_code",
            "created_at",
            "completed_at",
          ]}
        />
      ) : null}
      {tab === "entitlements" ? (
        <Grid
          title="Granted access"
          rows={entitlements}
          fields={[
            "entitlement_key",
            "status",
            "effective_from",
            "effective_until",
          ]}
        />
      ) : null}
      {tab === "customer" ? (
        <Panel title="Customer">
          <D
            l="Email"
            v={String((o.commerce_customers as Row)?.email ?? "Restricted")}
          />
          <p className="text-sm text-stone-500">
            Detailed intake remains in the specialist workspace and is not
            copied into Commerce.
          </p>
        </Panel>
      ) : null}
      {tab === "activity" ? (
        <Panel title="Immutable timeline">
          <p className="text-sm text-stone-600">
            Payment, activation, entitlement, and fulfillment records above
            retain their own timestamps and lineage.
          </p>
        </Panel>
      ) : null}
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
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function D({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-stone-500">{l}</p>
      <p className="mt-1">{v}</p>
    </div>
  );
}
function Grid({
  title,
  rows,
  fields,
}: {
  title: string;
  rows: Row[];
  fields: string[];
}) {
  return (
    <section className="mb-5 overflow-x-auto rounded-2xl border bg-white">
      <table className="w-full min-w-[700px] text-left text-sm">
        <caption className="p-5 text-left text-xl font-semibold">
          {title}
        </caption>
        <thead>
          <tr>
            {fields.map((x) => (
              <th key={x} className="p-4 capitalize">
                {x.replaceAll("_", " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((x, i) => (
              <tr key={String(x.id ?? i)} className="border-t">
                {fields.map((f) => (
                  <td key={f} className="p-4">
                    {f.includes("amount") ? (
                      <Money minor={x[f]} />
                    ) : (
                      String(x[f] ?? "—")
                    )}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={fields.length}
                className="p-10 text-center text-stone-500"
              >
                No records.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
