import { NewProduct } from "@/components/furnishing/product-catalog-workspace";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) { return <NewProduct workspaceId={(await searchParams).workspace}/>; }
