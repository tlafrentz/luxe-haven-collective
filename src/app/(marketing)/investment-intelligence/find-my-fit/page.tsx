import type { Metadata } from "next";
import Link from "next/link";
import { InvestmentFindMyFitQuiz } from "./find-my-fit-quiz";

export const metadata: Metadata = {
  title: "Find My Best Fit",
  description:
    "Answer a few questions about your situation and we'll recommend the right Investment Intelligence package.",
};

export default function InvestmentFindMyFitPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="py-16">
        <div className="container-shell max-w-2xl">
          <nav className="text-xs text-stone-500">
            <Link href="/investment-intelligence">Investment Intelligence</Link>
            <span className="mx-2">›</span>
            <span>Find My Best Fit</span>
          </nav>
          <h1 className="mt-6 text-center font-serif text-4xl md:text-5xl">
            Answer a few questions and we&apos;ll recommend the right
            package.
          </h1>
          <p className="mt-4 text-center text-lg text-stone-600">
            Tell us about the property and how you plan to use the analysis.
          </p>
          <div className="mt-9">
            <InvestmentFindMyFitQuiz />
          </div>
        </div>
      </section>
    </main>
  );
}
