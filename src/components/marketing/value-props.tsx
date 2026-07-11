import { SectionHeading } from "./section-heading";

const values = [
  {
    number: "01",
    title: "Boutique Hospitality",
    description:
      "Guest journeys, property presentation, amenities, and communication are shaped around comfort, clarity, and memorable stays.",
  },
  {
    number: "02",
    title: "Revenue Intelligence",
    description:
      "Positioning, pricing, conversion, occupancy, and demand are considered together so owners can make stronger performance decisions.",
  },
  {
    number: "03",
    title: "Operational Excellence",
    description:
      "Housekeeping standards, maintenance workflows, guest support, and owner reporting operate as one connected hospitality system.",
  },
  {
    number: "04",
    title: "Trusted Partnership",
    description:
      "Clear communication, proactive recommendations, and transparent follow-through create the confidence owners need from a long-term partner.",
  },
];

export function ValueProps() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-shell">
        <SectionHeading
          eyebrow="The Luxe Haven difference"
          title="Where hospitality, performance, and disciplined operations meet."
          description="We help owners move beyond fragmented hosting by connecting guest experience, revenue strategy, and property operations."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {values.map((value) => (
            <article
              key={value.title}
              className="group rounded-[2rem] border border-border bg-card p-7 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 md:p-9"
            >
              <div className="flex items-start justify-between gap-5">
                <p className="text-sm font-semibold text-accent">
                  {value.number}
                </p>

                <div className="h-10 w-10 rounded-full border border-border transition group-hover:border-accent/50 group-hover:bg-accent/10" />
              </div>

              <h3 className="mt-10 font-serif text-3xl md:text-4xl">
                {value.title}
              </h3>

              <p className="mt-5 max-w-xl leading-8 text-muted-foreground">
                {value.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
