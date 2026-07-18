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
          ? "Capital structure"
          : "Lease structure"
      }
      title={
        isPurchase
          ? "Model the acquisition capital."
          : "Model the lease commitment."
      }
      description={
        isPurchase
          ? "Define the financing terms and upfront cash required to acquire and prepare the property."
          : "Define the lease obligation and upfront cash required to control, furnish, and launch the property."
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
        <div className="space-y-7">
          <section
            aria-labelledby="purchase-financing-heading"
            className="space-y-4"
          >
            <div>
              <h4
                id="purchase-financing-heading"
                className="text-sm font-semibold text-neutral-950"
              >
                Financing terms
              </h4>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Define the debt assumptions used to calculate payment and
                leveraged returns.
              </p>
            </div>

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

              <label className="sm:col-span-2">
                <span className="text-xs font-medium text-neutral-500">
                  Loan term in years
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
            </div>
          </section>

          <section
            aria-labelledby="purchase-upfront-capital-heading"
            className="border-t border-neutral-200 pt-6"
          >
            <div>
              <h4
                id="purchase-upfront-capital-heading"
                className="text-sm font-semibold text-neutral-950"
              >
                Upfront capital
              </h4>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Include transaction and setup costs required before operations
                begin.
              </p>
            </div>

            <div className="mt-4 grid gap-x-4 gap-y-5 sm:grid-cols-2">
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
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-7">
          <section
            aria-labelledby="rental-lease-heading"
            className="space-y-4"
          >
            <div>
              <h4
                id="rental-lease-heading"
                className="text-sm font-semibold text-neutral-950"
              >
                Lease commitment
              </h4>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Define the recurring rent and lease terms used to measure
                operating coverage.
              </p>
            </div>

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

              <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 sm:col-span-2">
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

                <span>
                  <span className="block text-sm font-medium text-neutral-700">
                    Utilities included in lease
                  </span>

                  <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
                    Enable this when the landlord covers recurring utilities.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section
            aria-labelledby="rental-upfront-capital-heading"
            className="border-t border-neutral-200 pt-6"
          >
            <div>
              <h4
                id="rental-upfront-capital-heading"
                className="text-sm font-semibold text-neutral-950"
              >
                Upfront capital
              </h4>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Include refundable deposits and all launch costs required
                before the property can operate.
              </p>
            </div>

            <div className="mt-4 grid gap-x-4 gap-y-5 sm:grid-cols-2">
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
          </section>
        </div>
      )}
    </AcquisitionSectionCard>
  );
}
