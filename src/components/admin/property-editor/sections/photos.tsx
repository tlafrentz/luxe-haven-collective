import type { Property, PropertyMedia } from "@/types/database";
import { MediaManager } from "@/components/admin/property-editor/media-manager";

type Props = {
  values: Partial<Property> & Record<string, unknown>;
  propertyId?: string;
  media?: PropertyMedia[];
};

export function PhotosSection({
  propertyId,
  media = [],
}: Props) {
  if (!propertyId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
        Save the property before uploading photos.
      </div>
    );
  }

  return (
    <MediaManager
      propertyId={propertyId}
      media={media}
    />
  );
}
