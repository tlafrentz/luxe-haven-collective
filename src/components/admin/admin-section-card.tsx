import type { ReactNode } from "react";

type AdminSectionCardProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function AdminSectionCard({
  title,
  description,
  children,
  className = "",
}: AdminSectionCardProps) {
  return (
    <section
      className={`rounded-xl border border-stone-200 bg-white p-6 shadow-sm ${className}`}
    >
      {title || description ? (
        <div className="mb-6">
          {title ? <h2 className="text-base font-semibold text-stone-950">{title}</h2> : null}
          {description ? (
            <p className="mt-1 text-sm leading-6 text-stone-500">{description}</p>
          ) : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}
