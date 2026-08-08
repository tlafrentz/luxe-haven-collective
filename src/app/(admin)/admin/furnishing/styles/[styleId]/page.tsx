import { StyleDetail } from "@/components/furnishing/design-system-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ styleId: string }>;
}) {
  return <StyleDetail styleId={(await params).styleId} />;
}
