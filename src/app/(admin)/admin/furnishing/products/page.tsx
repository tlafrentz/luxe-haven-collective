import { ProductLibrary } from "@/components/furnishing/product-library";
export const dynamic = "force-dynamic";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProductLibrary searchParams={searchParams} />;
}
