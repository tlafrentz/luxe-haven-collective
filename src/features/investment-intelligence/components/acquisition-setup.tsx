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
              Phase 1
            </p>

            <h2
              id="acquisition-setup-title"
              className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950"
            >
              Acquisition setup
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
              Everything below defines the opportunity and the operating case.
            </p>
          </div>

          <div className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm">
            Edit mode
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <PropertyProfileCard />
        <FinancingCard />
        <RevenueAssumptionsCard />
        <OperatingPlanCard />
      </div>
    </section>
  );
}
