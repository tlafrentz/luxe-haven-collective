import Link from "next/link";
import { Eye, Search, Target, Zap, GraduationCap } from "lucide-react";

const stages = [
  [
    "Observe",
    "We capture clear signals across revenue, guests, and operations.",
    Eye,
  ],
  [
    "Understand",
    "We turn data into insight and identify what matters most.",
    Search,
  ],
  [
    "Decide",
    "We prioritize the highest-impact decisions for the property.",
    Target,
  ],
  [
    "Execute",
    "We implement with clarity, ownership, timelines, and evidence.",
    Zap,
  ],
  ["Learn", "We measure results and improve the next decision.", GraduationCap],
] as const;

export default function ApproachPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="py-16">
        <div className="container-shell">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            Our approach
          </p>
          <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-tight md:text-6xl">
            Hospitality is a system.
            <br />
            Not a collection of tasks.
          </h1>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-stone-600">
            Our Hospitality Performance Management framework helps independent
            owners build stronger businesses and unforgettable guest
            experiences.
          </p>
        </div>
      </section>
      <section className="pb-16">
        <div className="container-shell">
          <div className="grid gap-5 md:grid-cols-5">
            {stages.map(([title, text, Icon], index) => (
              <article
                key={title}
                className="relative rounded-xl border bg-white p-5"
              >
                <span className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-800">
                  <Icon className="size-6" />
                </span>
                <span className="absolute right-4 top-4 text-xs text-stone-400">
                  0{index + 1}
                </span>
                <h2 className="mt-5 font-semibold">{title}</h2>
                <p className="mt-3 text-xs leading-5 text-stone-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="pb-16">
        <div className="container-shell flex flex-wrap items-center justify-between gap-5 rounded-xl bg-emerald-900 px-8 py-8 text-white">
          <div>
            <p className="text-xs uppercase tracking-[.15em] text-[#d6a04c]">
              Ready to improve your property’s performance?
            </p>
            <h2 className="mt-2 font-serif text-3xl">
              Let’s build a plan that drives results.
            </h2>
          </div>
          <Link
            href="/get-started"
            className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-emerald-950"
          >
            Find Your Best Fit →
          </Link>
        </div>
      </section>
    </main>
  );
}
