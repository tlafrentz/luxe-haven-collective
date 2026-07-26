/**
 * Deterministic, dependency-free PDF fallback. Production can replace this
 * through ReportDocumentRenderer without changing Reporting domain behavior.
 * It derives selectable text from the canonical HTML artifact.
 */
export function renderSimpleReportPdf(html: string, metadata: Readonly<{ title: string; generatedAt: string }>) {
  const text = stripHtml(html).slice(0, 5000);
  const lines = wrap(`${metadata.title}\nGenerated ${metadata.generatedAt}\n\n${text}`, 88).slice(0, 48);
  const stream = [
    "BT", "/F1 10 Tf", "54 738 Td", "14 TL",
    ...lines.flatMap((line, index) => [`(${pdfEscape(line)}) Tj`, index === lines.length - 1 ? "" : "T*"]).filter(Boolean),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${new TextEncoder().encode(stream).byteLength} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Title (${pdfEscape(metadata.title)}) /CreationDate (${pdfDate(metadata.generatedAt)}) /Producer (Luxe Haven Reporting) >>`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(document).byteLength);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = new TextEncoder().encode(document).byteLength;
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(document);
}

function stripHtml(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}
function wrap(value: string, width: number) {
  const output: string[] = [];
  for (const paragraph of value.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (`${line} ${word}`.trim().length > width && line) { output.push(line); line = word; } else line = `${line} ${word}`.trim();
    }
    output.push(line);
  }
  return output;
}
function pdfEscape(value: string) { return value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, "?"); }
function pdfDate(value: string) { return `D:${value.replace(/\D/g, "").slice(0, 14)}Z`; }
