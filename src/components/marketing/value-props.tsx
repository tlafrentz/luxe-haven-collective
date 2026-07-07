const items = [
  ["Guest-first operations", "Responsive communication, smooth arrivals, and thoughtful stay details that drive stronger reviews."],
  ["Revenue-minded strategy", "Positioning, pricing, and listing optimization designed to improve performance without sacrificing brand quality."],
  ["Owner clarity", "Clean reporting, maintenance visibility, and a portal foundation for property performance snapshots."]
];

export function ValueProps() {
  return (
    <section className="bg-[#171412] py-20 text-primary-foreground">
      <div className="container-shell grid gap-6 md:grid-cols-3">
        {items.map(([title, copy]) => (
          <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="mt-4 text-sm leading-6 text-primary-foreground/70">{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
