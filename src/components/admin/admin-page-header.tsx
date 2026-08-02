import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brass">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">{title}</h1>

        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-stone-600">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
