import Link from "next/link";
import type { Metadata } from "next";
import { SafeImage } from "@/components/shared/safe-image";
import { mesaAirbnbImages } from "@/lib/mesa-airbnb";
import { solutionJourneys, solutionLinks } from "@/lib/solution-journeys";
export const metadata: Metadata = {
  title: "Hospitality Solutions | Luxe Haven Collective",
  description:
    "Choose a connected Luxe Haven path for guest experience, investment, property launch, or hospitality operations.",
};
export default function SolutionsPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="py-16">
        <div className="container-shell">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            Solutions
          </p>
          <h1 className="mt-5 max-w-3xl font-serif text-6xl">
            One journey. Four paths. Better hospitality outcomes.
          </h1>
          <p className="mt-5 max-w-2xl text-stone-600">
            Start with the outcome you want. Each path connects package
            selection, secure checkout, activation, and the specialist workspace
            where value is delivered.
          </p>
        </div>
      </section>
      <section className="pb-16">
        <div className="container-shell grid gap-5 md:grid-cols-2">
          {solutionLinks.map(([label, href], index) => {
            const slug = href
              .split("/")
              .at(-1) as keyof typeof solutionJourneys;
            const solution = solutionJourneys[slug];
            return (
              <Link
                key={href}
                href={href}
                className="group overflow-hidden rounded-xl border bg-white"
              >
                <div className="relative aspect-[2/1]">
                  <SafeImage
                    src={mesaAirbnbImages[index]}
                    alt=""
                    fill
                    className="object-cover transition group-hover:scale-[1.02]"
                    sizes="50vw"
                  />
                </div>
                <div className="p-6">
                  <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">
                    {label}
                  </p>
                  <h2 className="mt-3 font-serif text-3xl">{solution.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-stone-600">
                    {solution.description}
                  </p>
                  <p className="mt-6 font-semibold text-emerald-800">
                    Explore solution →
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
