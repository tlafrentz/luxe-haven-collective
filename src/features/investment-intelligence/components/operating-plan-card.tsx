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

export function OperatingPlanCard() {
  const {
    values,
    setValues,
  } = useInvestmentWorkspaceState();

  return (
    <AcquisitionSectionCard
      eyebrow="Operating plan"
      title="Define how the property will perform."
      description="Set the recurring expenses and reserves that determine cash flow and investment resilience."
      icon={
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
          <circle
            cx="8"
            cy="7"
            r="1.5"
          />
          <circle
            cx="15"
            cy="12"
            r="1.5"
          />
          <circle
            cx="10"
            cy="17"
            r="1.5"
          />
        </svg>
      }
    >
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <label>
          <span className="text-xs font-medium text-neutral-500">
            Management fee %
          </span>

          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={
              values
                .managementFeePercentage
            }
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                managementFeePercentage:
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
            Utilities / month
          </span>

          <input
            type="number"
            min="0"
            value={
              values.monthlyUtilities
            }
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                monthlyUtilities:
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
            Insurance / year
          </span>

          <input
            type="number"
            min="0"
            value={
              values.annualInsurance
            }
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                annualInsurance:
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
            Property taxes / year
          </span>

          <input
            type="number"
            min="0"
            value={values.annualTaxes}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                annualTaxes:
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
            Cleaning / year
          </span>

          <input
            type="number"
            min="0"
            value={values.annualCleaning}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                annualCleaning:
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
            Software / year
          </span>

          <input
            type="number"
            min="0"
            value={values.annualSoftware}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                annualSoftware:
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
            Supplies / year
          </span>

          <input
            type="number"
            min="0"
            value={values.annualSupplies}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                annualSupplies:
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
            Maintenance reserve %
          </span>

          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={
              values
                .maintenanceReservePercentage
            }
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                maintenanceReservePercentage:
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
            Capital reserve %
          </span>

          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={
              values
                .capitalReservePercentage
            }
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                capitalReservePercentage:
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
