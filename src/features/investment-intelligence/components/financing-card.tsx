"use client";

import {
  AcquisitionType,
} from "../domain";

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

export function FinancingCard() {
  const {
    values,
    setValues,
  } = useInvestmentWorkspaceState();

  const isPurchase =
    values.acquisitionType ===
    AcquisitionType.Purchase;

  return (
    <AcquisitionSectionCard
      eyebrow={
        isPurchase
          ? "Financing"
          : "Lease structure"
      }
      title={
        isPurchase
          ? "Model the capital structure."
          : "Model the lease commitment."
      }
      description={
        isPurchase
          ? "Define how the acquisition will be financed and how much cash must be committed."
          : "Define the recurring lease obligation and the upfront capital required to launch the property."
      }
      icon={
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M3 8.5h18" />
          <path d="M5 8.5V20h14V8.5" />
          <path d="M7.5 5 12 2.5 16.5 5" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </svg>
      }
    >
      {isPurchase ? (
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <label>
            <span className="text-xs font-medium text-neutral-500">
              Down payment %
            </span>

            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={
                values
                  .downPaymentPercentage
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  downPaymentPercentage:
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
              Interest rate %
            </span>

            <input
              type="number"
              min="0"
              step="0.01"
              value={
                values
                  .interestRatePercentage
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  interestRatePercentage:
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
              Loan term
            </span>

            <input
              type="number"
              min="1"
              value={values.loanTermYears}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  loanTermYears:
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
              Closing costs
            </span>

            <input
              type="number"
              min="0"
              value={values.closingCosts}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  closingCosts:
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
              Furnishing budget
            </span>

            <input
              type="number"
              min="0"
              value={
                values.furnishingBudget
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  furnishingBudget:
                    parseNumber(
                      event.target.value,
                    ),
                }))
              }
              className={INPUT_CLASS_NAME}
            />
          </label>
        </div>
      ) : (
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <label>
            <span className="text-xs font-medium text-neutral-500">
              Monthly lease
            </span>

            <input
              type="number"
              min="0"
              value={values.monthlyLease}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  monthlyLease:
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
              Security deposit
            </span>

            <input
              type="number"
              min="0"
              value={
                values.securityDeposit
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  securityDeposit:
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
              Lease term in months
            </span>

            <input
              type="number"
              min="1"
              step="1"
              value={
                values.leaseTermMonths
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  leaseTermMonths:
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
              Startup costs
            </span>

            <input
              type="number"
              min="0"
              value={values.startupCosts}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  startupCosts:
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
              Furnishing budget
            </span>

            <input
              type="number"
              min="0"
              value={
                values.furnishingBudget
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  furnishingBudget:
                    parseNumber(
                      event.target.value,
                    ),
                }))
              }
              className={INPUT_CLASS_NAME}
            />
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 sm:mt-6">
            <input
              type="checkbox"
              checked={
                values.utilitiesIncluded
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  utilitiesIncluded:
                    event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-neutral-300"
            />

            <span className="text-sm font-medium text-neutral-700">
              Utilities included in lease
            </span>
          </label>
        </div>
      )}
    </AcquisitionSectionCard>
  );
}
