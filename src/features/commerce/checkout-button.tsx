import { beginCommerceCheckout } from "@/app/actions/commerce-checkout";
export function CheckoutButton({offerId}:{offerId:string}){return <form action={beginCommerceCheckout.bind(null,offerId)}><button className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white">Continue to secure checkout</button></form>}
