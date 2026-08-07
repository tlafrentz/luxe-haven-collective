"use client";

import { useMemo, useState } from "react";
import type { GuidebookAddOn, GuidebookPackage } from "@/lib/guidebook-packages";
import type { GuidebookPurchaseParams } from "@/lib/guidebook-purchase-params";

export function GuidebookSelectAddOnsForm({
  pkg,
  addOns,
  params,
}: {
  pkg: GuidebookPackage;
  addOns: GuidebookAddOn[];
  params: GuidebookPurchaseParams;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const total = useMemo(() => {
    const addOnsTotal = addOns
      .filter((addOn) => selected.includes(addOn.slug))
      .reduce((sum, addOn) => sum + addOn.price, 0);
    return pkg.price + addOnsTotal;
  }, [addOns, pkg.price, selected]);

  function toggle(slug: string) {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]));
  }

  return (
    <form method="get" action="/guidebook-studio/purchase/review" className="space-y-6">
      {Object.entries(params).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}
      <input type="hidden" name="addOns" value={selected.join(",")} />

      <div>
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">What&apos;s included</p>
        <ul className="mt-3 space-y-2">
          {pkg.features.map((item) => (
            <li key={item} className="text-sm text-stone-700">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">Add-ons</p>
        <div className="mt-3 space-y-3">
          {addOns.map((addOn) => (
            <label
              key={addOn.slug}
              className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 p-4"
            >
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(addOn.slug)}
                  onChange={() => toggle(addOn.slug)}
                  className="size-4"
                />
                <span>
                  <span className="block text-sm font-medium text-stone-800">{addOn.name}</span>
                  <span className="block text-xs text-stone-500">{addOn.description}</span>
                </span>
              </span>
              <span className="text-sm font-semibold text-stone-700">{addOn.priceLabel}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-stone-200 pt-5">
        <span className="text-sm font-semibold text-stone-700">Total</span>
        <span className="text-2xl font-bold">${total}</span>
      </div>

      <button
        type="submit"
        className="w-full rounded-2xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
      >
        Proceed to Review
      </button>
    </form>
  );
}
