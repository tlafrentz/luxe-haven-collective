"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Property, PropertyMedia } from "@/types/database";

type PropertyStudioContextValue = {
  property?: Property;
  media: PropertyMedia[];
  draft: Record<string, unknown>;
  updateDraft: (name: string, value: unknown) => void;
};

const PropertyStudioContext = createContext<PropertyStudioContextValue | null>(
  null,
);

export function PropertyStudioProvider({
  property,
  media = [],
  children,
}: {
  property?: Property;
  media?: PropertyMedia[];
  children: ReactNode;
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>({
    ...property,
  });

  const value = useMemo(
    () => ({
      property,
      media,
      draft,
      updateDraft(name: string, value: unknown) {
        setDraft((current) => ({
          ...current,
          [name]: value,
        }));
      },
    }),
    [property, media, draft],
  );

  return (
    <PropertyStudioContext.Provider value={value}>
      {children}
    </PropertyStudioContext.Provider>
  );
}

export function usePropertyStudio() {
  const context = useContext(PropertyStudioContext);

  if (!context) {
    throw new Error(
      "usePropertyStudio must be used inside PropertyStudioProvider",
    );
  }

  return context;
}
