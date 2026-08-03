import {
  createOfferAction,
  getOfferCatalog,
} from "@/app/actions/offer-catalog";
import { OfferHeader } from "@/components/offers/offer-navigation";
import {
  FULFILLMENT_MODELS,
  OFFER_TYPES,
  PAYMENT_MODELS,
} from "@/features/offer-catalog";
export const dynamic = "force-dynamic";
export default async function Page() {
  const data = await getOfferCatalog();
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <OfferHeader
        title="New offer"
        description="Define how the offer is purchased, activated, fulfilled, and brought to first customer value."
        current="offers"
      />
      <form action={createOfferAction} className="space-y-6">
        <Section title="Offer identity">
          <div className="grid gap-4 md:grid-cols-2">
            <Field l="Offer name">
              <input name="name" required className="input" />
            </Field>
            <Field l="Slug">
              <input name="slug" required className="input" />
            </Field>
            <Field l="Category">
              <select name="category" required className="input">
                <option value="">Select category</option>
                {data.categories.map((x: Record<string, unknown>) => (
                  <option key={String(x.id)} value={String(x.id)}>
                    {String(x.name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field l="Owner">
              <input name="owner" className="input" />
            </Field>
          </div>
          <Field l="Short description">
            <input name="shortDescription" className="input" />
          </Field>
          <Field l="Full description">
            <textarea name="description" className="input" />
          </Field>
        </Section>
        <Section title="Commercial model">
          <div className="grid gap-4 md:grid-cols-2">
            <Field l="Offer type">
              <select name="offerType" className="input">
                {OFFER_TYPES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field l="Fulfillment model">
              <select name="fulfillmentModel" className="input">
                {FULFILLMENT_MODELS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field l="Payment model">
              <select name="paymentModel" className="input">
                {PAYMENT_MODELS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field l="Starting price">
              <input
                name="price"
                type="number"
                min="0"
                step=".01"
                className="input"
              />
            </Field>
            <Field l="Specialist workspace">
              <select name="workspace" className="input">
                <option value="">Immediate or manual delivery</option>
                <option value="furnishing-studio">Furnishing Studio</option>
                <option value="guidebook-studio">Guidebook Studio</option>
                <option value="customer-onboarding">Customer onboarding</option>
                <option value="downloads">Downloads</option>
              </select>
            </Field>
          </div>
        </Section>
        <Section title="Audience and value">
          <Field l="Intended customer">
            <textarea name="customer" className="input" />
          </Field>
          <Field l="Best fit">
            <textarea name="bestFit" className="input" />
          </Field>
          <Field l="Expected time to value">
            <input name="timeToValue" className="input" />
          </Field>
        </Section>
        <Section title="Activation review">
          <p className="text-sm text-stone-600">
            A draft checkout flow and idempotent activation workflow will be
            created. The offer cannot publish until pricing and activation are
            complete.
          </p>
          <button className="mt-5 rounded-xl bg-emerald-800 px-6 py-3 font-semibold text-white">
            Create offer
          </button>
        </Section>
      </form>
    </main>
  );
}
function Section({
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
function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold">
      {l}
      {children}
    </label>
  );
}
