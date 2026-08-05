import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { platformJourneys } from "@/lib/platform-journeys";
export default async function Page({
  params,
}: {
  params: Promise<{ journey: string }>;
}) {
  const { journey } = await params;
  if (!platformJourneys[journey]) notFound();
  redirect(`/platform/${journey}/journey`);
}
