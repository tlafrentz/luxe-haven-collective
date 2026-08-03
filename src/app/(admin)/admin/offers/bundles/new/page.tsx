import {
  createBundleAction,
  getOfferCatalog,
} from "@/app/actions/offer-catalog";
import { OfferHeader } from "@/components/offers/offer-navigation";
export const dynamic = "force-dynamic";
export default async function Page() {
  const data = await getOfferCatalog();
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-8">
      <OfferHeader
        title="New bundle"
        description="Combine offers while preserving each included offer's entitlement and activation requirements."
        current="bundles"
      />
      <form
        action={createBundleAction}
        className="space-y-5 rounded-2xl border bg-white p-6"
      >
        <label className="block font-semibold">
          Bundle name
          <input
            name="name"
            required
            className="mt-2 block w-full rounded-xl border px-3 py-2"
          />
        </label>
        <label className="block font-semibold">
          Slug
          <input
            name="slug"
            required
            className="mt-2 block w-full rounded-xl border px-3 py-2"
          />
        </label>
        <label className="block font-semibold">
          Description
          <textarea
            name="description"
            className="mt-2 block w-full rounded-xl border px-3 py-2"
          />
        </label>
        <label className="block font-semibold">
          Bundle price
          <input
            name="price"
            type="number"
            min="0"
            step=".01"
            className="mt-2 block w-full rounded-xl border px-3 py-2"
          />
        </label>
        <fieldset>
          <legend className="font-semibold">
            Included offers and activation order
          </legend>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {data.products.map((x: Record<string, unknown>) => (
              <label
                key={String(x.id)}
                className="flex items-center gap-2 rounded-xl border p-3"
              >
                <input type="checkbox" name="productId" value={String(x.id)} />
                {String(x.name)}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">
          Create bundle
        </button>
      </form>
    </main>
  );
}
