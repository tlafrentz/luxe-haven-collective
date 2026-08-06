import Link from "next/link";
import { BookOpen, FileText, Search } from "lucide-react";
import { SafeImage } from "@/components/shared/safe-image";
import { mesaAirbnbImages } from "@/lib/mesa-airbnb";

type Card = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
  image?: string;
  category?: string;
  meta?: string;
};
export function ResourcePage({
  active,
  title,
  description,
  cards,
  categories = [],
  activeCategory,
  basePath,
  hideBottomBand = false,
  searchQuery,
}: {
  active: string;
  eyebrow: string;
  title: string;
  description: string;
  cards: Card[];
  categories?: string[];
  activeCategory?: string;
  basePath?: string;
  hideBottomBand?: boolean;
  searchQuery?: string;
}) {
  const playbooks = active === "Playbooks";
  const templates = active === "Templates";
  const markets = active === "Market Reports";
  const insights = active === "Insights";
  const resolvedActiveCategory = activeCategory ?? categories[0];
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b py-10">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/resources">Resources</Link>
            <span className="mx-2">›</span>
            <span>{active}</span>
          </nav>
          <h1 className="mt-6 font-serif text-5xl">{title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">
            {description}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2">
            {categories.map((category, index) => {
              const isActive = category === resolvedActiveCategory;
              const href =
                index === 0
                  ? (basePath ?? "#")
                  : `${basePath ?? "#"}?category=${encodeURIComponent(category)}`;
              return (
                <Link
                  key={category}
                  href={href}
                  aria-current={isActive ? "true" : undefined}
                  className={
                    isActive
                      ? "rounded-md bg-emerald-950 px-4 py-2 text-xs text-white"
                      : "rounded-md border bg-white px-4 py-2 text-xs text-stone-600 hover:border-stone-400"
                  }
                >
                  {category}
                </Link>
              );
            })}
            {insights ? (
              <form
                action="/resources/insights"
                className="relative ml-auto hidden md:block"
              >
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                <input
                  name="q"
                  aria-label="Search insights"
                  placeholder="Search insights"
                  defaultValue={searchQuery}
                  className="rounded-md border bg-white py-2 pl-9 pr-3 text-xs"
                />
              </form>
            ) : null}
          </div>
        </div>
      </section>
      <section className="py-12">
        <div
          className={
            playbooks || templates
              ? "container-shell grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              : "container-shell grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          }
        >
          {cards.map((card, index) => (
            <article
              key={card.title}
              className={`${playbooks || templates || markets ? "flex" : "flex flex-col"} overflow-hidden rounded-xl border bg-white`}
            >
              {playbooks ? (
                <div className="flex w-28 shrink-0 items-center justify-center bg-[#f1ece1] p-4">
                  <div
                    className={
                      index % 2
                        ? "grid aspect-[.7/1] w-full place-items-center rounded-sm bg-[#e8dfcf] p-2 text-center text-[8px] font-bold uppercase text-stone-700 shadow-lg"
                        : "grid aspect-[.7/1] w-full place-items-center rounded-sm bg-emerald-950 p-2 text-center text-[8px] font-bold uppercase text-white shadow-lg"
                    }
                  >
                    {card.title}
                  </div>
                </div>
              ) : templates ? (
                <div className="flex w-28 shrink-0 items-center justify-center bg-stone-50">
                  <FileText className="size-14 text-stone-400" />
                </div>
              ) : (
                <div
                  className="relative w-full shrink-0 self-start"
                  style={{ maxWidth: markets ? "45%" : "100%" }}
                >
                  <div className="relative aspect-[1.7/1]">
                    <SafeImage
                      src={
                        card.image ??
                        mesaAirbnbImages[index % mesaAirbnbImages.length]
                      }
                      alt=""
                      fill
                      className="object-cover"
                      sizes="33vw"
                    />
                  </div>
                </div>
              )}
              <div
                className={
                  playbooks || templates || markets
                    ? "flex min-w-0 flex-1 flex-col p-5"
                    : "p-5"
                }
              >
                {!playbooks && !templates && !markets ? (
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#a56b19]">
                    {card.eyebrow}
                  </p>
                ) : null}
                <h2 className="font-serif text-xl leading-tight">
                  {card.title}
                </h2>
                <p className="mt-3 flex-1 text-xs leading-5 text-stone-600">
                  {card.description}
                </p>
                {insights && card.meta ? (
                  <p className="mt-3 text-[11px] text-stone-500">{card.meta}</p>
                ) : null}
                <Link
                  href={card.href}
                  className="mt-5 inline-flex text-xs font-semibold text-emerald-800"
                >
                  {card.action} →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      {hideBottomBand ? null : (
        <section className="pb-14">
          <div className="container-shell flex flex-wrap items-center justify-between gap-5 rounded-xl border bg-[#f8f4eb] p-7">
            <div>
              <BookOpen className="size-6 text-emerald-800" />
              <h2 className="mt-3 font-serif text-2xl">
                {markets
                  ? "Want a market that’s not listed?"
                  : templates
                    ? "Need a custom template?"
                    : playbooks
                      ? "Need something custom?"
                      : "Looking for a specific insight?"}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Tell us what you need and we’ll help identify the right resource.
              </p>
            </div>
            <Link
              href="/contact?service=general"
              className="rounded-md bg-emerald-950 px-5 py-3 text-sm font-semibold text-white"
            >
              Contact us →
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
