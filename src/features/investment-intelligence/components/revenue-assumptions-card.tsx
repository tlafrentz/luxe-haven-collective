"use client";

import {
  AcquisitionSectionCard,
} from "./acquisition-section-card";

import {
  useInvestmentWorkspaceState,
} from "./investment-workspace-state";

import { INVESTMENT_NUMERIC_ASSUMPTION_POLICIES } from "../application/assumptions";
import { InvestmentNumericInput } from "./investment-numeric-input";
import { AssumptionFieldGuidance } from "./assumption-field-guidance";

const INPUT_CLASS_NAME =
  "mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-950 outline-none transition focus:border-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-200";

export function RevenueAssumptionsCard() {
  const {
    values,
    setValues,
  } = useInvestmentWorkspaceState();

  return (
    <div id="revenue">
      <AcquisitionSectionCard
        eyebrow="Revenue model"
        title="Build the top-line operating case."
        description="Set the rate, occupancy, and stay assumptions used to project annual revenue and operating demand."
        icon={
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M4 19V9" />
            <path d="M10 19V5" />
            <path d="M16 19v-7" />
            <path d="M22 19V3" />
            <path d="M2 19h22" />
          </svg>
        }
      >
        <div className="space-y-7">
          <section
            aria-labelledby="revenue-performance-heading"
            className="space-y-4"
          >
            <div>
              <h4
                id="revenue-performance-heading"
                className="text-sm font-semibold text-neutral-950"
              >
                Performance assumptions
              </h4>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Use stabilized expectations rather than peak-season targets.
              </p>
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                Real STR ADR and occupancy evidence are not yet available from the current Market Intelligence provider. These are operator-supplied assumptions, not Market-derived values.
              </p>
            </div>

            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <label>
                <span className="text-xs font-medium text-neutral-500">
                  Average daily rate
                </span>

                <InvestmentNumericInput value={values.projectedAdr} onCommit={(value) => setValues((current) => ({ ...current, projectedAdr: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.projectedAdr} label="projectedAdr" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="projectedAdr" />

                <span className="mt-1.5 block text-xs leading-5 text-neutral-500">
                  Expected blended nightly rate before taxes and fees.
                  {" "}Source: User supplied.
                </span>
              </label>

              <label>
                <span className="text-xs font-medium text-neutral-500">
                  Occupancy %
                </span>

                <InvestmentNumericInput value={values.projectedOccupancyPercentage} onCommit={(value) => setValues((current) => ({ ...current, projectedOccupancyPercentage: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.projectedOccupancyPercentage} label="projectedOccupancyPercentage" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="projectedOccupancyPercentage" />

                <span className="mt-1.5 block text-xs leading-5 text-neutral-500">
                  Expected share of available nights booked annually.
                  {" "}Source: User supplied.
                </span>
              </label>
            </div>
          </section>

          <section
            aria-labelledby="revenue-stay-pattern-heading"
            className="border-t border-neutral-200 pt-6"
          >
            <div>
              <h4
                id="revenue-stay-pattern-heading"
                className="text-sm font-semibold text-neutral-950"
              >
                Stay pattern
              </h4>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Define the average reservation length used to estimate booking
                frequency and cleaning turnover.
              </p>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-medium text-neutral-500">
                Average length of stay
              </span>

              <InvestmentNumericInput value={values.averageLengthOfStay} onCommit={(value) => setValues((current) => ({ ...current, averageLengthOfStay: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.averageLengthOfStay} label="averageLengthOfStay" className={INPUT_CLASS_NAME} />

              <span className="mt-1.5 block text-xs leading-5 text-neutral-500">
                Enter the expected number of nights per completed reservation.
              </span>
            </label>
          </section>
        </div>
      </AcquisitionSectionCard>
    </div>
  );
}
