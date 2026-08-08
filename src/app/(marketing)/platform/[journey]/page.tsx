import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { platformJourneys } from "@/lib/platform-journeys";
export default async function Page({
  params,
}: {
  params: Promise<{ journey: string }>;
}) {
  const { journey } = await params;
  if (journey === "guidebook-studio") redirect("/guidebook-studio");
  if (journey === "furnishing-studio") redirect("/furnishing");
  if (journey === "investment-intelligence") redirect("/dashboard/investments");
  if (!platformJourneys[journey]) notFound();
  redirect(`/platform/${journey}/journey`);
}
