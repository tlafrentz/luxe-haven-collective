import { ImportReview } from "@/components/furnishing/product-catalog-workspace";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ importId: string }> }) { return <ImportReview importId={(await params).importId} />; }
