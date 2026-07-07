export function PageHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="luxury-gradient border-b border-border py-20 md:py-28">
      <div className="container-shell max-w-4xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">{eyebrow}</p>
        <h1 className="mt-5 font-serif text-5xl leading-tight text-balance md:text-7xl">{title}</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">{description}</p>
      </div>
    </section>
  );
}
