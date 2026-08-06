import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCheckoutResult } from "@/app/actions/commerce-payments";
import { PurchaseCompleteTimeline } from "@/features/commerce-onboarding/purchase-complete-timeline";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/track";
import { plansBySlug, type PlanSlug } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Purchase Complete",
  description: "Your subscription purchase is complete.",
};

export default async function PurchaseCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; plan?: string }>;
}) {
  const { session_id, plan: planSlug } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = session_id ? await getCheckoutResult(session_id) : null;
  const plan = planSlug ? plansBySlug[planSlug as PlanSlug] : undefined;

  if (result?.orderStatus === "paid") {
    track("checkout_completed", { plan: planSlug });
    track("purchase_completed", { plan: planSlug, orderId: result.orderId });
  }

  return (
    <main>
      <div className="container-shell py-14 md:py-20">
        <PurchaseCompleteTimeline result={result} planSlug={plan?.slug ?? planSlug ?? ""} />
      </div>
    </main>
  );
}
