"use client";

import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics/track";

export function HomepageLink({
  actionId,
  sourceSection,
  authenticated,
  children,
  className,
  ...props
}: LinkProps & {
  actionId: string;
  sourceSection: string;
  authenticated: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      {...props}
      className={className}
      onClick={() =>
        track("homepage_action", {
          actionId,
          sourceSection,
          destination: String(props.href),
          authenticationState: authenticated ? "authenticated" : "anonymous",
        })
      }
    >
      {children}
    </Link>
  );
}
