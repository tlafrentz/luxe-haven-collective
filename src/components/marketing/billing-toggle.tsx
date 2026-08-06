"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type BillingCycle = "monthly" | "annual";

export function BillingToggle({ billing }: { billing: BillingCycle }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setBilling(next: BillingCycle) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("billing", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Billing cycle"
      className="inline-flex items-center gap-1 rounded-full border border-[#dce2dd] bg-white p-1"
    >
      {(["monthly", "annual"] as const).map((cycle) => (
        <button
          key={cycle}
          type="button"
          role="radio"
          aria-checked={billing === cycle}
          onClick={() => setBilling(cycle)}
          className={`min-h-9 rounded-full px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${
            billing === cycle
              ? "bg-[#074e38] text-white"
              : "text-stone-600 hover:text-[#074e38]"
          }`}
        >
          {cycle === "monthly" ? "Monthly" : "Annual"}
          {cycle === "annual" ? (
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                billing === "annual"
                  ? "bg-white/15 text-white"
                  : "bg-[#eff8f3] text-[#087251]"
              }`}
            >
              Save 20%
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
