import { ProductDetail } from "@/components/furnishing/product-catalog-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  return <ProductDetail productId={(await params).productId} />;
}
