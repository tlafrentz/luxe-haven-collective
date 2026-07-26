import { notFound } from "next/navigation";
import { getCommerceProduct, defaultCommerceCatalog } from "@/platform/commerce";
import { CheckoutButton } from "@/features/commerce/checkout-button";
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params, result = await getCommerceProduct(defaultCommerceCatalog, slug);
  if (!result || result.product.status !== "active") notFound();
  const offer=(await defaultCommerceCatalog.listOffers()).find(value=>value.productIds.includes(result.product.id)&&value.status==="active");
  return <main className="mx-auto max-w-4xl px-5 py-16"><p className="eyebrow">{result.product.type.replaceAll("-", " ")}</p><h1 className="mt-3 font-serif text-5xl">{result.product.name}</h1><p className="mt-6 text-lg leading-8 text-stone-600">{result.product.longDescription}</p><section className="mt-10 rounded-3xl border border-stone-200 p-7"><h2 className="text-xl font-semibold">Available pricing</h2>{result.prices.filter(({ status }) => status === "active").map(price => <p key={price.id} className="mt-4 text-2xl font-semibold">{price.type === "custom-quote" ? "Custom quote" : price.amount.format()}</p>)}{offer?<div className="mt-6"><CheckoutButton offerId={offer.id}/></div>:<p className="mt-5 text-sm text-stone-500">Contact Luxe Haven for availability.</p>}</section></main>;
}
