import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  CircleHelp,
  LayoutTemplate,
  Lightbulb,
  Search,
} from "lucide-react";
import { SafeImage } from "@/components/shared/safe-image";
import { mesaAirbnbImages } from "@/lib/mesa-airbnb";
import { resourceLinks } from "@/components/marketing/resources-navigation";
import { NewsletterSignupForm } from "@/components/marketing/newsletter-signup-form";
import { insightsCards } from "@/lib/insights";

const icons = [
  BookOpen,
  Lightbulb,
  BookOpen,
  LayoutTemplate,
  BarChart3,
  CircleHelp,
];

const featuredTitles = [
  "How to Price for Events Without Losing Weekday Bookings",
  "The Small Touches That Drive 5-Star Reviews",
  "Turnover Checklists That Protect Quality",
  "What Investors Look for in Short-Term Rentals",
];

const cards = featuredTitles
  .map((title) => insightsCards.find((card) => card.title === title))
  .filter((card): card is (typeof insightsCards)[number] => Boolean(card));

export default function ResourcesPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b">
        <div className="container-shell grid gap-10 py-12 lg:min-h-[560px] lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-16">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
              Resources
            </p>
            <h1 className="mt-5 max-w-[10ch] font-serif text-5xl leading-[1.04] md:text-6xl">
              Knowledge for better hospitality outcomes.
            </h1>
            <p className="mt-6 max-w-md text-base leading-8 text-stone-600">
              Actionable publications, proven playbooks, and operational tools
              to help owners and operators run stronger businesses.
            </p>
            <form
              action="/resources/insights"
              className="relative mt-8 w-full max-w-md"
            >
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-stone-500" />
              <input
                name="q"
                aria-label="Search resources"
                placeholder="Search resources..."
                className="min-h-13 w-full rounded-xl border border-stone-300 bg-white pl-12 pr-4 shadow-sm outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15"
              />
            </form>
          </div>
          <div className="relative min-h-[360px] overflow-hidden rounded-2xl shadow-sm lg:min-h-[480px]">
            <SafeImage
              src={mesaAirbnbImages[0]}
              alt="Luxe Haven hospitality property"
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
        </div>
      </section>
      <nav aria-label="Resource categories" className="border-b bg-white">
        <div className="container-shell grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {resourceLinks.slice(1).map(([label, href], index) => {
            const Icon = icons[index + 1];
            return (
              <Link
                key={href}
                href={href}
                className={
                  index === 0
                    ? "border-b-2 border-emerald-800 px-3 py-7 text-center text-emerald-900"
                    : "px-3 py-7 text-center text-stone-700 hover:bg-stone-50"
                }
              >
                <Icon className="mx-auto size-6" />
                <span className="mt-3 block text-sm font-semibold">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
      <section className="py-14">
        <div className="container-shell">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-3xl">Featured this week</h2>
            <Link
              href="/resources/insights"
              className="text-sm font-semibold text-emerald-800"
            >
              View all Insights →
            </Link>
          </div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card, index) => (
              <Link
                key={card.title}
                href={card.href}
                className="group overflow-hidden rounded-xl border bg-white"
              >
                <div className="relative aspect-[1.55/1]">
                  <SafeImage
                    src={
                      mesaAirbnbImages[(index + 1) % mesaAirbnbImages.length]
                    }
                    alt=""
                    fill
                    className="object-cover transition group-hover:scale-[1.02]"
                    sizes="25vw"
                  />
                </div>
                <div className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#a56b19]">
                    {card.eyebrow}
                  </p>
                  <h3 className="mt-3 font-serif text-2xl">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-stone-600">
                    {card.description}
                  </p>
                  <div className="mt-6 flex items-center justify-between text-xs text-stone-500">
                    <span>{card.meta}</span>
                    <span className="text-xl text-emerald-800">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="pb-14">
        <div className="container-shell flex flex-wrap items-center justify-between gap-6 rounded-xl bg-emerald-950 p-8 text-white">
          <div>
            <h2 className="font-serif text-3xl">Stay Informed</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/70">
              Get fresh insights, playbooks, and market reports delivered to
              your inbox.
            </p>
          </div>
          <div className="w-full max-w-md">
            <NewsletterSignupForm />
          </div>
        </div>
      </section>
    </main>
  );
}
