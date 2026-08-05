import Link from "next/link";
import { SafeImage } from "@/components/shared/safe-image";
import { ResourcesNavigation } from "./resources-navigation";
import { mesaAirbnbImages } from "@/lib/mesa-airbnb";

type Card = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
  image?: string;
};

export function ResourcePage({
  active,
  eyebrow,
  title,
  description,
  cards,
  categories = [],
}: {
  active: string;
  eyebrow: string;
  title: string;
  description: string;
  cards: Card[];
  categories?: string[];
}) {
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b">
        <div className="container-shell grid min-h-[330px] gap-8 py-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
              {eyebrow}
            </p>
            <h1 className="mt-5 max-w-xl font-serif text-5xl leading-[1.08] md:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-stone-600">
              {description}
            </p>
          </div>
          <div className="relative hidden h-[270px] overflow-hidden rounded-xl lg:block">
            <SafeImage
              src={
                mesaAirbnbImages[
                  active === "Insights" ? 1 : active === "Templates" ? 2 : 0
                ]
              }
              alt="Luxe Haven hospitality resource collection"
              fill
              priority
              className="object-cover"
              sizes="55vw"
            />
          </div>
        </div>
      </section>
      <ResourcesNavigation active={active} />
      {categories.length ? (
        <div className="container-shell flex flex-wrap gap-2 py-7">
          {categories.map((category, index) => (
            <span
              key={category}
              className={
                index === 0
                  ? "rounded-full bg-emerald-950 px-4 py-2 text-xs text-white"
                  : "rounded-full border bg-white px-4 py-2 text-xs text-stone-600"
              }
            >
              {category}
            </span>
          ))}
        </div>
      ) : null}
      <section className="pb-16 pt-8">
        <div className="container-shell grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card, index) => (
            <article
              key={card.title}
              className="overflow-hidden rounded-xl border bg-white"
            >
              <div className="relative aspect-[1.55/1]">
                <SafeImage
                  src={
                    card.image ??
                    mesaAirbnbImages[index % mesaAirbnbImages.length]
                  }
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(min-width:1280px) 25vw,50vw"
                />
              </div>
              <div className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#a56b19]">
                  {card.eyebrow}
                </p>
                <h2 className="mt-3 font-serif text-2xl leading-tight">
                  {card.title}
                </h2>
                <p className="mt-3 text-xs leading-5 text-stone-600">
                  {card.description}
                </p>
                <Link
                  href={card.href}
                  className="mt-6 inline-flex text-xs font-semibold text-emerald-800"
                >
                  {card.action} →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="pb-16">
        <div className="container-shell flex flex-wrap items-center justify-between gap-5 rounded-xl bg-emerald-950 p-8 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-[#d6a04c]">
              Stay informed
            </p>
            <h2 className="mt-2 font-serif text-3xl">
              Practical hospitality resources, delivered thoughtfully.
            </h2>
          </div>
          <Link
            href="/contact?service=general"
            className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-emerald-950"
          >
            Join the conversation →
          </Link>
        </div>
      </section>
    </main>
  );
}
