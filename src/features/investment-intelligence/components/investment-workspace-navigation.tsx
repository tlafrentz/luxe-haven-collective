const WORKSPACE_SECTIONS = [
  {
    id: "property",
    label: "Property",
    description: "Asset and acquisition",
  },
  {
    id: "operating-plan",
    label: "Operating plan",
    description: "Financing and assumptions",
  },
  {
    id: "revenue",
    label: "Revenue",
    description: "Performance assumptions",
  },
  {
    id: "analysis",
    label: "Analysis",
    description: "Returns, evidence, and risks",
  },
] as const;

export function InvestmentWorkspaceNavigation() {
  return (
    <nav
      aria-label="Investment workspace sections"
      className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
    >
      <ol className="grid divide-y divide-neutral-200 md:grid-cols-4 md:divide-x md:divide-y-0">
        {WORKSPACE_SECTIONS.map(
          (
            {
              id,
              label,
              description,
            },
            index,
          ) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="group flex h-full items-start gap-3 px-4 py-4 transition hover:bg-neutral-50 sm:px-5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-neutral-50 text-xs font-semibold text-neutral-700 transition group-hover:border-neutral-400 group-hover:bg-white">
                  {index + 1}
                </span>

                <span>
                  <span className="block text-sm font-semibold text-neutral-950">
                    {label}
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-neutral-500">
                    {description}
                  </span>
                </span>
              </a>
            </li>
          ),
        )}
      </ol>
    </nav>
  );
}
