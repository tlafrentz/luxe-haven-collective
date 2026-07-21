"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

const DEFAULT_FALLBACK = "/images/property-fallback.svg";
const OPTIMIZED_HOSTS = new Set([
  "images.unsplash.com",
  "jumdtoraygqaraditnie.supabase.co",
]);

function canOptimize(src: ImageProps["src"]) {
  if (typeof src !== "string" || src.startsWith("/")) return true;

  try {
    return OPTIMIZED_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

export function SafeImage({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK,
  onError,
  ...props
}: ImageProps & { fallbackSrc?: string }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const usingFallback = currentSrc === fallbackSrc;

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      unoptimized={props.unoptimized ?? !canOptimize(currentSrc)}
      onError={(event) => {
        onError?.(event);
        if (!usingFallback) setCurrentSrc(fallbackSrc);
      }}
    />
  );
}
