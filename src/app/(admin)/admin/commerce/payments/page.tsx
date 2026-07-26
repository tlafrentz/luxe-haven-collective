import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function CommercePaymentsPage() {
  const client = await createClient();
  const { data } = await client.from("commerce_payments").select("id,order_id,status,amount_minor,refunded_amount_minor,currency,attempt_number,created_at,updated_at").order("created_at", { ascending: false }).limit(200);
  return <main className="mx-auto max-w-7xl space-y-8 px-5 py-10"><header><p className="eyebrow">Commerce operations</p><h1 className="mt-2 text-4xl font-semibold">Payments</h1><p className="mt-3 text-stone-600">Canonical attempts synchronized from verified provider state. Raw payment-method data is never shown.</p></header><div className="overflow-x-auto rounded-2xl border"><table className="min-w-full text-left text-sm"><thead className="bg-stone-50"><tr><th className="p-4">Order</th><th className="p-4">Attempt</th><th className="p-4">State</th><th className="p-4">Amount</th><th className="p-4">Refunded</th><th className="p-4">Updated</th></tr></thead><tbody>{(data ?? []).map((payment) => <tr className="border-t" key={payment.id}><td className="p-4 font-semibold"><Link href={`/admin/commerce/orders/${payment.order_id}`}>{payment.order_id}</Link></td><td className="p-4">{payment.attempt_number}</td><td className="p-4 capitalize">{payment.status.replaceAll("-", " ")}</td><td className="p-4">{money(payment.amount_minor, payment.currency)}</td><td className="p-4">{money(payment.refunded_amount_minor, payment.currency)}</td><td className="p-4">{new Date(payment.updated_at).toLocaleString()}</td></tr>)}</tbody></table>{!data?.length ? <p className="p-8 text-center text-stone-600">No payment attempts recorded.</p> : null}</div></main>;
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount) / 100);
}
