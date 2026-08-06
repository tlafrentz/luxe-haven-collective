import Link from "next/link";
import { Check, Loader2, Circle } from "lucide-react";
import type { CommerceCheckoutResult } from "@/platform/commerce";

type TimelineState = "done" | "in-progress" | "pending";

function TimelineStep({
  label,
  state,
}: {
  label: string;
  state: TimelineState;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`grid size-7 shrink-0 place-items-center rounded-full border ${
          state === "done"
            ? "border-emerald-800 bg-emerald-900 text-white"
            : state === "in-progress"
              ? "border-emerald-800 text-emerald-800"
              : "border-stone-300 text-stone-300"
        }`}
      >
        {state === "done" ? (
          <Check className="size-4" />
        ) : state === "in-progress" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Circle className="size-3" />
        )}
      </span>
      <span
        className={
          state === "pending"
            ? "text-stone-400"
            : "font-semibold text-[#171c19]"
        }
      >
        {label}
      </span>
    </li>
  );
}

export function PurchaseCompleteTimeline({
  result,
  planSlug,
}: {
  result: CommerceCheckoutResult | null;
  planSlug: string;
}) {
  const paid = result?.orderStatus === "paid";
  const failed = result?.orderStatus === "payment-failed";
  const isGuidebook = /guidebook/i.test(result?.productName ?? planSlug);
  const isFurnishing = /furnish|launch.*property/i.test(
    result?.productName ?? planSlug,
  );
  const isInvestment = /investment|analysis/i.test(result?.productName ?? planSlug);

  if (failed) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-[#dce2dd] bg-white p-8 text-center">
        <h1 className="font-serif text-3xl">Payment was not completed.</h1>
        <p className="mt-3 text-sm text-stone-600">
          Review your payment details or begin a new secure checkout.
        </p>
        <Link
          href={`/commerce/review?plan=${planSlug}`}
          className="mt-6 inline-flex min-h-11 items-center rounded-md bg-emerald-900 px-6 text-sm font-semibold text-white"
        >
          Retry checkout
        </Link>
      </div>
    );
  }

  const paymentState: TimelineState = paid ? "done" : "in-progress";
  const workspaceState: TimelineState = paid ? "done" : "pending";
  const activationState: TimelineState = paid ? "done" : "pending";

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-[#dce2dd] bg-white p-8">
      <h1 className="text-center font-serif text-3xl">
        {paid ? "Payment successful!" : "Payment confirmation is processing"}
      </h1>
      <p className="mt-3 text-center text-sm text-stone-600">
        {isInvestment
          ? "Your analysis is confirmed. Let’s turn this opportunity into a clear, evidence-backed investment case."
          : isFurnishing
          ? "Your order is confirmed. Let’s turn your property into a finished, guest-ready space."
          : isGuidebook
            ? "Your order is confirmed. Now let’s turn your property into an exceptional guest experience."
            : "Welcome to the Hospitality Performance Platform. Your subscription is active and your workspace is being prepared."}
      </p>
      <ol className="mt-8 space-y-4">
        <TimelineStep label="Payment received" state={paymentState} />
        <TimelineStep
          label={
            isInvestment
              ? "Analysis workspace prepared"
              : isFurnishing
              ? "Furnishing Studio prepared"
              : isGuidebook
                ? "Guidebook Studio prepared"
                : "Workspace created"
          }
          state={workspaceState}
        />
        <TimelineStep
          label={
            isInvestment
              ? "Ready to analyze"
              : isFurnishing
              ? "Ready to launch"
              : isGuidebook
                ? "Ready to create"
                : "Activation ready"
          }
          state={activationState}
        />
      </ol>
      {result ? (
        <dl className="mt-8 rounded-xl bg-stone-50 p-5 text-left text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-stone-500">
              Order
            </dt>
            <dd className="mt-1 font-semibold">{result.orderNumber}</dd>
          </div>
          <div className="mt-4">
            <dt className="text-xs uppercase tracking-wider text-stone-500">
              Product
            </dt>
            <dd className="mt-1">{result.productName}</dd>
          </div>
        </dl>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href={
            isInvestment
              ? "/dashboard/investments/new"
              : isFurnishing
              ? "/dashboard/furnishing/new"
              : isGuidebook
                ? "/dashboard/guidebooks/new"
                : "/commerce/welcome"
          }
          className="inline-flex min-h-11 items-center rounded-md bg-emerald-900 px-6 text-sm font-semibold text-white"
        >
          {isInvestment
            ? "Start My Analysis →"
            : isFurnishing
            ? "Begin My Launch Project →"
            : isGuidebook
              ? "Create My Guidebook →"
              : "Start Setup →"}
        </Link>
        <button
          type="button"
          disabled={!paid}
          title={paid ? undefined : "Available once your invoice is issued"}
          className="inline-flex min-h-11 items-center rounded-md border border-[#789487] px-6 text-sm font-semibold text-[#26342e] disabled:cursor-not-allowed disabled:opacity-40"
        >
          View Invoice
        </button>
      </div>
    </div>
  );
}
