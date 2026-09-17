import type { Metadata } from "next";
import { ReturnStatus } from "./return-status";

export const metadata: Metadata = {
  title: "Booking Confirmation | Luxe Haven Stays",
  robots: { index: false },
};

type ReturnPageProps = {
  searchParams: Promise<{ attempt?: string }>;
};

export default async function BookingReturnPage({ searchParams }: ReturnPageProps) {
  const { attempt } = await searchParams;
  return <ReturnStatus attemptToken={attempt ?? ""} />;
}
