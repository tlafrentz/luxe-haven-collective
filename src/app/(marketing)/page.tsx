import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Clock3,
  FileText,
  House,
  Medal,
  Settings,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
} from "lucide-react";
import { HeroSection } from "@/components/marketing/hero-section";
import { SafeImage } from "@/components/shared/safe-image";
import { getPublishedProperties, propertyImage } from "@/lib/properties";

const goals = [
  [
    "Increase Revenue",
    "Optimize pricing, listings, and performance to grow profits.",
    "/solutions/revenue",
    TrendingUp,
  ],
  [
    "Improve Guest Experience",
    "Deliver exceptional stays that drive five-star reviews.",
    "/solutions/guest-experience",
    Sparkles,
  ],
  [
    "Launch a Property",
    "Get your short-term rental market-ready with confidence.",
    "/solutions/property-launch",
    House,
  ],
  [
    "Operate Better",
    "Streamline operations, save time, and reduce owner stress.",
    "/solutions/operations",
    Clock3,
  ],
  [
    "Invest Smarter",
    "Make better decisions with data, trends, and market intelligence.",
    "/solutions/investment",
    BarChart3,
  ],
] as const;

const solutions = [
  [
    "01",
    "Hospitality Management",
    "End-to-end operations including guest communication, turnovers, maintenance, and owner reporting.",
    [
      "Guest communication",
      "Turnover coordination",
      "Maintenance workflows",
      "Owner communication",
    ],
    "/solutions/operations",
    UserRoundCheck,
  ],
  [
    "02",
    "Revenue Optimization",
    "Data-driven pricing, listing strategy, and performance reviews that maximize revenue.",
    [
      "Listing optimization",
      "Pricing strategy",
      "Performance reviews",
      "Direct booking readiness",
    ],
    "/solutions/revenue",
    TrendingUp,
  ],
  [
    "03",
    "Hospitality Consulting",
    "Expert guidance to launch, improve, or scale your short-term rental business.",
    [
      "STR launch planning",
      "Operations systems",
      "Guest experience design",
      "SOP development",
    ],
    "/solutions/property-launch",
    BookOpen,
  ],
  [
    "04",
    "Professional Services",
    "Texas mobile and remote online notary services for personal, business, and real estate documents.",
    [
      "Mobile notary",
      "Remote online notarization",
      "Business documents",
      "Real estate documents",
    ],
    "/notary",
    FileText,
  ],
] as const;

const process = [
  [
    "01",
    "Discover",
    "We learn the property, market, and your goals to understand the full opportunity.",
  ],
  [
    "02",
    "Plan",
    "We build a tailored strategy across pricing, positioning, systems, and guest experience.",
  ],
  [
    "03",
    "Operate",
    "We execute with consistency and care across daily operations, communication, and reporting.",
  ],
  [
    "04",
    "Grow",
    "We review performance, refine the strategy, and help your business improve over time.",
  ],
] as const;

const insights = [
  [
    "Owner Playbook",
    "STR Revenue Readiness Checklist",
    "A practical assessment to find revenue, review, and operational opportunities.",
    "/lead-magnet",
    "Download the checklist",
  ],
  [
    "Revenue Optimization",
    "Build a stronger listing before lowering your rate",
    "Learn how positioning, photography, amenities, and clarity improve conversion.",
    "/resources",
    "Explore insights",
  ],
  [
    "Operations",
    "Create consistency guests can feel",
    "Explore the systems and standards that create polished stays and owner confidence.",
    "/resources",
    "Explore insights",
  ],
] as const;

export default async function HomePage() {
  const properties = (await getPublishedProperties()).slice(0, 3);
  return (
    <main className="bg-[#fffdf9] text-[#17231d]">
      <HeroSection />

      <section className="border-y border-[#e8e1d7] bg-[#faf6ef] py-12">
        <div className="container-shell grid gap-8 lg:grid-cols-[1.15fr_2fr] lg:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#a56b19]">
              Our philosophy
            </p>
            <h2 className="mt-4 max-w-md font-serif text-3xl leading-tight md:text-4xl">
              What is Hospitality Performance Management?
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-stone-600">
              It’s the connected system behind every exceptional stay and
              successful hospitality business. We combine data, experience, and
              operational discipline to help owners grow with confidence.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                "Data-Driven",
                "Real-time insights that improve revenue and operational performance.",
                BarChart3,
              ],
              [
                "Guest-Centered",
                "Experiences designed to delight guests and earn five-star reviews.",
                UserRoundCheck,
              ],
              [
                "Operator-Built",
                "Tools, playbooks, and systems created by real hospitality operators.",
                Settings,
              ],
              [
                "Results Focused",
                "Clear strategies that drive measurable owner outcomes.",
                Medal,
              ],
            ].map(([title, text, Icon]) => {
              const Mark = Icon as typeof BarChart3;
              return (
                <article key={String(title)}>
                  <span className="grid size-12 place-items-center rounded-full bg-[#f3eadb] text-[#174c3a]">
                    <Mark className="size-6" />
                  </span>
                  <h3 className="mt-4 font-semibold">{String(title)}</h3>
                  <p className="mt-2 text-xs leading-5 text-stone-600">
                    {String(text)}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell text-center">
          <h2 className="font-serif text-4xl">What is your next goal?</h2>
          <p className="mt-2 text-sm text-stone-600">
            Choose what matters most right now. We’ll show you how we can help.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {goals.map(([title, text, href, Icon]) => (
              <Link
                key={title}
                href={href}
                className="group rounded-xl border bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <Icon className="mx-auto size-9 text-[#174c3a]" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-3 text-xs leading-5 text-stone-600">{text}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">
                  Learn more{" "}
                  <ArrowRight className="size-3 transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#eee7dd] bg-[#faf7f1] py-14">
        <div className="container-shell grid gap-8 lg:grid-cols-[.72fr_2.28fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#a56b19]">
              Our solutions
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-tight">
              A connected system for hospitality success.
            </h2>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              From strategy to execution, every solution strengthens the guest
              experience and owner performance.
            </p>
            <Link
              href="/solutions"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"
            >
              Explore all solutions <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {solutions.map(([number, title, text, bullets, href, Icon]) => (
              <Link
                key={title}
                href={href}
                className="rounded-xl border bg-white p-5 transition hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{number}</span>
                  <Icon className="size-6" />
                </div>
                <h3 className="mt-6 text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-xs leading-5 text-stone-600">{text}</p>
                <ul className="mt-4 space-y-2">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2 text-xs">
                      <Check className="mt-0.5 size-3 shrink-0 text-emerald-700" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell grid gap-8 lg:grid-cols-[.65fr_2.35fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#a56b19]">
              Featured properties
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-tight">
              Thoughtfully designed.
              <br />
              Expertly operated.
            </h2>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              See how our operational standards and design come together.
            </p>
            <Link
              href="/stays/mesa-downtown-retreat"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"
            >
              View all properties <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {properties.length ? (
              properties.map((property) => (
                <Link
                  key={property.id}
                  href={`/stays/${property.slug}`}
                  className="overflow-hidden rounded-xl border bg-white transition hover:shadow-lg"
                >
                  <div className="relative aspect-[16/10]">
                    <SafeImage
                      src={propertyImage(property)}
                      alt={property.name}
                      fill
                      className="object-cover"
                      sizes="(min-width:1024px) 25vw,100vw"
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] uppercase text-stone-500">
                      {property.city}, {property.state}
                    </p>
                    <h3 className="mt-1 font-semibold">{property.name}</h3>
                    <p className="mt-1 text-xs text-stone-600">
                      Sleeps {property.max_guests} · {property.bedrooms} bed ·{" "}
                      {property.bathrooms} bath
                    </p>
                    <p className="mt-3 font-semibold">
                      ${Number(property.nightly_rate).toLocaleString()}
                      <span className="text-xs font-normal text-stone-500">
                        {" "}
                        /night
                      </span>
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full rounded-xl border p-8 text-sm text-stone-600">
                Published properties will appear here when available.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-[#06452f] py-14 text-white">
        <div className="container-shell grid gap-10 lg:grid-cols-[.7fr_2.3fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#d5a34b]">
              Our process
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-tight">
              A clear path from hospitality to performance.
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Our proven process keeps strategy connected to execution—so owners
              know what’s changing, why it matters, and what happens next.
            </p>
            <Link
              href="/about"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold"
            >
              Learn more about our process <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {process.map(([number, title, text]) => (
              <article
                key={number}
                className="relative border-t border-[#d5a34b]/60 pt-6"
              >
                <span className="absolute -top-5 left-0 grid size-10 place-items-center rounded-full bg-[#c58b2e] font-semibold">
                  {number}
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-3 text-xs leading-5 text-white/70">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell grid gap-8 lg:grid-cols-[.7fr_2.3fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#a56b19]">
              Luxe insights
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-tight">
              Practical intelligence for better hospitality decisions.
            </h2>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              Actionable guides, playbooks, and insights to help you operate
              smarter and grow with confidence.
            </p>
            <Link
              href="/resources"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"
            >
              Browse all insights <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {insights.map(([category, title, text, href, action]) => (
              <Link
                key={title}
                href={href}
                className="flex min-h-64 flex-col rounded-xl border bg-white p-5 transition hover:shadow-lg"
              >
                <span className="w-fit rounded-full bg-stone-100 px-3 py-1 text-[10px] uppercase">
                  {category}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-xs leading-5 text-stone-600">{text}</p>
                <span className="mt-auto pt-6 text-xs font-semibold text-emerald-800">
                  {action} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#063b2b] py-10 text-white">
        <div className="container-shell flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#d5a34b]">
              Ready to get started?
            </p>
            <h2 className="mt-2 font-serif text-4xl">What’s your next move?</h2>
            <p className="mt-2 max-w-xl text-sm text-white/70">
              Let’s identify the clearest opportunities to strengthen your
              property, guest experience, operations, and performance.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="rounded-lg border border-[#b98b3d] px-6 py-4 font-semibold"
            >
              Talk with an Expert
            </Link>
            <Link
              href="/lead-magnet"
              className="rounded-lg border border-[#b98b3d] px-6 py-4 font-semibold"
            >
              Download Owner Checklist
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
