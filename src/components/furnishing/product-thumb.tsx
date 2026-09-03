"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";

/**
 * Renders a product's primary image with a graceful fallback to a neutral
 * placeholder when there's no image or the remote URL fails to load — per
 * FS-UX-010 §5.2, missing images must never show as broken.
 */
export function ProductThumb({ src, alt, className }: { src?: string | null; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`grid place-items-center bg-stone-100 ${className ?? ""}`}>
        <ImageIcon aria-hidden="true" className="h-8 w-8 text-stone-400" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`bg-stone-100 object-contain ${className ?? ""}`}
    />
  );
}
