import type { Metadata } from "next";
import { RequestStatusView } from "../_shared/request-status-view";

export const metadata: Metadata = {
  title: "Request Status | Luxe Haven Stays",
  robots: { index: false },
};

type StatusPageProps = {
  searchParams: Promise<{ request?: string }>;
};

export default async function BookingStatusPage({ searchParams }: StatusPageProps) {
  const { request } = await searchParams;
  return <RequestStatusView requestToken={request ?? ""} />;
}
