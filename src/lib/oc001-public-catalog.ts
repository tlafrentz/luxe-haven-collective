import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ReadPublishedOc001Catalog, type Oc001OfferFamily, type PublicOc001Offer } from "@/platform/commerce";

export async function getPublishedOc001Offers(family?:Oc001OfferFamily):Promise<readonly PublicOc001Offer[]>{try{return await new ReadPublishedOc001Catalog(await createClient()).execute(family)}catch{return Object.freeze([])}}
export async function getPublishedOc001Offer(code:string):Promise<PublicOc001Offer|null>{const family=code.startsWith("guidebook.")?"guidebook":code.startsWith("investment.")?"investment_intelligence":code.startsWith("furnishing.")?"furnishing":"hpm";return (await getPublishedOc001Offers(family)).find(value=>value.offerCode===code)??null}
export function formatOc001Price(amountMinor:number,currency="USD"){return new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:amountMinor%100===0?0:2}).format(amountMinor/100)}
