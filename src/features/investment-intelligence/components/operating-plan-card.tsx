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

export function OperatingPlanCard() {
  const {
    values,
    setValues,
  } = useInvestmentWorkspaceState();

  const isPurchase =
    values.acquisitionType ===
    AcquisitionType.Purchase;

  return (
    <div id="operating-plan">
      <AcquisitionSectionCard
        eyebrow="Operating plan"
        title="Define the recurring cost structure."
        description="Set the operating expenses and reserves that determine NOI, cash flow, and investment resilience."
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
        <div className="space-y-7">
          <section
            aria-labelledby="recurring-expenses-heading"
            className="space-y-4"
          >
            <div>
              <h4
                id="recurring-expenses-heading"
                className="text-sm font-semibold text-neutral-950"
              >
                Recurring expenses
              </h4>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Enter stabilized operating costs using the period shown in each
                field.
              </p>
            </div>

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
                  Utilities per month
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
                  disabled={
                    !isPurchase &&
                    values.utilitiesIncluded
                  }
                  className={[
                    INPUT_CLASS_NAME,
                    !isPurchase &&
                    values.utilitiesIncluded
                      ? "cursor-not-allowed opacity-50"
                      : "",
                  ].join(" ")}
                />

                {!isPurchase &&
                values.utilitiesIncluded ? (
                  <span className="mt-1.5 block text-xs leading-5 text-neutral-500">
                    Excluded because utilities are included in the lease.
                  </span>
                ) : null}
              </label>

              <label>
                <span className="text-xs font-medium text-neutral-500">
                  Insurance per year
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

              {isPurchase ? (
                <label>
                  <span className="text-xs font-medium text-neutral-500">
                    Property taxes per year
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
              ) : null}

              <label>
                <span className="text-xs font-medium text-neutral-500">
                  Cleaning per year
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
                  Software per year
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

              <label className="sm:col-span-2">
                <span className="text-xs font-medium text-neutral-500">
                  Supplies per year
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
            </div>
          </section>

          <section
            aria-labelledby="operating-reserves-heading"
            className="border-t border-neutral-200 pt-6"
          >
            <div>
              <h4
                id="operating-reserves-heading"
                className="text-sm font-semibold text-neutral-950"
              >
                Operating reserves
              </h4>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Protect the operating case by reserving a share of revenue for
                repairs and future asset needs.
              </p>
            </div>

            <div className="mt-4 grid gap-x-4 gap-y-5 sm:grid-cols-2">
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

              <label>
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
          </section>
        </div>
      </AcquisitionSectionCard>
    </div>
  );
}
