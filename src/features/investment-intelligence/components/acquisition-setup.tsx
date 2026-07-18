import {
  AcquisitionTypeSelector,
} from "./acquisition-type-selector";

import {
  FinancingCard,
} from "./financing-card";

import {
  OperatingPlanCard,
} from "./operating-plan-card";

import {
  PropertyProfileCard,
} from "./property-profile-card";

import {
  RevenueAssumptionsCard,
} from "./revenue-assumptions-card";

export function AcquisitionSetup() {
  return (
    <section
      id="property"
      aria-labelledby="acquisition-setup-title"
      className="space-y-6"
    >
      <header className="border-b border-neutral-200 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Underwriting assumptions
            </p>

            <h2
              id="acquisition-setup-title"
              className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950"
            >
              Build the operating case
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
              Define the property, capital structure, revenue assumptions, and operating plan used to evaluate this opportunity.
            </p>
          </div>

          <div className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm">
            Editable assumptions
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <AcquisitionTypeSelector />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PropertyProfileCard />
        <FinancingCard />
        <RevenueAssumptionsCard />
        <OperatingPlanCard />
      </div>
    </section>
  );
}
