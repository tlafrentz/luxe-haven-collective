import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { verifyOwnerChecklistToken } from "@/features/lead-magnets/owner-checklist-token";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const verified = verifyOwnerChecklistToken(token);
  if (!verified)
    return new Response("This download link is invalid or expired.", {
      status: 403,
    });

  const { data: lead } = await createAdminClient()
    .from("lead_magnet_downloads")
    .select("id")
    .eq("id", verified.leadId)
    .eq("lead_magnet", "hospitality_owner_performance_checklist")
    .maybeSingle();
  if (!lead)
    return new Response("This download is unavailable.", { status: 404 });

  const pdf = await readFile(
    path.join(
      process.cwd(),
      "private-assets",
      "hospitality-owner-performance-checklist.pdf",
    ),
  );
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'attachment; filename="Hospitality_Owner_Performance_Checklist.pdf"',
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
