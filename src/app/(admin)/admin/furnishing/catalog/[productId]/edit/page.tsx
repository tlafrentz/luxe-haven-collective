import { permanentRedirect } from "next/navigation";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ productId }, query] = await Promise.all([params, searchParams]);
  const workspace = query.workspace;
  permanentRedirect(`/admin/furnishing/products/${productId}/edit${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""}`);
}
