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

import { INVESTMENT_NUMERIC_ASSUMPTION_POLICIES } from "../application/assumptions";
import { InvestmentNumericInput } from "./investment-numeric-input";
import { AssumptionFieldGuidance } from "./assumption-field-guidance";

const INPUT_CLASS_NAME =
  "mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-950 outline-none transition focus:border-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-200";

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

                <InvestmentNumericInput value={values.downPaymentPercentage} onCommit={(value) => setValues((current) => ({ ...current, downPaymentPercentage: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.downPaymentPercentage} label="downPaymentPercentage" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="downPaymentPercentage" />
              </label>

              <label>
                <span className="text-xs font-medium text-neutral-500">
                  Interest rate %
                </span>

                <InvestmentNumericInput value={values.interestRatePercentage} onCommit={(value) => setValues((current) => ({ ...current, interestRatePercentage: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.interestRatePercentage} label="interestRatePercentage" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="interestRatePercentage" />
              </label>

              <label className="sm:col-span-2">
                <span className="text-xs font-medium text-neutral-500">
                  Loan term in years
                </span>

                <InvestmentNumericInput value={values.loanTermYears} onCommit={(value) => setValues((current) => ({ ...current, loanTermYears: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.loanTermYears} label="loanTermYears" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="loanTermYears" />
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

                <InvestmentNumericInput value={values.closingCosts} onCommit={(value) => setValues((current) => ({ ...current, closingCosts: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.closingCosts} label="closingCosts" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="closingCosts" />
              </label>

              <label>
                <span className="text-xs font-medium text-neutral-500">
                  Furnishing budget
                </span>

                <InvestmentNumericInput value={values.furnishingBudget} onCommit={(value) => setValues((current) => ({ ...current, furnishingBudget: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.furnishingBudget} label="furnishingBudget" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="furnishingBudget" />
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

                <InvestmentNumericInput value={values.monthlyLease} onCommit={(value) => setValues((current) => ({ ...current, monthlyLease: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.monthlyLease} label="monthlyLease" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="monthlyLease" />
                <span className="mt-1.5 block text-xs text-neutral-500">Source: User supplied. Market rent is shown separately.</span>
              </label>

              <label>
                <span className="text-xs font-medium text-neutral-500">
                  Lease term in months
                </span>

                <InvestmentNumericInput value={values.leaseTermMonths} onCommit={(value) => setValues((current) => ({ ...current, leaseTermMonths: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.leaseTermMonths} label="leaseTermMonths" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="leaseTermMonths" />
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

                <InvestmentNumericInput value={values.securityDeposit} onCommit={(value) => setValues((current) => ({ ...current, securityDeposit: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.securityDeposit} label="securityDeposit" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="securityDeposit" />
              </label>

              <label>
                <span className="text-xs font-medium text-neutral-500">
                  Startup costs
                </span>

                <InvestmentNumericInput value={values.startupCosts} onCommit={(value) => setValues((current) => ({ ...current, startupCosts: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.startupCosts} label="startupCosts" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="startupCosts" />
              </label>

              <label className="sm:col-span-2">
                <span className="text-xs font-medium text-neutral-500">
                  Furnishing budget
                </span>

                <InvestmentNumericInput value={values.furnishingBudget} onCommit={(value) => setValues((current) => ({ ...current, furnishingBudget: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.furnishingBudget} label="furnishingBudget" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="furnishingBudget" />
              </label>
            </div>
          </section>
        </div>
      )}
    </AcquisitionSectionCard>
  );
}
