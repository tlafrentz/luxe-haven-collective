import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ checkoutSessionId: string }>;
}) {
  const { checkoutSessionId } = await params,
    db = createAdminClient(),
    { data: s } = await db
      .from("commerce_checkout_sessions")
      .select("id,status,order_id,offer_id,price_id,expires_at")
      .eq("id", checkoutSessionId)
      .maybeSingle();
  if (!s) notFound();
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <section className="rounded-2xl border bg-white p-8">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">
          Secure checkout
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Checkout session</h1>
        <p className="mt-3 text-stone-600">
          Status:{" "}
          <strong className="capitalize">
            {String(s.status).replaceAll("-", " ")}
          </strong>
        </p>
        <p className="mt-2 text-sm text-stone-500">
          This page never displays or logs payment credentials. Payment
          processing continues through the configured provider.
        </p>
        {s.expires_at && new Date(s.expires_at) < new Date() ? (
          <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4">
            This checkout session has expired. Return to the offer to begin
            again.
          </p>
        ) : null}
      </section>
    </main>
  );
}
