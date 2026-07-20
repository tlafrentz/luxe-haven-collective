import {
  BadgeDollarSign,
  Building2,
  CircleGauge,
  UserRound,
} from "lucide-react";

import type {
  ExecutionWorkspace,
} from "../domain";

type ExecutionMetadataProps = {
  workspace: ExecutionWorkspace;
};

function capitalize(value?: string) {
  if (!value) {
    return "Not available";
  }

  return value
    .split("-")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}

export function ExecutionMetadata({
  workspace,
}: ExecutionMetadataProps) {
  const items = [
    {
      label: "Owner",
      value:
        workspace.metadata.ownerName,
      icon: UserRound,
    },
    {
      label: "Scope",
      value:
        workspace.metadata.propertyId
          ? "Property"
          : "Portfolio",
      icon: Building2,
    },
    {
      label: "Expected impact",
      value:
        workspace.metadata
          .expectedImpact ??
        "Not estimated",
      icon: BadgeDollarSign,
    },
    {
      label: "Confidence",
      value: capitalize(
        workspace.metadata.confidence,
      ),
      icon: CircleGauge,
    },
  ];

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
        Execution details
      </p>

      <dl className="mt-5 space-y-5">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="flex items-start justify-between gap-5"
            >
              <dt className="flex items-center gap-2 text-xs text-stone-500">
                <Icon className="h-4 w-4" />
                {item.label}
              </dt>

              <dd className="text-right text-sm font-semibold text-stone-950">
                {item.value}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
