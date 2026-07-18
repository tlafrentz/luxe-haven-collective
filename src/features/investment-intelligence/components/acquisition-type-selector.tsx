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
  } = useInvestmentWorkspaceState();

  return (
    <fieldset className="space-y-3">
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
    </fieldset>
  );
}
