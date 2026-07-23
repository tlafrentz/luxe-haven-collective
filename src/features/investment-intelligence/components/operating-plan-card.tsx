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

                <InvestmentNumericInput value={values.managementFeePercentage} onCommit={(value) => setValues((current) => ({ ...current, managementFeePercentage: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.managementFeePercentage} label="managementFeePercentage" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="managementFeePercentage" />
              </label>

              <label>
                <span className="text-xs font-medium text-neutral-500">
                  Utilities per month
                </span>

                <InvestmentNumericInput value={values.monthlyUtilities} onCommit={(value) => setValues((current) => ({ ...current, monthlyUtilities: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.monthlyUtilities} label="monthlyUtilities" disabled={!isPurchase && values.utilitiesIncluded} className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="monthlyUtilities" />

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

                <InvestmentNumericInput value={values.annualInsurance} onCommit={(value) => setValues((current) => ({ ...current, annualInsurance: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.annualInsurance} label="annualInsurance" className={INPUT_CLASS_NAME} />
              </label>

              {isPurchase ? (
                <label>
                  <span className="text-xs font-medium text-neutral-500">
                    Property taxes per year
                  </span>

                  <InvestmentNumericInput value={values.annualTaxes} onCommit={(value) => setValues((current) => ({ ...current, annualTaxes: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.annualTaxes} label="annualTaxes" className={INPUT_CLASS_NAME} />
                </label>
              ) : null}

              <label>
                <span className="text-xs font-medium text-neutral-500">
                  Cleaning per year
                </span>

                <InvestmentNumericInput value={values.annualCleaning} onCommit={(value) => setValues((current) => ({ ...current, annualCleaning: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.annualCleaning} label="annualCleaning" className={INPUT_CLASS_NAME} />
<AssumptionFieldGuidance id="annualCleaning" />
              </label>

              <label>
                <span className="text-xs font-medium text-neutral-500">
                  Software per year
                </span>

                <InvestmentNumericInput value={values.annualSoftware} onCommit={(value) => setValues((current) => ({ ...current, annualSoftware: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.annualSoftware} label="annualSoftware" className={INPUT_CLASS_NAME} />
              </label>

              <label className="sm:col-span-2">
                <span className="text-xs font-medium text-neutral-500">
                  Supplies per year
                </span>

                <InvestmentNumericInput value={values.annualSupplies} onCommit={(value) => setValues((current) => ({ ...current, annualSupplies: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.annualSupplies} label="annualSupplies" className={INPUT_CLASS_NAME} />
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

                <InvestmentNumericInput value={values.maintenanceReservePercentage} onCommit={(value) => setValues((current) => ({ ...current, maintenanceReservePercentage: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.maintenanceReservePercentage} label="maintenanceReservePercentage" className={INPUT_CLASS_NAME} />
              </label>

              <label>
                <span className="text-xs font-medium text-neutral-500">
                  Capital reserve %
                </span>

                <InvestmentNumericInput value={values.capitalReservePercentage} onCommit={(value) => setValues((current) => ({ ...current, capitalReservePercentage: value }))} policy={INVESTMENT_NUMERIC_ASSUMPTION_POLICIES.capitalReservePercentage} label="capitalReservePercentage" className={INPUT_CLASS_NAME} />
              </label>
            </div>
          </section>
        </div>
      </AcquisitionSectionCard>
    </div>
  );
}
