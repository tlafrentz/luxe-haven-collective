import type {
  Metadata,
} from "next";

import {
  HpmPage,
} from "@/features/marketing/hpm";

export const metadata: Metadata = {
  title:
    "Hospitality Performance Management",
  description:
    "Discover Hospitality Performance Management, the AI-powered operating discipline helping independent hospitality businesses improve financial, operational, and guest performance.",
};

export default function HospitalityPerformanceManagementPage() {
  return (
    <div className="[&>header:first-child]:hidden">
      <HpmPage />
    </div>
  );
}
