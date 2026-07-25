import type { ReactNode } from "react";

import { WorkspaceLocalNavigation } from "@/features/workspace";

export default function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6 lg:px-8">
        <WorkspaceLocalNavigation />
      </div>
      {children}
    </>
  );
}
