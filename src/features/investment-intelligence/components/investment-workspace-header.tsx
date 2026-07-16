export function InvestmentWorkspaceHeader() {
  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Investment Intelligence
        </p>

        <h1 className="mt-2 max-w-4xl text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
          Evaluate the acquisition before committing capital.
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
          Model the property, operating plan, market position,
          financial performance, risks, and supporting evidence
          behind an explainable acquisition recommendation.
        </p>
      </div>

      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Acquisition workspace
      </div>
    </header>
  );
}
