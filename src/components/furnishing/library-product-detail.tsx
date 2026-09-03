"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ExternalLink, ImageIcon } from "lucide-react";
import { archiveLibraryProductAction } from "@/app/actions/furnishing-library";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type Props = Readonly<{
  product: Row;
  roomTypes: Row[];
  styleTags: Row[];
  activity: Row[];
}>;

const money = (minor: unknown, currency = "USD") =>
  typeof minor === "number" ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100) : "Price unavailable";

export function LibraryProductDetail({ product, roomTypes, styleTags, activity }: Props) {
  const [archiveState, archiveAction, archiving] = useActionState(archiveLibraryProductAction, {});
  const offer = (product.furnishing_product_offers ?? [])[0] as Row | undefined;
  const rooms: Row[] = product.furnishing_product_room_compatibility ?? [];
  const roomNameById = new Map(roomTypes.map((r) => [r.id, r.name]));
  const styles: Row[] = product.furnishing_product_style_tags ?? [];
  const styleNameById = new Map(styleTags.map((s) => [s.id, s.name]));
  const archived = product.status === "archived";

  return (
    <main className="space-y-8 px-4 pb-12 sm:px-0">
      <nav aria-label="Breadcrumb" className="text-sm text-stone-600">
        <Link href="/admin/furnishing" className="hover:text-emerald-800">Furnishing Studio</Link> /{" "}
        <Link href="/admin/furnishing/products" className="hover:text-emerald-800">Product Library</Link> / {product.name}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-stone-100">
            <ImageIcon aria-hidden="true" className="h-8 w-8 text-stone-400" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-stone-950">{product.name}</h1>
            <p className="mt-1 text-stone-600">{offer?.furnishing_retailers?.name ?? "No retailer set"} · {money(offer?.listed_price_minor, offer?.currency)}</p>
            {archived ? <span className="mt-2 inline-flex rounded-full bg-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-700">Archived</span> : null}
          </div>
        </div>
        <div className="flex gap-2">
          {offer?.product_url ? (
            <a href={offer.product_url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center gap-1 rounded-xl border px-4 text-sm font-semibold">
              Open retailer link <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
          ) : null}
          <Link href={`/admin/furnishing/products/${product.id}/edit`} className="inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white">
            Edit
          </Link>
        </div>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border p-5">
          <h2 className="font-semibold">Classification</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-stone-500">Product type</dt><dd>{product.furnishing_product_categories?.name ?? "Not set"}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Brand</dt><dd>{product.brand ?? "Not set"}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Color / finish</dt><dd>{[product.color, product.finish].filter(Boolean).join(" / ") || "Not set"}</dd></div>
            <div><dt className="text-stone-500">Rooms</dt><dd className="mt-1 flex flex-wrap gap-1">{rooms.length ? rooms.map((r) => <span key={r.room_type_id} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">{roomNameById.get(r.room_type_id) ?? r.room_type_id}</span>) : "No room set"}</dd></div>
            <div><dt className="text-stone-500">Styles</dt><dd className="mt-1 flex flex-wrap gap-1">{styles.length ? styles.map((s) => <span key={s.style_tag_id} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">{styleNameById.get(s.style_tag_id) ?? s.style_tag_id}</span>) : "No style set"}</dd></div>
            <div><dt className="text-stone-500">Tags</dt><dd className="mt-1">{(product.tags ?? []).join(", ") || "None"}</dd></div>
          </dl>
        </div>
        <div className="rounded-2xl border p-5">
          <h2 className="font-semibold">Price and availability evidence</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-stone-500">Price</dt><dd>{money(offer?.listed_price_minor, offer?.currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Availability</dt><dd>{offer?.availability?.replaceAll("_", " ") ?? "Unknown"}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Last verified</dt><dd>{offer?.last_verified_at ? new Date(offer.last_verified_at).toLocaleString() : "Unknown"}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">SKU</dt><dd>{offer?.sku ?? "Not set"}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Source</dt><dd className="capitalize">{(product.source_type ?? "manual").replaceAll("_", " ")}</dd></div>
          </dl>
        </div>
      </section>

      {product.notes ? (
        <section className="rounded-2xl border p-5"><h2 className="font-semibold">Notes</h2><p className="mt-2 text-sm text-stone-700">{product.notes}</p></section>
      ) : null}

      <section>
        <h2 className="text-xl font-semibold">Activity</h2>
        {activity.length ? (
          <ol className="mt-3 space-y-2">
            {activity.map((event, index) => (
              <li key={index} className="rounded-xl bg-stone-50 p-3 text-sm">
                <strong className="capitalize">{String(event.event_type).replaceAll("_", " ")}</strong>
                <span className="ml-2 text-stone-500">{new Date(event.occurred_at).toLocaleString()}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-stone-600">No recorded activity yet.</p>
        )}
      </section>

      {!archived ? (
        <form action={archiveAction} className="rounded-2xl border border-dashed p-5">
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="revision" value={product.revision} />
          <h2 className="font-semibold">Archive this product</h2>
          <p className="mt-1 text-sm text-stone-600">Archiving removes it from the Product Library while keeping historical package, plan, and procurement references intact.</p>
          <label className="mt-3 block text-sm font-medium">
            Reason (optional)
            <input name="reason" className="mt-1 min-h-11 w-full rounded-xl border px-3" />
          </label>
          <button disabled={archiving} className="mt-3 min-h-11 rounded-xl border border-red-300 px-4 text-sm font-semibold text-red-800 disabled:opacity-50">
            {archiving ? "Archiving…" : "Archive product"}
          </button>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-red-700">{archiveState.ok === false ? archiveState.message : ""}</p>
        </form>
      ) : null}
    </main>
  );
}
