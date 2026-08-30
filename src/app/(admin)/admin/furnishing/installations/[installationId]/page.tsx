import { InstallationWorkspace } from "@/components/furnishing/installation-workspace";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ installationId: string }>; searchParams: Promise<{ view?: string }> }) { const [{ installationId }, query] = await Promise.all([params, searchParams]); return <InstallationWorkspace projectId={installationId} view={query.view} />; }
