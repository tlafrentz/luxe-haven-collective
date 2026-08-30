import { ProductDetail } from "@/components/furnishing/product-catalog-workspace";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ productId:string }>; searchParams: Promise<{ workspace?:string }> }) { const [{productId},query]=await Promise.all([params,searchParams]); return <ProductDetail productId={productId} workspaceId={query.workspace}/>; }
