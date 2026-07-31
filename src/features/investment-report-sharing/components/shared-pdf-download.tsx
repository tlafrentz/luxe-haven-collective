"use client";
import { useState } from "react";
export function SharedPdfDownload() {
  const [pending, setPending] = useState(false), [message, setMessage] = useState("");
  async function download() { if (pending) return; setPending(true); setMessage(""); try { const response = await fetch(`${window.location.pathname}/pdf`, { cache: "no-store", credentials: "omit" }); if (!response.ok) throw new Error("The shared PDF is unavailable."); const blob = await response.blob(), url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "luxe-haven-investment-report.pdf"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url); setMessage("PDF download started."); } catch { setMessage("The shared PDF could not be downloaded. The link may have expired or been revoked."); } finally { setPending(false); } }
  return <div><button onClick={download} disabled={pending} className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Generating PDF…" : "Download PDF"}</button><p role="status" aria-live="polite" className="mt-2 max-w-xs text-xs text-stone-600">{message}</p></div>;
}
