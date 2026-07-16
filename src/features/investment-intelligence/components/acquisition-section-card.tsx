import type {
  ReactNode,
} from "react";

type AcquisitionSectionCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
};

export function AcquisitionSectionCard({
  eyebrow,
  title,
  description,
  icon,
  children,
}: AcquisitionSectionCardProps) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-7">
      <header className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-700">
          {icon}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            {eyebrow}
          </p>

          <h3 className="mt-2 text-lg font-semibold tracking-tight text-neutral-950">
            {title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-neutral-600">
            {description}
          </p>
        </div>
      </header>

      <div className="mt-6">
        {children}
      </div>
    </section>
  );
}
