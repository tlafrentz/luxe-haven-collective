import Link from "next/link";
import type { PublicOc001Offer } from "@/platform/commerce";

export function Oc001PurchaseAction({offer,configureHref,consultHref="/contact",label}:Readonly<{offer:PublicOc001Offer|null;configureHref:string;consultHref?:string;label:string}>){
  if(!offer||!offer.checkoutAvailable||offer.purchaseAction==="unavailable")return <div className="mt-6"><span className="flex min-h-11 items-center justify-center rounded-md border border-stone-300 bg-stone-100 px-5 text-center text-sm font-semibold text-stone-600">Purchase currently unavailable</span><Link href={consultHref} className="mt-3 flex min-h-11 items-center justify-center rounded-md border border-[#789487] px-5 text-sm font-semibold text-[#26342e]">Contact Luxe Haven</Link></div>;
  if(offer.purchaseAction==="request_consultation")return <Link href={consultHref} className="mt-6 flex min-h-11 items-center justify-center rounded-md bg-emerald-900 px-5 text-sm font-semibold text-white">Request consultation</Link>;
  return <Link href={configureHref} className="mt-6 flex min-h-11 items-center justify-center rounded-md bg-emerald-900 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800">{label}</Link>;
}
