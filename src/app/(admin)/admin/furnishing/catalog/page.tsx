import { ProductCatalogV2 } from "@/components/furnishing/product-catalog-v2";
export const dynamic = "force-dynamic";
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) { return <ProductCatalogV2 searchParams={searchParams} />; }
