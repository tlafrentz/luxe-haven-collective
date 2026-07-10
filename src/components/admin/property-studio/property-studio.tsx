"use client";

import type { ReactNode } from "react";
import type { Property, PropertyMedia } from "@/types/database";
import { PropertyStudioProvider } from "./property-context";
import { PropertyAiSidebar } from "./ai/property-ai-sidebar";
import { PropertyScore } from "./intelligence/property-score";

type PropertyStudioProps = {
  property?: Property;
  media?: PropertyMedia[];
  editor: ReactNode;
  preview: ReactNode;
};

export function PropertyStudio({
  property,
  media = [],
  editor,
  preview,
}: PropertyStudioProps) {
  return (
    <PropertyStudioProvider property={property} media={media}>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0">{editor}</section>

        <aside className="hidden xl:block">
          <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto pr-1">
            {preview}

            <div className="mt-6">
              <PropertyScore />
            </div>

            <PropertyAiSidebar />
          </div>
        </aside>
      </div>
    </PropertyStudioProvider>
  );
}
