import type { ReactNode } from "react";

type SectionCardProps = {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function SectionCard({ id, title, description, children }: SectionCardProps) {
  return (
    <section
      id={id}
      className="scroll-mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6"
    >
      <div className="mb-6">
        <h2 className="font-serif text-3xl text-white">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">{description}</p>
        ) : null}
      </div>

      {children}
    </section>
  );
}
