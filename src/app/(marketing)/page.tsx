import Link from "next/link";

import { CTASection } from "@/components/marketing/cta-section";
import { FeaturedProperties } from "@/components/marketing/featured-properties";
import { HeroSection } from "@/components/marketing/hero-section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { ValueProps } from "@/components/marketing/value-props";

const serviceGroups = [
  {
    number: "01",
    title: "Hospitality Management",
    description:
      "Thoughtful guest communication, turnover quality, maintenance coordination, and operating standards designed around a consistently elevated stay.",
    services: [
      "Guest communication",
      "Turnover coordination",
      "Maintenance workflows",
      "Owner communication",
    ],
  },
  {
    number: "02",
    title: "Revenue Optimization",
    description:
      "Conversion-focused listing strategy, pricing guidance, performance reviews, and market positioning that support stronger owner outcomes.",
    services: [
      "Listing optimization",
      "Pricing strategy",
      "Performance reviews",
      "Direct booking readiness",
    ],
  },
  {
    number: "03",
    title: "Hospitality Consulting",
    description:
      "Practical guidance for owners launching, improving, or scaling short-term rental operations with greater clarity and confidence.",
    services: [
      "STR launch planning",
      "Operations systems",
      "Guest experience design",
      "SOP development",
    ],
  },
  {
    number: "04",
    title: "Professional Services",
    description:
      "Responsive Texas mobile and remote online notary support for eligible personal, business, and real estate documents.",
    services: [
      "Mobile notary",
      "Remote online notarization",
      "Business documents",
      "Real estate documents",
    ],
  },
];

const process = [
  {
    number: "01",
    title: "Discover",
    description:
      "We learn the property, market, owner goals, operational challenges, and guest experience you want to create.",
  },
  {
    number: "02",
    title: "Optimize",
    description:
      "We identify opportunities across positioning, pricing, presentation, systems, amenities, and the guest journey.",
  },
  {
    number: "03",
    title: "Operate",
    description:
      "We bring clarity and consistency to communication, turnovers, maintenance, reporting, and day-to-day execution.",
  },
  {
    number: "04",
    title: "Grow",
    description:
      "We review performance, refine the strategy, and help the hospitality business improve over time.",
  },
];

const insights = [
  {
    category: "Owner Playbook",
    title: "STR Revenue Readiness Checklist",
    description:
      "A practical assessment for owners who want to understand where their property may be leaving revenue, reviews, or operational efficiency on the table.",
    href: "/lead-magnet",
    action: "Download the checklist",
  },
  {
    category: "Revenue Optimization",
    title: "Build a stronger listing before lowering your rate",
    description:
      "Learn how positioning, photography, amenities, and guest clarity can improve conversion before price becomes the only strategy.",
    href: "/resources",
    action: "Explore revenue insights",
  },
  {
    category: "Hospitality Operations",
    title: "Create consistency guests can feel",
    description:
      "Explore the systems, standards, and operating decisions that help create polished stays and stronger owner confidence.",
    href: "/resources",
    action: "Browse operational guidance",
  },
];

export default function HomePage() {
  return (
    <main>
      <HeroSection />

      <section className="border-b border-border py-20 md:py-28">
        <div className="container-shell grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
              Our philosophy
            </p>
          </div>

          <div>
            <h2 className="max-w-4xl font-serif text-4xl leading-tight md:text-6xl">
              Hospitality is more than managing a property.
            </h2>

            <div className="mt-8 grid gap-6 text-lg leading-8 text-muted-foreground md:grid-cols-2">
              <p>
                Every home tells a story. Every stay shapes a memory. Every
                operational decision influences an owner’s investment.
              </p>

              <p>
                Luxe Haven Collective helps owners build hospitality businesses
                that guests remember, teams can operate consistently, and
                investments can grow with greater confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      <ValueProps />

      <section className="bg-muted/40 py-20 md:py-28">
        <div className="container-shell">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <SectionHeading
              eyebrow="What we do"
              title="A connected hospitality system for owners who care about the details."
              description="From listing strategy to operational execution, every service is designed to strengthen the guest experience and support better owner decisions."
            />

            <p className="max-w-xl text-sm leading-7 text-muted-foreground lg:justify-self-end">
              Engage Luxe Haven for focused consulting, hands-on operational
              support, or a broader hospitality partnership shaped around your
              property and goals.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {serviceGroups.map((group) => (
              <article
                key={group.title}
                className="rounded-[2rem] border border-border bg-background p-7 md:p-9"
              >
                <div className="flex items-start justify-between gap-5">
                  <p className="text-sm font-semibold text-accent">
                    {group.number}
                  </p>

                  <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Luxe Haven
                  </span>
                </div>

                <h3 className="mt-8 font-serif text-3xl md:text-4xl">
                  {group.title}
                </h3>

                <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
                  {group.description}
                </p>

                <div className="mt-7 flex flex-wrap gap-2">
                  {group.services.map((service) => (
                    <span
                      key={service}
                      className="rounded-full bg-muted px-4 py-2 text-sm font-medium"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/services"
              className="inline-flex rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold transition hover:bg-muted"
            >
              Explore All Services
            </Link>
          </div>
        </div>
      </section>

      <FeaturedProperties />

      <section className="border-y border-border bg-[#171412] py-20 text-white md:py-28">
        <div className="container-shell">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
                How we work
              </p>

              <h2 className="mt-5 max-w-xl font-serif text-4xl leading-tight md:text-6xl">
                A clear path from opportunity to performance.
              </h2>

              <p className="mt-6 max-w-xl leading-8 text-white/60">
                Our process keeps strategy connected to execution, so owners
                understand what is changing, why it matters, and what happens
                next.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              {process.map((step) => (
                <article
                  key={step.number}
                  className="border-t border-white/15 pt-6"
                >
                  <p className="text-sm font-semibold text-accent">
                    {step.number}
                  </p>

                  <h3 className="mt-4 font-serif text-3xl">{step.title}</h3>

                  <p className="mt-4 text-sm leading-7 text-white/55">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="container-shell">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              eyebrow="Luxe Insights"
              title="Practical intelligence for better hospitality decisions."
              description="Owner playbooks, revenue guidance, operational systems, and market insights designed to make complex decisions easier."
            />

            <Link
              href="/resources"
              className="shrink-0 text-sm font-semibold uppercase tracking-[0.18em] text-accent"
            >
              Browse Luxe Insights →
            </Link>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {insights.map((insight, index) => (
              <article
                key={insight.title}
                className={`flex min-h-[360px] flex-col rounded-[2rem] border p-7 ${
                  index === 0
                    ? "border-[#171412] bg-[#171412] text-white"
                    : "border-border bg-card"
                }`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.22em] ${
                    index === 0 ? "text-accent" : "text-muted-foreground"
                  }`}
                >
                  {insight.category}
                </p>

                <h3 className="mt-6 font-serif text-3xl leading-tight">
                  {insight.title}
                </h3>

                <p
                  className={`mt-5 text-sm leading-7 ${
                    index === 0
                      ? "text-white/60"
                      : "text-muted-foreground"
                  }`}
                >
                  {insight.description}
                </p>

                <Link
                  href={insight.href}
                  className={`mt-auto pt-8 text-sm font-semibold ${
                    index === 0 ? "text-white" : "text-foreground"
                  }`}
                >
                  {insight.action} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title="Ready to build a better hospitality business?"
        description="Let’s identify the clearest opportunities to strengthen your property, guest experience, operations, and owner performance."
      />
    </main>
  );
}
