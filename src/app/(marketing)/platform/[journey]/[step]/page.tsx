import { notFound, redirect } from "next/navigation";
import { PlatformJourney } from "@/components/marketing/platform-journey";
import {
  journeySteps,
  platformJourneys,
  type JourneyStep,
} from "@/lib/platform-journeys";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ journey: string; step: string }>;
  searchParams: Promise<{ package?: string }>;
}) {
  const { journey, step } = await params;
  const query = await searchParams;
  if (journey === "guidebook-studio") redirect("/guidebook-studio");
  if (journey === "furnishing-studio") redirect("/furnishing");
  if (!platformJourneys[journey] || !journeySteps.includes(step as JourneyStep))
    notFound();
  return (
    <PlatformJourney
      slug={journey}
      step={step as JourneyStep}
      selected={query.package}
    />
  );
}
