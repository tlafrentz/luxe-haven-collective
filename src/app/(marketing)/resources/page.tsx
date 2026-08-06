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

const icons = [BookOpen, Lightbulb, BookOpen, LayoutTemplate, BarChart3, CircleHelp];

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
        <div className="container-shell grid min-h-[500px] overflow-hidden lg:grid-cols-[.85fr_1.15fr]">
          <div className="relative z-10 flex flex-col justify-center py-14 lg:pr-12">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
              Resources
            </p>
            <h1 className="mt-5 max-w-xl font-serif text-5xl leading-[1.08] md:text-6xl">
              Knowledge for better hospitality outcomes.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-stone-600">
              Actionable publications, proven playbooks, and operational tools
              to help owners and operators run stronger businesses.
            </p>
            <form
              action="/resources/insights"
              className="relative mt-7 max-w-lg"
            >
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-stone-500" />
              <input
                name="q"
                aria-label="Search resources"
                placeholder="Search resources..."
                className="min-h-13 w-full rounded-lg border bg-white pl-12 pr-4 shadow-sm"
              />
            </form>
          </div>
          <div className="relative min-h-[360px]">
            <div className="absolute inset-y-0 -left-20 z-10 hidden w-40 bg-gradient-to-r from-[#fffdf9] to-transparent lg:block" />
            <SafeImage
              src={mesaAirbnbImages[0]}
              alt="Luxe Haven hospitality property"
              fill
              priority
              className="object-cover"
              sizes="58vw"
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
              Get fresh insights, playbooks, and market reports delivered to your inbox.
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
