"use client";

import {
  AcquisitionType,
} from "../domain";

import {
  useInvestmentWorkspaceState,
} from "./investment-workspace-state";

const OPTIONS = [
  {
    value: AcquisitionType.Purchase,
    eyebrow: "Own the asset",
    title: "Purchase",
    description:
      "Analyze an acquisition using purchase price, financing, operating costs, and projected investment returns.",
  },
  {
    value:
      AcquisitionType.RentalArbitrage,
    eyebrow: "Control the asset",
    title: "Rental arbitrage",
    description:
      "Evaluate leasing, furnishing, and operating a property without purchasing the underlying asset.",
  },
] as const;

export function AcquisitionTypeSelector() {
  const {
    values,
    setAcquisitionType,
    pendingStrategyTransition,
    confirmStrategyTransition,
    cancelStrategyTransition,
  } = useInvestmentWorkspaceState();

  return (
    <><fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-neutral-950">
        Acquisition strategy
      </legend>

      <p className="max-w-3xl text-sm leading-6 text-neutral-600">
        Choose how you intend to control the property. The selected strategy
        determines the capital structure, required assumptions, and
        underwriting model used by the platform.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {OPTIONS.map((option) => {
          const isSelected =
            values.acquisitionType ===
            option.value;

          return (
            <label
              key={option.value}
              className={[
                "relative cursor-pointer rounded-2xl border p-5 transition",
                isSelected
                  ? "border-neutral-950 bg-neutral-950 text-white shadow-sm"
                  : "border-neutral-200 bg-white text-neutral-950 hover:border-neutral-400",
              ].join(" ")}
            >
              <input
                type="radio"
                name="acquisition-type"
                value={option.value}
                checked={isSelected}
                onChange={() =>
                  setAcquisitionType(
                    option.value,
                  )
                }
                className="sr-only"
              />

              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className={[
                    "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    isSelected
                      ? "border-white"
                      : "border-neutral-300",
                  ].join(" ")}
                >
                  {isSelected ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-white" />
                  ) : null}
                </span>

                <span>
                  <span
                    className={[
                      "block text-xs font-semibold uppercase tracking-[0.16em]",
                      isSelected
                        ? "text-white/60"
                        : "text-neutral-500",
                    ].join(" ")}
                  >
                    {option.eyebrow}
                  </span>

                  <span className="mt-1 block text-lg font-semibold">
                    {option.title}
                  </span>

                  <span
                    className={[
                      "mt-2 block text-sm leading-6",
                      isSelected
                        ? "text-white/70"
                        : "text-neutral-600",
                    ].join(" ")}
                  >
                    {option.description}
                  </span>
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>{pendingStrategyTransition ? <div role="dialog" aria-modal="true" aria-labelledby="strategy-switch-title" className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><h2 id="strategy-switch-title" className="text-xl font-semibold text-neutral-950">Switch investment strategy?</h2><p className="mt-3 text-sm leading-6 text-neutral-600">Your property details will be preserved. {pendingStrategyTransition.from === AcquisitionType.Purchase ? "Purchase" : "Rental-arbitrage"}-specific assumptions, route-dependent operating assumptions, current preview context, completed analysis, and save token will be cleared.</p><p className="mt-2 text-sm font-medium text-neutral-800">Switch to {pendingStrategyTransition.to === AcquisitionType.Purchase ? "Purchase" : "Rental Arbitrage"}?</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={cancelStrategyTransition} className="min-h-11 rounded-xl border border-neutral-200 px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Cancel</button><button type="button" onClick={confirmStrategyTransition} autoFocus className="min-h-11 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Switch strategy</button></div></div></div> : null}</>
  );
}
