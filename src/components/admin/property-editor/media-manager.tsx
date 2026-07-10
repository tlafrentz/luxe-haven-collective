"use client";

import Image from "next/image";
import { useTransition } from "react";

import type { PropertyMedia } from "@/types/database";

import {
  uploadPropertyImagesAction,
  deletePropertyImageAction,
  movePropertyImageAction,
  setFeaturedPropertyImageAction,
} from "@/app/actions/property-media";

type Props = {
  propertyId: string;
  media: PropertyMedia[];
};

export function MediaManager({ propertyId, media }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-8">

      <form action={uploadPropertyImagesAction}>
        <input type="hidden" name="property_id" value={propertyId} />

        <div className="rounded-3xl border-2 border-dashed border-white/15 p-10 text-center">

          <h3 className="text-xl font-semibold">
            Upload Property Images
          </h3>

          <p className="mt-2 text-white/50">
            Select one or more images.
          </p>

          <input
            className="mt-6 block w-full"
            type="file"
            name="images"
            multiple
            accept="image/*"
          />

          <button
            className="mt-6 rounded-full bg-white px-6 py-3 text-black font-semibold"
            disabled={pending}
          >
            Upload
          </button>

        </div>
      </form>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">

        {media.map((item) => (

          <div
            key={item.id}
            className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]"
          >

            <div className="relative aspect-video">

              <Image
                src={item.url}
                alt={item.alt_text ?? ""}
                fill
                className="object-cover"
              />

            </div>

            <div className="space-y-4 p-5">

              {item.is_featured && (
                <div className="inline-flex rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold">
                  Featured Image
                </div>
              )}

              <p className="truncate text-sm text-white/70">
                {item.alt_text}
              </p>

              <div className="flex flex-wrap gap-2">

                <form action={setFeaturedPropertyImageAction}>
                  <input
                    type="hidden"
                    name="property_id"
                    value={propertyId}
                  />

                  <input
                    type="hidden"
                    name="media_id"
                    value={item.id}
                  />

                  <button className="rounded-full border px-3 py-1 text-sm">
                    Feature
                  </button>
                </form>

                <form action={movePropertyImageAction}>
                  <input
                    type="hidden"
                    name="property_id"
                    value={propertyId}
                  />

                  <input
                    type="hidden"
                    name="media_id"
                    value={item.id}
                  />

                  <input
                    type="hidden"
                    name="direction"
                    value="up"
                  />

                  <button className="rounded-full border px-3 py-1 text-sm">
                    ↑
                  </button>
                </form>

                <form action={movePropertyImageAction}>
                  <input
                    type="hidden"
                    name="property_id"
                    value={propertyId}
                  />

                  <input
                    type="hidden"
                    name="media_id"
                    value={item.id}
                  />

                  <input
                    type="hidden"
                    name="direction"
                    value="down"
                  />

                  <button className="rounded-full border px-3 py-1 text-sm">
                    ↓
                  </button>
                </form>

                <form action={deletePropertyImageAction}>
                  <input
                    type="hidden"
                    name="property_id"
                    value={propertyId}
                  />

                  <input
                    type="hidden"
                    name="media_id"
                    value={item.id}
                  />

                  <input
                    type="hidden"
                    name="storage_path"
                    value={item.storage_path ?? ""}
                  />

                  <button className="rounded-full border border-red-500 px-3 py-1 text-sm text-red-400">
                    Delete
                  </button>
                </form>

              </div>

            </div>

          </div>

        ))}

      </div>

    </div>
  );
}
