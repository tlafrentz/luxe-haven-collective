import type { Metadata } from "next";
import { QuizWizard } from "@/features/best-fit-quiz/quiz-wizard";

export const metadata: Metadata = {
  title: "Find Your Best Fit",
  description:
    "Answer a few questions and get a personalized Hospitality Performance Platform plan recommendation. No account required.",
};

export default async function GetStartedPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;
  return (
    <main>
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <p className="text-sm font-bold uppercase tracking-[.24em] text-[#9a6d0b]">
            Find your best fit
          </p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl md:text-7xl">
            A few questions. One clear recommendation.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5f6963]">
            No account is required. Your answers are saved on this device so
            you can pick up where you left off.
          </p>
        </div>
      </section>
      <section className="bg-[#f9faf8] py-16">
        <div className="container-shell">
          <QuizWizard initialStep={step} />
        </div>
      </section>
    </main>
  );
}
