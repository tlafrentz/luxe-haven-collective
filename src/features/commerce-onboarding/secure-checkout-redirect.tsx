"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Lock, CreditCard } from "lucide-react";
import { beginCommerceOnboardingCheckout } from "@/app/actions/commerce-onboarding-checkout";
import type { BillingCycle } from "@/components/marketing/billing-toggle";

type Status = "loading" | "redirecting" | "error";

const errorCopy: Record<string, string> = {
  OFFER_UNAVAILABLE: "This plan isn't available for checkout yet.",
  PRICE_NOT_CONFIGURED: "Checkout pricing isn't configured for this plan yet.",
  WORKSPACE_NOT_CONFIGURED: "We couldn't find your workspace. Please create your account again.",
  NOT_AUTHENTICATED: "Please sign in to continue to checkout.",
};

export function SecureCheckoutRedirect({
  planSlug,
  billing,
}: {
  planSlug: string;
  billing: BillingCycle;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    beginCommerceOnboardingCheckout(planSlug, billing).then((result) => {
      if ("redirectUrl" in result) {
        setRedirectUrl(result.redirectUrl);
        setStatus("redirecting");
        window.location.href = result.redirectUrl;
      } else {
        setErrorCode(result.error);
        setStatus("error");
      }
    });
  }, [planSlug, billing]);

  useEffect(() => {
    if (status !== "redirecting") return;
    const timer = window.setTimeout(() => setShowFallback(true), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (status === "error") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-[#dce2dd] bg-white p-8 text-center">
        <p className="font-semibold text-stone-800">
          {errorCode ? errorCopy[errorCode] ?? "Checkout is unavailable right now." : "Checkout is unavailable right now."}
        </p>
        <Link
          href={`/contact?plan=${planSlug}`}
          className="mt-5 inline-flex min-h-11 items-center rounded-md bg-emerald-900 px-5 text-sm font-semibold text-white"
        >
          Contact us
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-[#dce2dd] bg-white p-10 text-center" aria-live="polite">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50">
        <Lock className="size-7 text-emerald-800" />
      </div>
      <h1 className="mt-6 font-serif text-3xl">You&apos;re being redirected to our secure checkout.</h1>
      <p className="mt-3 text-sm text-stone-600">
        You&apos;ll be taken to Stripe to complete your payment securely.
      </p>
      <ul className="mt-7 grid gap-3 text-left text-sm text-stone-600">
        <li className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-700" /> Secure &amp; encrypted
        </li>
        <li className="flex items-center gap-2">
          <CreditCard className="size-4 text-emerald-700" /> PCI compliant
        </li>
        <li className="flex items-center gap-2">
          <Lock className="size-4 text-emerald-700" /> Cancel anytime
        </li>
      </ul>
      {showFallback && redirectUrl ? (
        <a
          href={redirectUrl}
          className="mt-8 inline-flex min-h-11 items-center rounded-md bg-emerald-900 px-6 text-sm font-semibold text-white"
        >
          Continue
        </a>
      ) : (
        <p className="mt-8 text-xs text-stone-400">Redirecting…</p>
      )}
    </div>
  );
}
