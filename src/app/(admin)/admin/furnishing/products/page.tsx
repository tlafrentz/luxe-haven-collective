import { ProductCatalog } from "@/components/furnishing/product-catalog-workspace";
export const dynamic = "force-dynamic";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <ProductCatalog searchParams={searchParams} />;
}
