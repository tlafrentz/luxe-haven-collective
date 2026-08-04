import Link from "next/link";
import type { PublicJourney } from "@/features/public-experience/journeys";

export function SolutionCard({ journey }: { journey: PublicJourney }) {
  return (
    <article className="group flex h-full flex-col rounded-[2rem] border border-[#d9dfda] bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a67610]">
        {journey.eyebrow}
      </p>
      <h2 className="mt-5 font-serif text-3xl text-[#161a17]">
        {journey.title}
      </h2>
      <p className="mt-4 flex-1 leading-7 text-[#5f6963]">{journey.promise}</p>
      <p className="mt-7 text-sm font-semibold text-[#074e38]">
        Powered by {journey.capability}
      </p>
      <Link
        href={`/solutions/${journey.slug}`}
        className="mt-4 inline-flex min-h-11 items-center font-semibold text-[#074e38]"
      >
        View full solution{" "}
        <span aria-hidden className="ml-2">
          →
        </span>
      </Link>
    </article>
  );
}
