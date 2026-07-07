import { cn } from "@/lib/utils";

export function SectionHeading({ eyebrow, title, description, className }: { eyebrow?: string; title: string; description?: string; className?: string }) {
  return (
    <div className={cn("max-w-3xl", className)}>
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">{eyebrow}</p>}
      <h2 className="mt-4 font-serif text-4xl leading-tight text-balance md:text-6xl">{title}</h2>
      {description && <p className="mt-5 text-lg leading-8 text-muted-foreground">{description}</p>}
    </div>
  );
}
