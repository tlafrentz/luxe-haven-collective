import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/page-hero";
import { SolutionCard } from "@/components/marketing/solution-card";
import { publicJourneys } from "@/features/public-experience/journeys";

export const metadata: Metadata = {
  title: "Hospitality Solutions | Luxe Haven Collective",
  description:
    "Choose a connected Luxe Haven path for guest experience, investing, property launch, revenue, operations, or hospitality performance management.",
};
export default function SolutionsPage() {
  return (
    <main>
      <PageHero
        eyebrow="Solutions"
        title="One journey. Many paths. Better results."
        description="Start with the outcome you want. We’ll connect the right offer, activation journey, and specialist workspace."
      />
      <section className="bg-[#f7f7f3] py-20">
        <div className="container-shell grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {publicJourneys.map((journey) => (
            <SolutionCard key={journey.slug} journey={journey} />
          ))}
        </div>
      </section>
    </main>
  );
}
