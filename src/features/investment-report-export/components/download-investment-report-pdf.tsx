"use client";
import { useState } from "react";

export function DownloadInvestmentReportPdf({ reportId }: { reportId: string }) {
  const [state, setState] = useState<"idle" | "generating" | "failed">("idle");
  const [message, setMessage] = useState("");
  async function download() {
    if (state === "generating") return;
    setState("generating"); setMessage("");
    try {
      const response = await fetch(`/api/investment-reports/${encodeURIComponent(reportId)}/pdf`, { method: "GET", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) { const body = await response.json().catch(() => null) as { message?: string } | null; throw new Error(body?.message ?? "The PDF could not be generated. Please retry."); }
      const blob = await response.blob();
      if (blob.type !== "application/pdf" || blob.size < 100) throw new Error("The downloaded document was invalid. Please retry.");
      const disposition = response.headers.get("content-disposition") ?? "", match = disposition.match(/filename="([^"]+\.pdf)"/i);
      const filename = match?.[1] ?? "luxe-haven-investment-report.pdf", url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename; anchor.style.display = "none"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      setState("idle"); setMessage("PDF download started.");
    } catch (error) {
      setState("failed"); setMessage(error instanceof Error ? error.message : "The PDF could not be generated. Please retry.");
    }
  }
  return <div className="flex flex-col items-start gap-2"><button type="button" onClick={download} disabled={state === "generating"} aria-describedby={`pdf-export-status-${reportId}`} className="rounded-full border border-stone-950 bg-white px-5 py-2.5 text-sm font-semibold text-stone-950 outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{state === "generating" ? "Generating PDF…" : state === "failed" ? "Retry PDF download" : "Download PDF"}</button><span id={`pdf-export-status-${reportId}`} role="status" aria-live="polite" className={`max-w-xs text-xs ${state === "failed" ? "text-rose-700" : "text-stone-500"}`}>{message}</span></div>;
}
