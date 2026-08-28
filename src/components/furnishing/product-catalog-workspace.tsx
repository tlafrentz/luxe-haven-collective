import Link from "next/link";
import { issueFurnishingCommandContext } from "@/features/furnishing-studio/server-command-context";
import {
  completeCatalogImportAction,
  createFurnishingProductAction,
  createProductOfferAction,
  createRetailerAction,
  getCatalogImport,
  getFurnishingCatalog,
  getFurnishingProduct,
  setPreferredProductOfferAction,
  startCatalogImportAction,
} from "@/app/actions/furnishing-catalog";
import {
  catalogAttention,
  offerFreshness,
  representativeOffer,
} from "@/features/furnishing-studio";
import { Badge, FurnishingHeader } from "./furnishing-navigation";

// Supabase projections are intentionally dynamic until generated FS-002 database types land.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const asOffer = (offer: Row, preferredOfferId?: string | null) => ({
  id: String(offer.id),
  status: offer.status,
  availability: offer.availability,
  listedPrice:
    typeof offer.listed_price_minor === "number"
      ? { amountMinor: offer.listed_price_minor, currency: "USD" }
      : null,
  lastVerifiedAt:
    typeof offer.last_verified_at === "string" ? offer.last_verified_at : null,
  preferred: offer.id === preferredOfferId,
});
const attentionFor = (product: Row) => {
  const offers: Row[] = product.furnishing_product_offers ?? [];
  return catalogAttention({
    categoryId:
      typeof product.category_id === "string" ? product.category_id : null,
    roomCount: product.furnishing_product_room_compatibility?.length ?? 0,
    primaryMediaId:
      product.furnishing_product_media?.find((media: Row) => media.is_primary)
        ?.id ?? null,
    activeOffers: offers
      .filter((offer) => offer.status === "active")
      .map((offer) => asOffer(offer, product.preferred_offer_id)),
  });
};
const money = (minor: unknown) =>
  typeof minor === "number"
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(minor / 100)
    : "Price unavailable";
const field =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm";
const button =
  "inline-flex rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white";
const panel = "rounded-2xl border border-stone-200 bg-white p-5";

export async function ProductCatalog({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filters = await searchParams;
  const data = await getFurnishingCatalog(filters);
  const offers = data.products.flatMap(
    (product: Row) => product.furnishing_product_offers ?? [],
  );
  const attention = data.products.filter(
    (product: Row) => attentionFor(product).length,
  );
  const metrics = [
    ["Products", data.products.length],
    ["Active offers", offers.filter((x: Row) => x.status === "active").length],
    ["Retailers", data.retailers.length],
    [
      "Missing prices",
      offers.filter((x: Row) => x.listed_price_minor == null).length,
    ],
    [
      "Unavailable offers",
      offers.filter((x: Row) => x.availability === "out_of_stock").length,
    ],
    ["Needs review", attention.length],
  ];
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Product Catalog"
        description="Reusable products and retailer offers for hospitality furnishing projects."
        current="product catalog"
        action={
          <div className="flex gap-2">
            <Link
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
              href="/admin/furnishing/retailers"
            >
              Retailers
            </Link>
            <Link
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
              href="/admin/furnishing/products/import"
            >
              Import inventory
            </Link>
            <Link className={button} href="/admin/furnishing/products/new">
              + New product
            </Link>
          </div>
        }
      />
      <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map(([label, value]) => (
          <div className={panel} key={String(label)}>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <form className={`${panel} grid gap-3 md:grid-cols-5`}>
        <input
          className={field}
          name="q"
          defaultValue={filters.q}
          placeholder="Search products…"
          aria-label="Search products"
        />
        <select
          className={field}
          name="category"
          defaultValue={filters.category ?? ""}
        >
          <option value="">All categories</option>
          {data.categories.map((x: Row) => (
            <option value={x.id} key={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <select
          className={field}
          name="status"
          defaultValue={filters.status ?? ""}
        >
          <option value="">All statuses</option>
          {["draft", "in_review", "approved", "discontinued"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          className={field}
          name="scope"
          defaultValue={filters.scope ?? ""}
        >
          <option value="">All scopes</option>
          <option value="platform">Platform</option>
          <option value="workspace">Workspace</option>
        </select>
        <button className={button}>Apply filters</button>
      </form>
      {data.products.length ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.products.map((product: Row) => {
            const offers = product.furnishing_product_offers ?? [],
              representative = representativeOffer(
                offers.map((offer: Row) =>
                  asOffer(offer, product.preferred_offer_id),
                ),
              );
            const issues = attentionFor(product);
            return (
              <Link
                href={`/admin/furnishing/products/${product.id}`}
                key={product.id}
                className="group overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex aspect-[16/9] items-center justify-center bg-stone-100 text-sm text-stone-400">
                  {product.furnishing_product_media?.[0]?.source_url ? (
                    // Catalog media may originate from workspace storage hosts not known at build time.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="h-full w-full object-cover"
                      alt={product.furnishing_product_media[0].alt_text ?? ""}
                      src={product.furnishing_product_media[0].source_url}
                    />
                  ) : (
                    "Add product image"
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold group-hover:text-emerald-800">
                      {product.name}
                    </h2>
                    <Badge value={product.status} />
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    {product.furnishing_product_categories?.name ??
                      product.category}
                  </p>
                  <p className="mt-4 font-semibold">
                    {money(representative?.listedPrice?.amountMinor)}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {offers.length} {offers.length === 1 ? "offer" : "offers"} ·{" "}
                    {representative?.availability?.replaceAll("_", " ") ??
                      "No availability"}
                  </p>
                  {issues.length ? (
                    <p className="mt-3 text-xs font-semibold text-amber-700">
                      Needs attention · {issues.length}{" "}
                      {issues.length === 1 ? "issue" : "issues"}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </section>
      ) : (
        <section className={`${panel} py-16 text-center`}>
          <h2 className="text-xl font-semibold">
            Build your reusable furnishing catalog.
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-stone-600">
            Add canonical products once, then maintain retailer offers, room
            compatibility, and pricing in one governed place.
          </p>
          <Link
            href="/admin/furnishing/products/new"
            className={`${button} mt-5`}
          >
            Create first product
          </Link>
        </section>
      )}
    </main>
  );
}

export async function NewProduct() {
  const data = await getFurnishingCatalog();
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title="New Product"
        description="Create one canonical hospitality product. Retailer offers are added after creation."
        current="product catalog"
      />
      <form
        action={createFurnishingProductAction}
        className={`${panel} grid gap-5 md:grid-cols-2`}
      >
        <label className="font-semibold">
          Product name *
          <input required name="name" className={`${field} mt-2`} />
        </label>
        <label className="mx-auto mt-4 block max-w-xl text-left text-sm font-semibold">
          Mutation correlation
          <input
            required
            name="correlationId"
            className={`${field} mt-2`}
            placeholder="Fresh authorized correlation UUID"
          />
        </label>
        <label className="mx-auto mt-4 block max-w-xl text-left text-sm font-semibold">
          Replay key
          <input
            required
            name="idempotencyKey"
            className={`${field} mt-2`}
            placeholder="Correlation-bound idempotency key"
          />
        </label>
        <label className="font-semibold">
          Category *
          <select required name="categoryId" className={`${field} mt-2`}>
            <option value="">Select category</option>
            {data.categories.map((x: Row) => (
              <option key={x.id} value={x.id}>
                {x.group_name} · {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="font-semibold">
          Product type
          <input
            name="productType"
            className={`${field} mt-2`}
            placeholder="Furnishing, amenity, supply…"
          />
        </label>
        <label className="font-semibold">
          Subcategory
          <input name="subcategory" className={`${field} mt-2`} />
        </label>
        <label className="font-semibold">
          Brand
          <input name="brand" className={`${field} mt-2`} />
        </label>
        <label className="font-semibold">
          Manufacturer identifier
          <input name="manufacturerPartNumber" className={`${field} mt-2`} />
        </label>
        <label className="font-semibold">
          Durability
          <select name="durabilityType" className={`${field} mt-2`}>
            <option value="durable">Durable</option>
            <option value="consumable">Consumable</option>
          </select>
        </label>
        <label className="font-semibold">
          Replenishment
          <select name="replenishmentType" className={`${field} mt-2`}>
            <option value="one_time">One time</option>
            <option value="recurring">Recurring</option>
          </select>
        </label>
        <label className="font-semibold">
          Purchase unit
          <input
            name="purchaseUnit"
            defaultValue="each"
            className={`${field} mt-2`}
          />
        </label>
        <label className="font-semibold">
          Units per purchase
          <input
            name="unitsPerPurchase"
            type="number"
            min="1"
            defaultValue="1"
            className={`${field} mt-2`}
          />
        </label>
        <label className="font-semibold md:col-span-2">
          Description
          <textarea name="description" rows={4} className={`${field} mt-2`} />
        </label>
        <fieldset className="md:col-span-2">
          <legend className="font-semibold">Compatible rooms</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {data.roomTypes.map((room: Row) => (
              <label
                className="flex gap-2 rounded-xl border p-3 text-sm"
                key={room.id}
              >
                <input type="checkbox" name="rooms" value={room.id} />
                {room.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="md:col-span-2 flex justify-end gap-3">
          <Link
            href="/admin/furnishing/products"
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
          >
            Cancel
          </Link>
          <button className={button}>Create product</button>
        </div>
      </form>
    </main>
  );
}

export async function ProductDetail({ productId }: { productId: string }) {
  const { product, retailers, roomTypes, activity } =
    (await getFurnishingProduct(productId)) as Row;
  const offers: Row[] = product.furnishing_product_offers ?? [],
    preferred = representativeOffer(
      offers.map((offer) => asOffer(offer, product.preferred_offer_id)),
    );
  const roomNames = new Map(roomTypes.map((x: Row) => [x.id, x.name]));
  return (
    <main className="mx-auto max-w-[1320px] space-y-6 px-5 py-8">
      <FurnishingHeader
        title={product.name}
        description={`${product.furnishing_product_categories?.name ?? product.category} · ${product.brand ?? "Brand not set"}`}
        current="product catalog"
        action={<Badge value={product.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className={panel}>
          <div className="aspect-[16/9] rounded-xl bg-stone-100 flex items-center justify-center text-stone-400">
            Product media
          </div>
          <h2 className="mt-5 text-lg font-semibold">Overview</h2>
          <p className="mt-2 text-stone-600">
            {product.description ||
              "Add a description to help teams choose this product."}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-stone-500">Representative price</dt>
              <dd className="font-semibold">
                {money(preferred?.listedPrice?.amountMinor)}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Scope</dt>
              <dd className="font-semibold capitalize">{product.scope}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-stone-500">Compatible rooms</dt>
              <dd className="mt-1">
                {product.furnishing_product_room_compatibility
                  ?.map((x: Row) => roomNames.get(x.room_type_id))
                  .join(", ") || "Not assigned"}
              </dd>
            </div>
          </dl>
        </section>
        <div className="space-y-6">
          <section className={panel}>
            <div className="flex justify-between">
              <div>
                <h2 className="text-lg font-semibold">Retailer offers</h2>
                <p className="text-sm text-stone-500">
                  Catalog prices are estimates, not purchase costs.
                </p>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-stone-500">
                    <th className="py-3">Retailer</th>
                    <th>Price</th>
                    <th>Availability</th>
                    <th>Freshness</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => (
                    <tr className="border-b" key={offer.id}>
                      <td className="py-3 font-semibold">
                        {offer.furnishing_retailers?.name}
                      </td>
                      <td>{money(offer.listed_price_minor)}</td>
                      <td className="capitalize">
                        {offer.availability.replaceAll("_", " ")}
                      </td>
                      <td className="capitalize">
                        {offerFreshness(offer.last_verified_at)}
                      </td>
                      <td>
                        {product.preferred_offer_id === offer.id ? (
                          <span className="text-xs font-semibold text-emerald-700">
                            Preferred
                          </span>
                        ) : (
                          <form action={setPreferredProductOfferAction}>
                            <input
                              type="hidden"
                              name="productId"
                              value={product.id}
                            />
                            <input
                              type="hidden"
                              name="offerId"
                              value={offer.id}
                            />
                            <button className="text-xs font-semibold text-emerald-800">
                              Set preferred
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!offers.length ? (
                <p className="py-6 text-center text-sm text-stone-500">
                  No retailer offers yet.
                </p>
              ) : null}
            </div>
          </section>
          <section className={panel}>
            <h2 className="text-lg font-semibold">Add retailer offer</h2>
            <form
              action={createProductOfferAction}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <input type="hidden" name="productId" value={product.id} />
              <select required name="retailerId" className={field}>
                <option value="">Retailer *</option>
                {retailers.map((x: Row) => (
                  <option value={x.id} key={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
              <input
                required
                type="url"
                name="productUrl"
                className={field}
                placeholder="Product URL *"
              />
              <input
                name="listedPrice"
                inputMode="decimal"
                className={field}
                placeholder="Listed price"
              />
              <input
                name="shippingPrice"
                inputMode="decimal"
                className={field}
                placeholder="Shipping price"
              />
              <select name="availability" className={field}>
                <option value="unknown">Unknown</option>
                <option value="in_stock">In stock</option>
                <option value="low_stock">Low stock</option>
                <option value="out_of_stock">Out of stock</option>
              </select>
              <input name="sku" className={field} placeholder="SKU" />
              <button className={`${button} sm:col-span-2 justify-center`}>
                Save offer
              </button>
            </form>
          </section>
        </div>
      </div>
      <section className={panel}>
        <h2 className="text-lg font-semibold">History</h2>
        <ul className="mt-3 divide-y text-sm">
          {activity.map((x: Row) => (
            <li
              className="flex justify-between py-3"
              key={`${x.event_type}-${x.occurred_at}`}
            >
              <span>{String(x.event_type).replaceAll("_", " ")}</span>
              <time className="text-stone-500">
                {new Date(x.occurred_at).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export async function Retailers() {
  const data = await getFurnishingCatalog();
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Retailers"
        description="Manage the retailer directory used by product offers."
        current="product catalog"
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className={panel}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-stone-500">
                <th className="py-3">Retailer</th>
                <th>Domain</th>
                <th>Affiliate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.retailers.map((x: Row) => (
                <tr className="border-b" key={x.id}>
                  <td className="py-4 font-semibold">{x.name}</td>
                  <td>{x.domain}</td>
                  <td>{x.supports_affiliate_links ? "Yes" : "No"}</td>
                  <td>
                    <Badge value={x.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className={panel}>
          <h2 className="text-lg font-semibold">New retailer</h2>
          <form action={createRetailerAction} className="mt-4 space-y-3">
            <input
              required
              name="name"
              className={field}
              placeholder="Retailer name"
            />
            <input
              required
              type="url"
              name="websiteUrl"
              className={field}
              placeholder="https://retailer.com"
            />
            <label className="flex gap-2 text-sm">
              <input type="checkbox" name="supportsAffiliateLinks" />
              Supports affiliate links
            </label>
            <textarea name="notes" className={field} placeholder="Notes" />
            <button className={button}>Create retailer</button>
          </form>
        </section>
      </div>
    </main>
  );
}

export function ImportInventory({
  workspaceId,
  commandContextId,
}: {
  workspaceId: string | null;
  commandContextId: string | null;
}) {
  const resolved = Boolean(workspaceId && commandContextId);
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Import Inventory"
        description="Upload the reference workbook, map rows, detect duplicates, and review before import."
        current="product catalog"
      />
      <form
        action={startCatalogImportAction}
        className={`${panel} py-14 text-center`}
      >
        <label className="block text-lg font-semibold" htmlFor="file">
          Upload furnishing inventory
        </label>
        <p className="mt-2 text-sm text-stone-500">
          XLSX files up to 25 MB. Quantities and totals remain project logic and
          are not imported as catalog quantities.
        </p>
        {resolved ? (
          <div className="mx-auto mt-6 max-w-xl rounded-xl border bg-stone-50 p-4 text-left text-sm">
            <p><strong>Controlled workspace:</strong> {workspaceId}</p>
            <p className="mt-1"><strong>Command context:</strong> server resolved</p>
            <p className="mt-1 break-all"><strong>Authoritative SHA-256:</strong> ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823</p>
          </div>
        ) : (
          <p role="alert" className="mx-auto mt-6 max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-900">
            Import is unavailable until an authorized workspace and fresh correlation are bound in the server-issued URL.
          </p>
        )}
        <input type="hidden" name="commandContextId" value={commandContextId ?? ""} />
        <input
          id="file"
          required
          accept=".xlsx"
          type="file"
          name="file"
          className="mx-auto mt-6 block max-w-full rounded-xl border p-3"
        />
        <button disabled={!resolved} className={`${button} mt-6 disabled:cursor-not-allowed disabled:opacity-50`}>Parse and review 110 rows</button>
      </form>
    </main>
  );
}

export async function ImportReview({ importId }: { importId: string }) {
  const { catalogImport, items } = (await getCatalogImport(importId)) as Row;
  const applyContext = catalogImport.status === "review_required" ? await issueFurnishingCommandContext({
    workflow: "fs008g-finalization:catalog-import",
    workspaceId: String(catalogImport.workspace_id),
    commandType: "catalog.import.apply",
    targetType: "import",
    targetId: String(catalogImport.id),
  }) : null;
  return (
    <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
      <FurnishingHeader
        title="Import Review"
        description={`${catalogImport.source_filename} · ${catalogImport.total_rows} detected rows`}
        current="product catalog"
      />
      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Status", catalogImport.status],
          ["Created", catalogImport.created_count],
          ["Matched", catalogImport.matched_count],
          ["Failed", catalogImport.failed_count],
        ].map(([x, y]) => (
          <div className={panel} key={String(x)}>
            <p className="text-xs uppercase text-stone-500">{x}</p>
            <p className="mt-2 text-xl font-semibold capitalize">
              {String(y).replaceAll("_", " ")}
            </p>
          </div>
        ))}
      </section>
      <p className="text-sm text-stone-600">
        Controlled workspace: {catalogImport.workspace_id}
      </p>
      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="p-4">Source</th>
                <th>Proposed product</th>
                <th>Category</th>
                <th>Retailer</th>
                <th>Price</th>
                <th>Action</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x: Row) => (
                <tr className="border-t" key={x.id}>
                  <td className="p-4">
                    {x.source_sheet} · row {x.source_row}
                  </td>
                  <td className="font-semibold">{x.proposed_name}</td>
                  <td>
                    {x.furnishing_product_categories?.name ?? "Needs mapping"}
                  </td>
                  <td>{x.furnishing_retailers?.name ?? "Needs mapping"}</td>
                  <td>{money(x.proposed_price_minor)}</td>
                  <td className="capitalize">
                    {x.review_action}
                    {x.duplicate_product_id ? " existing" : ""}
                  </td>
                  <td className="text-amber-700">
                    {x.validation_issues?.join(", ") || "Ready"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {catalogImport.status === "review_required" && items.length > 0 ? (
         <form action={completeCatalogImportAction} className="flex justify-end">
           <input type="hidden" name="importId" value={catalogImport.id} />
           <input type="hidden" name="commandContextId" value={applyContext?.contextId ?? ""} />
          <button className={button}>
            Import {items.length} reviewed items
          </button>
        </form>
      ) : (
        <div className="flex justify-end">
          <Link className={button} href="/admin/furnishing/products">
            Return to catalog
          </Link>
        </div>
      )}
    </main>
  );
}
