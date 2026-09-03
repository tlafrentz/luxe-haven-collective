"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import {
  validateProductLinkAction,
  extractProductFromLinkAction,
  createLibraryProductAction,
  type ExtractionState,
  type LinkValidationState,
  type SaveProductState,
} from "@/app/actions/furnishing-library";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type Props = Readonly<{ categories: Row[]; retailers: Row[]; roomTypes: Row[]; styleTags: Row[] }>;
type Step = "link" | "review" | "duplicate" | "saved";

const input = "mt-1 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-700";

export function AddProductFlow({ categories, retailers, roomTypes, styleTags }: Props) {
  const [step, setStep] = useState<Step>("link");
  const [isPending, startTransition] = useTransition();
  const [linkState, setLinkState] = useState<LinkValidationState>({});
  const [extraction, setExtraction] = useState<ExtractionState>({ status: "idle" });
  const [saveState, setSaveState] = useState<SaveProductState>({});
  const [forceCreate, setForceCreate] = useState(false);

  const extracted = extraction.status === "extracted" ? extraction.extracted : null;

  function submitLink(formData: FormData) {
    startTransition(async () => {
      const validated = await validateProductLinkAction({}, formData);
      setLinkState(validated);
      if (!validated.ok) return;
      const result = await extractProductFromLinkAction({ status: "idle" }, formData);
      setExtraction(result);
      if (result.status === "extracted" || result.status === "manual") setStep("review");
    });
  }

  function submitReview(formData: FormData) {
    formData.set("canonicalUrl", extraction.status !== "idle" ? (extraction.canonicalUrl ?? "") : "");
    formData.set("submittedUrl", extraction.status !== "idle" ? (extraction.submittedUrl ?? "") : "");
    formData.set("forceCreate", forceCreate ? "true" : "false");
    startTransition(async () => {
      const result = await createLibraryProductAction({}, formData);
      setSaveState(result);
      if (result.ok && result.status === "duplicate") setStep("duplicate");
      else if (result.ok) setStep("saved");
    });
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pb-16 sm:px-0">
      <nav aria-label="Breadcrumb" className="text-sm text-stone-600">
        <Link href="/admin/furnishing" className="hover:text-emerald-800">Furnishing Studio</Link> /{" "}
        <Link href="/admin/furnishing/products" className="hover:text-emerald-800">Product Library</Link> / Add product
      </nav>

      {step === "saved" ? (
        <section role="status" aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <h1 className="text-2xl font-semibold text-emerald-950">Product saved</h1>
          <p className="mt-2 text-emerald-900">It is ready to use in room packages and furnishing plans.</p>
          <div className="mt-5 flex justify-center gap-3">
            {saveState.productId ? (
              <Link href={`/admin/furnishing/products/${saveState.productId}`} className="inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white">
                View product
              </Link>
            ) : null}
            <Link href="/admin/furnishing/products" className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold">
              Back to library
            </Link>
          </div>
        </section>
      ) : null}

      {step === "link" ? (
        <section aria-labelledby="add-product-heading" className="rounded-2xl border p-6">
          <h1 id="add-product-heading" className="text-2xl font-semibold">Add a product</h1>
          <p className="mt-1 text-stone-600">Paste any retailer product link.</p>
          <form action={submitLink} className="mt-5 space-y-3">
            <label className="block text-sm font-medium" htmlFor="product-url">Product link</label>
            <div className="flex gap-2">
              <input id="product-url" name="url" required className={input} placeholder="https://www.example.com/product" aria-invalid={linkState.ok === false} aria-describedby={linkState.ok === false ? "product-url-error" : undefined} />
              <button disabled={isPending} className="min-h-11 shrink-0 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50">
                {isPending ? "Checking…" : "Continue"}
              </button>
            </div>
            {linkState.ok === false ? <p id="product-url-error" role="alert" className="text-sm text-red-700">{linkState.message}</p> : null}
            <p className="flex items-start gap-2 text-sm text-stone-600"><Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /> We&apos;ll fill in the name, retailer, image, and price when available. You can correct anything before saving.</p>
          </form>
          <Link href="/admin/furnishing/products" className="mt-4 inline-block text-sm font-semibold text-stone-600 hover:text-stone-950">Cancel</Link>
        </section>
      ) : null}

      {step === "review" && extraction.status !== "idle" && extraction.status !== "invalid_url" ? (
        <section aria-labelledby="review-heading" className="rounded-2xl border p-6">
          <h1 id="review-heading" className="text-2xl font-semibold">Review product</h1>
          <p className="mt-1 text-stone-600">Confirm the details and choose where this product belongs.</p>
          {extraction.status === "manual" ? (
            <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">We couldn&apos;t automatically read this page. You can enter the details manually below.</p>
          ) : null}
          <form action={submitReview} className="mt-5 space-y-4">
            <input type="hidden" name="canonicalUrl" value={extraction.canonicalUrl ?? ""} />
            <input type="hidden" name="submittedUrl" value={extraction.submittedUrl ?? ""} />
            <input type="hidden" name="forceCreate" value={forceCreate ? "true" : "false"} />
            <input type="hidden" name="extractionSource" value={extracted?.source ?? ""} />
            <input type="hidden" name="extractionConfidence" value={extracted?.confidence ?? ""} />
            <p className="text-xs text-stone-500">Link: {extraction.canonicalUrl}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium sm:col-span-2">Product name
                <input name="name" required defaultValue={extracted?.name ?? ""} className={input} />
              </label>
              <label className="text-sm font-medium">Retailer
                <select name="retailerId" defaultValue={extraction.retailerId ?? ""} className={input}>
                  <option value="">Not set</option>
                  {retailers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Brand
                <input name="brand" defaultValue={extracted?.brand ?? ""} className={input} />
              </label>
              <label className="text-sm font-medium">Price
                <input name="listedPriceMinor" type="number" min={0} step={1} placeholder="Amount in cents" defaultValue={extracted?.priceAmount ? String(Math.round(Number(extracted.priceAmount) * 100)) : ""} className={input} />
              </label>
              <label className="text-sm font-medium">Currency
                <input name="currency" defaultValue={extracted?.priceCurrency ?? "USD"} className={input} />
              </label>
              <label className="text-sm font-medium">Product type
                <select name="categoryId" required defaultValue="" className={input}>
                  <option value="" disabled>Choose a product type</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Color / finish
                <input name="color" defaultValue="" className={input} />
              </label>
              <label className="text-sm font-medium">SKU / model
                <input name="sku" defaultValue={extracted?.sku ?? ""} className={input} />
              </label>
              <label className="text-sm font-medium">Availability
                <select name="availability" defaultValue={extracted?.availability ?? "unknown"} className={input}>
                  <option value="in_stock">In stock</option>
                  <option value="low_stock">Low stock</option>
                  <option value="out_of_stock">Out of stock</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
            </div>
            <fieldset>
              <legend className="text-sm font-medium">Room (choose at least one)</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {roomTypes.map((room) => (
                  <label key={room.id} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                    <input type="checkbox" name="roomTypeIds" value={room.id} /> {room.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-medium">Style</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {styleTags.map((style) => (
                  <label key={style.id} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                    <input type="checkbox" name="styleTagIds" value={style.id} /> {style.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm font-medium">Notes
              <textarea name="notes" rows={3} className={input} />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep("link")} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Cancel</button>
              <button disabled={isPending} className="min-h-11 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50">
                {isPending ? "Saving…" : "Save product"}
              </button>
            </div>
            {saveState.ok === false ? <p role="alert" className="text-sm text-red-700">{saveState.message}</p> : null}
          </form>
        </section>
      ) : null}

      {step === "duplicate" ? (
        <section aria-labelledby="duplicate-heading" className="rounded-2xl border p-6">
          <h1 id="duplicate-heading" className="text-2xl font-semibold">This product may already exist</h1>
          <p className="mt-1 text-stone-600">
            {saveState.existingProductName ?? "A matching product"} is already in your library.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {saveState.existingProductId ? (
              <Link href={`/admin/furnishing/products/${saveState.existingProductId}`} className="inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white">
                Open existing product
              </Link>
            ) : null}
            {saveState.existingProductId ? (
              <Link href={`/admin/furnishing/products/${saveState.existingProductId}/edit`} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold">
                Update existing product
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => { setForceCreate(true); setStep("review"); }}
              className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold text-stone-700"
            >
              This is a different product — save anyway
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
