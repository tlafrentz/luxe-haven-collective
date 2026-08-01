import QRCode from "qrcode";
import { getGuidebookEditorRequest } from "@/app/actions/guidebook-studio";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: Readonly<{ params: Promise<{ guidebookId: string }> }>) {
  const { guidebookId } = await context.params;
  const result = await getGuidebookEditorRequest(guidebookId);
  if (!result.ok || result.guidebook.status !== "published" || result.guidebook.public_url_status !== "active") return new Response("Unavailable", { status: 404 });
  const destination = `${new URL(request.url).origin}/g/${result.guidebook.public_slug}?source=qr`;
  const svg = await QRCode.toString(destination, { type: "svg", errorCorrectionLevel: "M", margin: 4, width: 512, color: { dark: "#1c1917", light: "#ffffff" } });
  return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "content-disposition": `attachment; filename="guidebook-${guidebookId.slice(0, 8)}-qr.svg"`, "cache-control": "private, no-store", "x-guidebook-destination": destination } });
}
