"use client";

import {
  AcquisitionSectionCard,
} from "./acquisition-section-card";

import {
  useInvestmentWorkspaceState,
} from "./investment-workspace-state";

const INPUT_CLASS_NAME =
  "mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-950 outline-none transition focus:border-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-200";

function parseNumber(
  value: string,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

export function RevenueAssumptionsCard() {
  const {
    values,
    setValues,
  } = useInvestmentWorkspaceState();

  return (
    <AcquisitionSectionCard
      eyebrow="Revenue"
      title="Model the revenue opportunity."
      description="Define the ADR, occupancy, and stay assumptions used to forecast annual property revenue."
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
          <path d="M3 19h20" />
        </svg>
      }
    >
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <label>
          <span className="text-xs font-medium text-neutral-500">
            Projected ADR
          </span>

          <input
            type="number"
            min="0"
            step="1"
            value={values.projectedAdr}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                projectedAdr:
                  parseNumber(
                    event.target.value,
                  ),
              }))
            }
            className={INPUT_CLASS_NAME}
          />
        </label>

        <label>
          <span className="text-xs font-medium text-neutral-500">
            Projected occupancy %
          </span>

          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={
              values
                .projectedOccupancyPercentage
            }
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                projectedOccupancyPercentage:
                  parseNumber(
                    event.target.value,
                  ),
              }))
            }
            className={INPUT_CLASS_NAME}
          />
        </label>

        <label className="sm:col-span-2">
          <span className="text-xs font-medium text-neutral-500">
            Average length of stay
          </span>

          <input
            type="number"
            min="1"
            step="0.5"
            value={
              values.averageLengthOfStay
            }
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                averageLengthOfStay:
                  parseNumber(
                    event.target.value,
                  ),
              }))
            }
            className={INPUT_CLASS_NAME}
          />
        </label>
      </div>
    </AcquisitionSectionCard>
  );
}
