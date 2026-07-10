import { PropertyForm } from "@/components/admin/property-form";
import {
  PropertyLivePreview,
  PropertyStudio,
} from "@/components/admin/property-studio";
import { getPropertyMedia } from "@/lib/property-media";
import { getPropertyByIdForAdmin } from "@/lib/properties";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditPropertyPage({ params }: Props) {
  const { id } = await params;

  const property = await getPropertyByIdForAdmin(id);
  const media = await getPropertyMedia(id);

  return (
    <PropertyStudio
      property={property}
      media={media}
      editor={
        <PropertyForm
          property={property}
          media={media}
        />
      }
      preview={<PropertyLivePreview />}
    />
  );
}
