import type { Metadata } from "next";
import Link from "next/link";
import { FurnishingFindMyFitQuiz } from "./find-my-fit-quiz";

export const metadata: Metadata = {
  title: "Find My Best Fit",
  description:
    "Answer a few questions about your property and we'll recommend the right Furnishing Studio package.",
};

export default function FurnishingFindMyFitPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="py-16">
        <div className="container-shell max-w-2xl">
          <nav className="text-xs text-stone-500">
            <Link href="/furnishing">Furnishing Studio</Link>
            <span className="mx-2">›</span>
            <span>Find My Best Fit</span>
          </nav>
          <h1 className="mt-6 text-center font-serif text-4xl md:text-5xl">
            Answer a few questions and we&apos;ll recommend the right
            package.
          </h1>
          <p className="mt-4 text-center text-lg text-stone-600">
            Tell us about your property, budget, and timeline.
          </p>
          <div className="mt-9">
            <FurnishingFindMyFitQuiz />
          </div>
        </div>
      </section>
    </main>
  );
}
