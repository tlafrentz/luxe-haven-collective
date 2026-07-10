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
      className={`rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 ${className}`}
    >
      {title || description ? (
        <div className="mb-6">
          {title ? <h2 className="font-serif text-3xl text-white">{title}</h2> : null}
          {description ? (
            <p className="mt-2 text-sm leading-6 text-white/50">{description}</p>
          ) : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}
