import Link from "next/link";
import { getOfferCatalog } from "@/app/actions/offer-catalog";
import {
  createAddonAction,
  createPriceVersionAction,
} from "@/app/actions/offer-catalog";
import { Money, OfferHeader, Status } from "./offer-navigation";
type Data = Awaited<ReturnType<typeof getOfferCatalog>>;
type Row = Record<string, unknown>;
export type OfferView =
  | "overview"
  | "offers"
  | "bundles"
  | "pricing"
  | "add-ons"
  | "checkout"
  | "activation"
  | "orders"
  | "settings";
export async function OfferWorkspace({ view }: { view: OfferView }) {
  const data = await getOfferCatalog();
  if (!data.ok)
    return (
      <main className="mx-auto max-w-7xl p-8">
        <section
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-6"
        >
          <h1 className="text-xl font-semibold">
            Offer Catalog is unavailable
          </h1>
          <p className="mt-2 text-sm">{data.error}</p>
        </section>
      </main>
    );
  return (
    <main className="mx-auto max-w-[1500px] space-y-6 px-5 py-8">
      {view === "overview" ? <Overview data={data} /> : null}
      {view === "offers" ? <Offers data={data} /> : null}
      {view === "bundles" ? <Bundles data={data} /> : null}
      {view === "pricing" ? <Pricing data={data} /> : null}
      {view === "add-ons" ? <Addons data={data} /> : null}
      {view === "checkout" ? <Checkout data={data} /> : null}
      {view === "activation" ? <Activation data={data} /> : null}
      {view === "orders" ? <Orders data={data} /> : null}
      {view === "settings" ? <Settings data={data} /> : null}
    </main>
  );
}
const def = (data: Data, id: unknown) =>
    data.definitions.find((x: Row) => x.product_id === id) as Row | undefined,
  price = (data: Data, id: unknown) =>
    data.prices.find(
      (x: Row) => x.product_id === id && x.status === "active",
    ) as Row | undefined,
  lineProduct = (order: Row) => {
    const lines = order.commerce_order_lines as Row[] | undefined;
    return (lines?.[0]?.product_snapshot ?? {}) as Row;
  };
function Overview({ data }: { data: Data }) {
  const published = data.definitions.filter(
      (x: Row) => x.catalog_status === "published",
    ).length,
    drafts = data.definitions.filter(
      (x: Row) => x.catalog_status === "draft",
    ).length,
    revenue = data.orders
      .filter((x: Row) =>
        ["paid", "partially-refunded"].includes(String(x.status)),
      )
      .reduce(
        (n: number, x: Row) =>
          n + Number(x.finalized_total_minor ?? x.total_minor),
        0,
      ),
    exceptions = data.fulfillments.filter((x: Row) =>
      ["failed", "manual-review"].includes(String(x.status)),
    ).length;
  return (
    <>
      <OfferHeader
        title="Offer Catalog"
        description="Create, manage, and optimize everything Luxe Haven can sell."
        current="overview"
        action={
          <div className="flex gap-2">
            <Link
              href="/store"
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
            >
              View storefront ↗
            </Link>
            <Link
              href="/admin/offers/new"
              className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
            >
              + New offer
            </Link>
          </div>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric l="Total offers" v={data.products.length} />
        <Metric l="Published" v={published} />
        <Metric l="Draft" v={drafts} />
        <Metric l="Purchases" v={data.orders.length} />
        <Metric l="Revenue" v={<Money minor={revenue} />} />
        <Metric l="Exceptions" v={exceptions} />
      </section>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr_.7fr]">
        <Panel title="Revenue overview">
          <p className="text-3xl font-semibold">
            <Money minor={revenue} />
          </p>
          <p className="mt-2 text-sm text-stone-500">
            Captured order revenue; incomplete attribution remains excluded.
          </p>
          <div
            className="mt-6 h-32 rounded-xl bg-gradient-to-t from-emerald-100 to-transparent"
            role="img"
            aria-label={`Text summary: captured revenue is ${revenue / 100} dollars`}
          />
        </Panel>
        <Panel title="Offer performance">
          <div className="space-y-3">
            {data.products.slice(0, 5).map((x: Row) => (
              <div
                key={String(x.id)}
                className="flex justify-between rounded-xl bg-stone-50 p-3"
              >
                <span className="font-semibold">{String(x.name)}</span>
                <Status
                  value={String(def(data, x.id)?.catalog_status ?? "draft")}
                />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Orders by status">
          <div className="space-y-3">
            {["paid", "pending-payment", "refunded", "cancelled"].map((s) => (
              <div key={s} className="flex justify-between">
                <span className="capitalize">{s.replaceAll("-", " ")}</span>
                <strong>
                  {data.orders.filter((x: Row) => x.status === s).length}
                </strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <OrderTable data={data} limit={6} />
    </>
  );
}
function Offers({ data }: { data: Data }) {
  return (
    <>
      <OfferHeader
        title="Offers"
        description="Master list of sellable products, services, subscriptions, and configured packages."
        current="offers"
        action={
          <Link
            href="/admin/offers/new"
            className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
          >
            New offer
          </Link>
        }
      />
      <Filters
        labels={[
          "Search offers",
          "All types",
          "All categories",
          "All statuses",
          "All fulfillment models",
          "All payment models",
        ]}
      />
      <section className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead>
            <tr>
              {[
                "Offer",
                "Type",
                "Category",
                "Status",
                "Price from",
                "Payment",
                "Fulfillment",
                "Updated",
                "",
              ].map((x) => (
                <th className="p-4" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.products.map((x: Row) => {
              const d = def(data, x.id),
                p = price(data, x.id);
              return (
                <tr key={String(x.id)} className="border-t">
                  <td className="p-4 font-semibold">{String(x.name)}</td>
                  <td className="p-4 capitalize">
                    {String(d?.offer_type ?? x.product_type).replaceAll(
                      "_",
                      " ",
                    )}
                  </td>
                  <td className="p-4">{String(x.category_id)}</td>
                  <td className="p-4">
                    <Status value={String(d?.catalog_status ?? x.status)} />
                  </td>
                  <td className="p-4">
                    {p ? (
                      <Money
                        minor={p.amount_minor}
                        currency={String(p.currency)}
                      />
                    ) : (
                      "Missing"
                    )}
                  </td>
                  <td className="p-4 capitalize">
                    {String(d?.payment_model ?? "—").replaceAll("_", " ")}
                  </td>
                  <td className="p-4 capitalize">
                    {String(d?.fulfillment_model ?? "—").replaceAll("_", " ")}
                  </td>
                  <td className="p-4">
                    {new Date(String(x.updated_at)).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/admin/offers/${x.id}`}
                      className="font-semibold text-emerald-800"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
function Bundles({ data }: { data: Data }) {
  return (
    <>
      <OfferHeader
        title="Bundles"
        description="Combine offers while preserving each entitlement and fulfillment requirement."
        current="bundles"
        action={
          <Link
            href="/admin/offers/bundles/new"
            className="rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white"
          >
            New bundle
          </Link>
        }
      />
      <Grid
        rows={data.bundles as Row[]}
        title="Bundles"
        empty="No bundles have been configured."
        fields={["name", "status", "amount_minor"]}
      />
    </>
  );
}
function Pricing({ data }: { data: Data }) {
  return (
    <>
      <OfferHeader
        title="Pricing"
        description="Versioned, date-effective commercial prices; historical order snapshots remain unchanged."
        current="pricing"
      />
      <Panel title="Add price version">
        <form
          action={createPriceVersionAction}
          className="grid gap-3 md:grid-cols-5"
        >
          <select
            name="productId"
            required
            className="rounded-xl border px-3 py-2"
          >
            <option value="">Offer</option>
            {data.products.map((x: Row) => (
              <option key={String(x.id)} value={String(x.id)}>
                {String(x.name)}
              </option>
            ))}
          </select>
          <select name="priceType" className="rounded-xl border px-3 py-2">
            <option value="one-time">One-time</option>
            <option value="recurring">Recurring</option>
            <option value="custom-quote">Custom quote</option>
            <option value="free">Free</option>
          </select>
          <input
            name="price"
            type="number"
            min="0"
            step=".01"
            placeholder="Price"
            className="rounded-xl border px-3 py-2"
          />
          <input
            name="effectiveFrom"
            type="date"
            className="rounded-xl border px-3 py-2"
          />
          <button className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
            Add price
          </button>
        </form>
      </Panel>
      <Grid
        rows={data.prices as Row[]}
        title="Price versions"
        empty="No prices configured."
        fields={[
          "product_id",
          "price_type",
          "amount_minor",
          "currency",
          "status",
          "effective_from",
        ]}
      />
    </>
  );
}
function Addons({ data }: { data: Data }) {
  return (
    <>
      <OfferHeader
        title="Add-ons"
        description="Optional, recommended, or required commercial additions and their fulfillment effects."
        current="add-ons"
      />
      <Panel title="New add-on">
        <form action={createAddonAction} className="grid gap-3 md:grid-cols-5">
          <input
            name="name"
            required
            placeholder="Add-on name"
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
            placeholder="Price"
            className="rounded-xl border px-3 py-2"
          />
          <select name="selectionRule" className="rounded-xl border px-3 py-2">
            <option>optional</option>
            <option>recommended</option>
            <option>required</option>
          </select>
          <button className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
            Create add-on
          </button>
        </form>
      </Panel>
      <Grid
        rows={data.addons as Row[]}
        title="Catalog add-ons"
        empty="No add-ons configured."
        fields={[
          "name",
          "selection_rule",
          "amount_minor",
          "payment_model",
          "status",
        ]}
      />
    </>
  );
}
function Checkout({ data }: { data: Data }) {
  return (
    <>
      <OfferHeader
        title="Checkout"
        description="Define the minimum information and stages required to complete each purchase."
        current="checkout"
      />
      <div className="space-y-4">
        {data.checkoutFlows.map((x: Row) => {
          const product = data.products.find(
            (p: Row) => p.id === x.product_id,
          ) as Row | undefined;
          return (
            <Panel
              key={String(x.id)}
              title={String(product?.name ?? "Checkout flow")}
            >
              <p className="capitalize">
                Mode: {String(x.mode).replaceAll("_", " ")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {((x.stages as string[]) ?? []).map((s, i) => (
                  <span
                    key={s}
                    className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold"
                  >
                    {i + 1}. {s.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
function Activation({ data }: { data: Data }) {
  return (
    <>
      <OfferHeader
        title="Activation"
        description="Ordered, retryable post-purchase workflows with visible partial success and manual ownership."
        current="activation"
      />
      <div className="space-y-4">
        {data.activationFlows.map((x: Row) => {
          const product = data.products.find(
              (p: Row) => p.id === x.product_id,
            ) as Row | undefined,
            steps = data.activationSteps.filter((s: Row) => s.flow_id === x.id);
          return (
            <Panel key={String(x.id)} title={String(product?.name ?? x.name)}>
              <p className="text-sm capitalize text-stone-500">
                Trigger: {String(x.trigger_type).replaceAll("_", " ")} · Version{" "}
                {String(x.version)}
              </p>
              <ol className="mt-4 space-y-2">
                {steps.map((s: Row) => (
                  <li key={String(s.id)} className="rounded-xl bg-stone-50 p-3">
                    <strong>
                      {String(s.position)}. {String(s.name)}
                    </strong>
                    <span className="ml-2 text-xs text-stone-500">
                      {s.retryable ? "Retryable" : "Manual review"}
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
function Orders({ data }: { data: Data }) {
  return (
    <>
      <OfferHeader
        title="Orders"
        description="Payment, activation, and specialist fulfillment remain independent and auditable."
        current="orders"
      />
      <Filters
        labels={[
          "Search orders",
          "Payment status",
          "Activation status",
          "Fulfillment status",
          "Offer",
          "Customer",
        ]}
      />
      <OrderTable data={data} />
    </>
  );
}
function OrderTable({ data, limit }: { data: Data; limit?: number }) {
  return (
    <section className="overflow-x-auto rounded-2xl border bg-white">
      <table className="w-full min-w-[1050px] text-left text-sm">
        <thead>
          <tr>
            {[
              "Order",
              "Customer",
              "Offer",
              "Amount",
              "Payment",
              "Activation",
              "Fulfillment",
              "Purchase date",
              "Next action",
            ].map((x) => (
              <th className="p-4" key={x}>
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.orders.slice(0, limit).map((x: Row) => {
            const product = lineProduct(x);
            return (
              <tr key={String(x.id)} className="border-t">
                <td className="p-4 font-semibold">
                  <Link href={`/admin/offers/orders/${x.id}`}>
                    {String(x.order_number)}
                  </Link>
                </td>
                <td className="p-4">
                  {String((x.commerce_customers as Row)?.email ?? "—")}
                </td>
                <td className="p-4">{String(product.name ?? "Offer")}</td>
                <td className="p-4">
                  <Money
                    minor={x.finalized_total_minor ?? x.total_minor}
                    currency={String(x.currency)}
                  />
                </td>
                <td className="p-4">
                  <Status value={String(x.payment_status ?? x.status)} />
                </td>
                <td className="p-4">
                  <Status value={String(x.activation_status)} />
                </td>
                <td className="p-4">
                  <Status value={String(x.fulfillment_status)} />
                </td>
                <td className="p-4">
                  {new Date(String(x.created_at)).toLocaleDateString()}
                </td>
                <td className="p-4">
                  {String(
                    x.internal_next_action ??
                      x.customer_next_action ??
                      "Review order",
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
function Settings({ data }: { data: Data }) {
  const s = (data.settings ?? {}) as Row;
  return (
    <>
      <OfferHeader
        title="Settings"
        description="Catalog, payment, tax, refund, notification, permission, and integration governance."
        current="settings"
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="General">
          <dl className="grid gap-4">
            <D
              l="Catalog name"
              v={String(s.catalog_name ?? "Luxe Haven Offer Catalog")}
            />
            <D l="Default currency" v={String(s.default_currency ?? "USD")} />
            <D l="Time zone" v={String(s.timezone ?? "America/Chicago")} />
            <D l="Catalog status" v={String(s.catalog_status ?? "live")} />
          </dl>
        </Panel>
        {[
          "Payments & taxes",
          "Refunds & access",
          "Email templates",
          "Roles & permissions",
          "Integrations & webhooks",
        ].map((x) => (
          <Panel key={x} title={x}>
            <p className="text-sm text-stone-600">
              Configuration is governed through the canonical Commerce provider,
              authorization, and audit boundaries.
            </p>
          </Panel>
        ))}
      </div>
    </>
  );
}
function Metric({ l, v }: { l: string; v: React.ReactNode }) {
  return (
    <article className="rounded-2xl border bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
        {l}
      </p>
      <p className="mt-3 text-3xl font-semibold">{v}</p>
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
    <section className="rounded-2xl border bg-white p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function Filters({ labels }: { labels: string[] }) {
  return (
    <form className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
      {labels.map((x, i) =>
        i === 0 ? (
          <input
            key={x}
            name="q"
            placeholder={x}
            className="min-w-56 flex-1 rounded-xl border px-3 py-2"
          />
        ) : (
          <select
            key={x}
            aria-label={x}
            className="rounded-xl border px-3 py-2"
          >
            <option>{x}</option>
          </select>
        ),
      )}
      <button className="rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
        Apply
      </button>
    </form>
  );
}
function Grid({
  rows,
  title,
  empty,
  fields,
}: {
  rows: Row[];
  title: string;
  empty: string;
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
                    ) : (
                      String(x[f] ?? "—").replaceAll("_", " ")
                    )}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={fields.length}
                className="p-12 text-center text-stone-500"
              >
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
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
