import { getFurnishingLibraryProduct } from "@/app/actions/furnishing-library";
import { LibraryProductDetail } from "@/components/furnishing/library-product-detail";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const data = await getFurnishingLibraryProduct(productId);
  return (
    <LibraryProductDetail
      product={data.product}
      roomTypes={data.roomTypes}
      styleTags={data.styleTags}
      retailers={data.retailers}
      activity={data.activity}
      usage={data.usage}
    />
  );
}
