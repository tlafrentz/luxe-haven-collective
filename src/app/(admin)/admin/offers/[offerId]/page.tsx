import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createOfferDeliverableAction,
  createOfferVariantAction,
  getOfferCatalog,
  updateOfferStatusAction,
} from "@/app/actions/offer-catalog";
import {
  Money,
  OfferHeader,
  Status,
} from "@/components/offers/offer-navigation";
import { offerReadiness, OFFER_STATUSES } from "@/features/offer-catalog";
export const dynamic = "force-dynamic";
type Row = Record<string, unknown>;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ offerId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { offerId } = await params,
    tab = (await searchParams).tab ?? "overview",
    data = await getOfferCatalog(),
    p = data.products.find((x: Row) => x.id === offerId) as Row | undefined,
    d = data.definitions.find((x: Row) => x.product_id === offerId) as
      | Row
      | undefined;
  if (!p || !d) notFound();
  const variants = data.variants.filter((x: Row) => x.product_id === offerId),
    deliverables = data.deliverables.filter(
      (x: Row) => x.product_id === offerId,
    ),
    prices = data.prices.filter((x: Row) => x.product_id === offerId),
    flow = data.activationFlows.find((x: Row) => x.product_id === offerId) as
      | Row
      | undefined,
    steps = data.activationSteps.filter((x: Row) => x.flow_id === flow?.id),
    orders = data.orders.filter((x: Row) =>
      ((x.commerce_order_lines as Row[] | undefined) ?? []).some(
        (l) => (l.product_snapshot as Row)?.id === offerId,
      ),
    ),
    readiness = offerReadiness({
      name: String(p.name),
      slug: String(p.slug),
      offerType: String(d.offer_type),
      fulfillmentModel: String(d.fulfillment_model),
      paymentModel: String(d.payment_model),
      activationSteps: steps.length,
      priceCount: prices.length,
    }),
    tabs = [
      "overview",
      "variants",
      "deliverables",
      "pricing",
      "add-ons",
      "checkout",
      "activation",
      "settings",
      "analytics",
      "activity",
    ];
  return (
    <main className="mx-auto max-w-[1500px] space-y-6 px-5 py-8">
      <OfferHeader
        title={String(p.name)}
        description={String(p.short_description)}
        current="offers"
        action={
          <div className="flex gap-2">
            <Link
              href={`/store/${p.slug}?preview=1`}
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
            >
              Preview storefront
            </Link>
            <Status value={String(d.catalog_status)} />
          </div>
        }
      />
      <nav className="text-sm">
        <Link href="/admin/offers">Offers</Link> › {String(p.name)}
      </nav>
      <nav className="overflow-x-auto border-b">
        <div className="flex min-w-max gap-6">
          {tabs.map((x) => (
            <Link
              key={x}
              href={`?tab=${x}`}
              className={`border-b-2 py-3 text-sm font-semibold capitalize ${tab === x ? "border-emerald-700" : "border-transparent text-stone-500"}`}
            >
              {x}
            </Link>
          ))}
        </div>
      </nav>
      {tab === "overview" ? (
        <>
          <section className="grid gap-4 sm:grid-cols-4">
            <Card l="Price">
              {prices[0] ? (
                <Money minor={(prices[0] as Row).amount_minor} />
              ) : (
                "Missing"
              )}
            </Card>
            <Card l="Purchases">{orders.length}</Card>
            <Card l="Variants">{variants.length}</Card>
            <Card l="Deliverables">{deliverables.length}</Card>
          </section>
          <div className="grid gap-6 lg:grid-cols-[1fr_.7fr]">
            <Panel title="Commercial definition">
              <D l="Offer type" v={String(d.offer_type)} />
              <D l="Payment model" v={String(d.payment_model)} />
              <D l="Fulfillment model" v={String(d.fulfillment_model)} />
              <D
                l="Specialist workspace"
                v={String(d.specialist_workspace ?? "Not required")}
              />
            </Panel>
            <Panel title="Publishing readiness">
              <p
                className={`font-semibold ${readiness.ready ? "text-emerald-700" : "text-amber-700"}`}
              >
                {readiness.ready
                  ? "Ready to publish"
                  : `Missing: ${readiness.missing.join(", ")}`}
              </p>
              <form
                action={updateOfferStatusAction}
                className="mt-5 flex gap-2"
              >
                <input type="hidden" name="productId" value={offerId} />
                <select
                  name="status"
                  defaultValue={String(d.catalog_status)}
                  className="rounded-xl border px-3 py-2"
                >
                  {OFFER_STATUSES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <button className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
                  Record status
                </button>
              </form>
            </Panel>
          </div>
        </>
      ) : null}
      {tab === "variants" ? (
        <>
          <Panel title="New variant">
            <form
              action={createOfferVariantAction}
              className="grid gap-3 md:grid-cols-5"
            >
              <input type="hidden" name="productId" value={offerId} />
              <input
                name="name"
                required
                placeholder="Variant name"
                className="rounded-xl border px-3 py-2"
              />
              <input
                name="sku"
                required
                placeholder="SKU"
                className="rounded-xl border px-3 py-2"
              />
              <input
                name="description"
                placeholder="Description"
                className="rounded-xl border px-3 py-2"
              />
              <input
                name="price"
                type="number"
                min="0"
                step=".01"
                placeholder="Price override"
                className="rounded-xl border px-3 py-2"
              />
              <button className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
                Add variant
              </button>
            </form>
          </Panel>
          <Grid
            title="Offer variants"
            rows={variants}
            fields={[
              "name",
              "sku",
              "price_override_minor",
              "availability",
              "status",
            ]}
          />
        </>
      ) : null}
      {tab === "deliverables" ? (
        <>
          <Panel title="New deliverable">
            <form
              action={createOfferDeliverableAction}
              className="grid gap-3 md:grid-cols-6"
            >
              <input type="hidden" name="productId" value={offerId} />
              <input
                name="name"
                required
                placeholder="Deliverable"
                className="rounded-xl border px-3 py-2"
              />
              <input
                name="description"
                placeholder="Description"
                className="rounded-xl border px-3 py-2"
              />
              <input
                name="quantity"
                type="number"
                min="1"
                defaultValue="1"
                className="rounded-xl border px-3 py-2"
              />
              <input
                name="method"
                placeholder="Delivery method"
                className="rounded-xl border px-3 py-2"
              />
              <input
                name="timing"
                placeholder="Expected timing"
                className="rounded-xl border px-3 py-2"
              />
              <button className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
                Add
              </button>
            </form>
          </Panel>
          <Grid
            title="Deliverables"
            rows={deliverables}
            fields={[
              "name",
              "quantity",
              "delivery_method",
              "required",
              "fulfilled_by",
              "expected_timing",
            ]}
          />
        </>
      ) : null}
      {tab === "pricing" ? (
        <Grid
          title="Immutable price versions"
          rows={prices}
          fields={[
            "version",
            "price_type",
            "amount_minor",
            "currency",
            "billing_interval",
            "status",
          ]}
        />
      ) : null}
      {tab === "add-ons" ? (
        <Grid
          title="Eligible add-ons"
          rows={data.addons.filter((x: Row) =>
            ((x.linked_product_ids as string[]) ?? []).includes(offerId),
          )}
          fields={["name", "amount_minor", "selection_rule", "status"]}
        />
      ) : null}
      {tab === "checkout" ? (
        <Grid
          title="Checkout configuration"
          rows={data.checkoutFlows.filter((x: Row) => x.product_id === offerId)}
          fields={["mode", "stages", "settings"]}
        />
      ) : null}
      {tab === "activation" ? (
        <>
          <Grid
            title="Activation workflow"
            rows={flow ? [flow] : []}
            fields={["name", "trigger_type", "status", "version"]}
          />
          <Grid
            title="Ordered steps"
            rows={steps}
            fields={["position", "name", "step_type", "retryable"]}
          />
        </>
      ) : null}
      {tab === "settings" ? (
        <Panel title="Offer settings">
          <D
            l="Availability"
            v={`${String(d.available_from ?? "Immediate")} — ${String(d.available_to ?? "No end")}`}
          />
          <D l="Featured" v={d.featured ? "Yes" : "No"} />
          <D l="Owner" v={String(d.owner_name ?? "Unassigned")} />
        </Panel>
      ) : null}
      {tab === "analytics" ? (
        <section className="grid gap-4 sm:grid-cols-3">
          <Card l="Purchases">{orders.length}</Card>
          <Card l="Revenue">
            <Money
              minor={orders.reduce(
                (n: number, x: Row) =>
                  n + Number(x.finalized_total_minor ?? x.total_minor),
                0,
              )}
            />
          </Card>
          <Card l="Attribution">Canonical orders only</Card>
        </section>
      ) : null}
      {tab === "activity" ? (
        <Grid
          title="Activity"
          rows={data.activity.filter((x: Row) => x.product_id === offerId)}
          fields={["event_type", "summary", "occurred_at"]}
        />
      ) : null}
    </main>
  );
}
function Card({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <article className="rounded-2xl border bg-white p-5">
      <p className="text-xs font-bold uppercase text-stone-500">{l}</p>
      <p className="mt-3 text-2xl font-semibold">{children}</p>
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
      <p className="mt-1 capitalize">{v.replaceAll("_", " ")}</p>
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
    <section className="overflow-x-auto rounded-2xl border bg-white">
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
                    ) : typeof x[f] === "object" ? (
                      JSON.stringify(x[f])
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
                No records configured.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
