import Link from "next/link";
import { Boxes, ExternalLink, FilterX, SlidersHorizontal } from "lucide-react";
import { getFurnishingLibrary, type LibraryFilterValue, type LibraryFilters } from "@/app/actions/furnishing-library";
import { FurnishingHeader } from "./furnishing-navigation";
import { ProductThumb } from "./product-thumb";

// Supabase projections remain dynamic until generated FS-UX-010 database types land.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type Filters = LibraryFilters;

const money = (minor: unknown, currency = "USD") =>
  typeof minor === "number" ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100) : null;
const single = (value: LibraryFilterValue): string | undefined => (Array.isArray(value) ? value[0] : (value as string | undefined));
const list = (value: LibraryFilterValue): string[] => (Array.isArray(value) ? [...value] : value ? [value as string] : []);

function buildQuery(filters: Filters, overrides: Record<string, LibraryFilterValue>) {
  const params = new URLSearchParams();
  const merged: Record<string, LibraryFilterValue> = { ...filters, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (key === "cursor") continue; // any filter/search change resets pagination
    for (const entry of list(value)) params.append(key, entry);
  }
  const query = params.toString();
  return query ? `/admin/furnishing/products?${query}` : "/admin/furnishing/products";
}
function HiddenFields({ filters, exclude }: { filters: Filters; exclude: readonly string[] }) {
  return (
    <>
      {Object.entries(filters).flatMap(([key, value]) =>
        exclude.includes(key) ? [] : list(value).map((entry, index) => <input key={`${key}-${index}`} type="hidden" name={key} value={entry} />),
      )}
    </>
  );
}

export async function ProductLibrary({ searchParams }: { searchParams: Promise<Filters> }) {
  const filters = await searchParams;
  const data = await getFurnishingLibrary(filters);
  const layout = single(filters.layout) === "list" ? "list" : "grid";
  const filtersActive = Boolean(filters.room || filters.style || filters.retailer || filters.category || filters.availability);

  return (
    <main className="space-y-6 px-4 pb-12 sm:px-0">
      <FurnishingHeader
        title="Product Library"
        description="Products you have saved for furnishing projects."
        current="product-library"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/furnishing/products/import" className="inline-flex min-h-11 items-center rounded-xl border bg-white px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
              Import spreadsheet
            </Link>
            <Link href="/admin/furnishing/products/new" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">
              Add product
            </Link>
          </div>
        }
      />

      <form className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3" role="search">
        <HiddenFields filters={filters} exclude={["q", "cursor", "layout"]} />
        <label className="min-w-[240px] flex-1">
          <span className="sr-only">Search products or retailers</span>
          <input name="q" defaultValue={single(filters.q)} placeholder="Search products or retailers" className="min-h-11 w-full rounded-xl border px-3" />
        </label>
        <button type="submit" className="min-h-11 rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white">
          Search
        </button>
        <details className="group relative">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" /> Filters
            {filtersActive ? <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-800 text-xs text-white">•</span> : null}
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-[min(90vw,420px)] space-y-4 rounded-2xl border bg-white p-4 shadow-xl">
            <input type="hidden" name="q" value={single(filters.q) ?? ""} />
            <FilterSelect name="room" label="Room" options={data.roomTypes.map((r: Row) => [r.id, r.name])} values={list(filters.room)} />
            <FilterSelect name="category" label="Product type" options={data.categories.map((c: Row) => [c.id, c.name])} values={list(filters.category)} multiple={false} />
            <FilterSelect name="style" label="Style" options={data.styleTags.map((s: Row) => [s.id, s.name])} values={list(filters.style)} />
            <FilterSelect name="retailer" label="Retailer" options={data.retailers.map((r: Row) => [r.id, r.name])} values={list(filters.retailer)} />
            <label className="block text-sm font-medium">
              Availability
              <select name="availability" defaultValue={single(filters.availability) ?? ""} className="mt-1 min-h-11 w-full rounded-xl border px-3">
                <option value="">Any availability</option>
                <option value="in_stock">In stock</option>
                <option value="low_stock">Low stock</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="archived">Archived products</option>
              </select>
            </label>
            <div className="flex justify-between gap-2">
              {filtersActive ? (
                <Link href={buildQuery(filters, { room: undefined, category: undefined, style: undefined, retailer: undefined, availability: undefined })} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-emerald-800">
                  <FilterX aria-hidden="true" className="h-4 w-4" /> Clear all
                </Link>
              ) : <span />}
              <button type="submit" className="min-h-11 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white">Apply filters</button>
            </div>
          </div>
        </details>
        <div className="ml-auto flex gap-1" role="group" aria-label="Layout">
          <Link href={buildQuery(filters, { layout: "grid" })} aria-label="Grid view" aria-pressed={layout === "grid"} className={`grid h-11 w-11 place-items-center rounded-xl border ${layout === "grid" ? "bg-stone-950 text-white" : ""}`}>
            <Boxes aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link href={buildQuery(filters, { layout: "list" })} aria-label="List view" aria-pressed={layout === "list"} className={`grid h-11 w-11 place-items-center rounded-xl border ${layout === "list" ? "bg-stone-950 text-white" : ""}`}>
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4 rotate-90" />
          </Link>
        </div>
      </form>

      <p className="text-sm text-stone-600" role="status">
        {data.totalCount} {data.totalCount === 1 ? "saved product" : "saved products"}
      </p>

      {data.products.length ? (
        layout === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.products.map((p: Row) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-600">
                <tr><th className="p-4">Product</th><th>Retailer</th><th>Price</th><th>Room</th><th>Type / Style</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>{data.products.map((p: Row) => <ProductListRow key={p.id} product={p} />)}</tbody>
            </table>
          </div>
        )
      ) : (
        <Empty filtersActive={filtersActive || Boolean(filters.q)} />
      )}

      {data.nextCursor ? (
        <div className="flex justify-center">
          <Link href={buildQuery(filters, { cursor: data.nextCursor })} className="inline-flex min-h-11 items-center rounded-xl border px-5 text-sm font-semibold">
            Show more products
          </Link>
        </div>
      ) : null}
    </main>
  );
}

function FilterSelect({ name, label, options, values, multiple = true }: { name: string; label: string; options: [string, string][]; values: string[]; multiple?: boolean }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select name={name} multiple={multiple} defaultValue={multiple ? values : (values[0] ?? "")} className="mt-1 w-full rounded-xl border px-3 py-2" size={multiple ? Math.min(5, Math.max(3, options.length)) : undefined}>
        {!multiple ? <option value="">All types</option> : null}
        {options.map(([id, optionLabel]) => (
          <option key={id} value={id}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function offerFor(product: Row) {
  const offers: Row[] = product.furnishing_product_offers ?? [];
  return offers.find((offer) => offer.status === "active") ?? offers[0];
}
function primaryImage(product: Row): string | null {
  const media: Row[] = product.furnishing_product_media ?? [];
  return (media.find((item) => item.is_primary) ?? media[0])?.source_url ?? null;
}
function ProductCard({ product: p }: { product: Row }) {
  const offer = offerFor(p);
  const rooms: Row[] = p.furnishing_product_room_compatibility ?? [];
  return (
    <article className="flex flex-col rounded-2xl border bg-white p-4">
      <Link href={`/admin/furnishing/products/${p.id}`} className="block overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
        <ProductThumb src={primaryImage(p)} alt={p.name} className="h-32 w-full" />
      </Link>
      <div className="mt-3 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{offer?.furnishing_retailers?.name ?? "No retailer"}</p>
        <Link href={`/admin/furnishing/products/${p.id}`} className="mt-0.5 block font-semibold text-stone-950 outline-none hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-700">
          {p.name}
        </Link>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span>{money(offer?.listed_price_minor, offer?.currency) ?? "Price unavailable"}</span>
          <span className="text-stone-500">{offer?.availability?.replaceAll("_", " ") ?? "Unknown"}</span>
        </div>
        {rooms.length ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {rooms.slice(0, 3).map((room) => (
              <span key={room.room_type_id} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">{room.room_type_id.replaceAll("_", " ")}</span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-3 border-t pt-3 text-sm font-semibold">
        {offer?.product_url ? (
          <a href={offer.product_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-emerald-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
            View retailer <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
        <Link href={`/admin/furnishing/products/${p.id}/edit`} className="ml-auto text-stone-700 outline-none hover:text-stone-950 focus-visible:ring-2 focus-visible:ring-emerald-700">
          Edit
        </Link>
      </div>
    </article>
  );
}

function ProductListRow({ product: p }: { product: Row }) {
  const offer = offerFor(p);
  const rooms: Row[] = p.furnishing_product_room_compatibility ?? [];
  return (
    <tr className="border-t align-top">
      <td className="p-4"><Link href={`/admin/furnishing/products/${p.id}`} className="font-semibold text-stone-950 hover:text-emerald-800">{p.name}</Link></td>
      <td>{offer?.furnishing_retailers?.name ?? "No retailer"}</td>
      <td>{money(offer?.listed_price_minor, offer?.currency) ?? "Unavailable"}</td>
      <td>{rooms.map((r) => r.room_type_id.replaceAll("_", " ")).join(", ") || "No room set"}</td>
      <td>{p.furnishing_product_categories?.name ?? "Not classified"}</td>
      <td><Link href={`/admin/furnishing/products/${p.id}/edit`} className="font-semibold text-emerald-800">Edit</Link></td>
    </tr>
  );
}

function Empty({ filtersActive }: { filtersActive: boolean }) {
  if (filtersActive) {
    return (
      <section className="rounded-2xl border border-dashed p-10 text-center">
        <h2 className="text-xl font-semibold">No products match the current search or filters</h2>
        <Link href="/admin/furnishing/products" className="mt-4 inline-flex min-h-11 items-center font-semibold text-emerald-800">Clear search and filters</Link>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-dashed p-10 text-center">
      <Boxes aria-hidden="true" className="mx-auto h-8 w-8 text-emerald-800" />
      <h2 className="mt-4 text-xl font-semibold">No products yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-stone-600">Add your first product by pasting a retailer link, or import a spreadsheet.</p>
      <Link href="/admin/furnishing/products/new" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-4 font-semibold text-white">Add product</Link>
    </section>
  );
}
