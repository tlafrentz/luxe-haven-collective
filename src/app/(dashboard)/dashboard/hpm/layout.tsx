import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isHpmWorkspaceEnabled } from "@/features/hpm-workspace";

export default function HpmLayout({ children }: { children: ReactNode }) {
  if (!isHpmWorkspaceEnabled()) notFound();
  return children;
}
