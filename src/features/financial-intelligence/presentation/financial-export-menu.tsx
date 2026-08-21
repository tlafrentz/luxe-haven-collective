"use client";
import { useEffect, useRef, useState } from "react";
import { buildZipArchive } from "./financial-zip";

export function FinancialExportMenu({ csvSummary, csvExpenses, filePrefix }: { csvSummary: string; csvExpenses: string; filePrefix: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  function downloadText(name: string, content: string, mediaType: string) {
    const blob = new Blob([content], { type: mediaType });
    downloadBlob(name, blob);
    setOpen(false);
  }
  function downloadZip() {
    const archive = buildZipArchive(new Map([
      [`${filePrefix}-financial-summary.csv`, csvSummary],
      [`${filePrefix}-expense-detail.csv`, csvExpenses],
    ]));
    downloadBlob(`${filePrefix}-financial-package.zip`, new Blob([new Uint8Array(archive)], { type: "application/zip" }));
    setOpen(false);
  }
  function printOverview() {
    setOpen(false);
    window.print();
  }
  return <div ref={ref} className="relative print:hidden">
    <button type="button" onClick={() => setOpen(value => !value)} aria-haspopup="menu" aria-expanded={open} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-xs font-semibold text-stone-800">Export</button>
    {open ? <div role="menu" aria-label="Export options" className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-stone-200 bg-white py-1 text-sm shadow-lg">
      <button role="menuitem" type="button" onClick={printOverview} className="block min-h-10 w-full px-4 text-left hover:bg-stone-50">Overview PDF</button>
      <button role="menuitem" type="button" onClick={() => downloadText(`${filePrefix}-financial-summary.csv`, csvSummary, "text/csv;charset=utf-8")} className="block min-h-10 w-full px-4 text-left hover:bg-stone-50">Financial summary CSV</button>
      <button role="menuitem" type="button" onClick={() => downloadText(`${filePrefix}-expense-detail.csv`, csvExpenses, "text/csv;charset=utf-8")} className="block min-h-10 w-full px-4 text-left hover:bg-stone-50">Expense-detail CSV</button>
      <button role="menuitem" type="button" onClick={downloadZip} className="block min-h-10 w-full px-4 text-left hover:bg-stone-50">Complete financial package (ZIP)</button>
    </div> : null}
  </div>;
}

function downloadBlob(name: string, blob: Blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
