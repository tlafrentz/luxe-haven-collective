import { createHash } from "node:crypto";
import type { HpmReportResult } from "./hpm-report-contracts";

export type HpmReportExport = Readonly<{ exportId: string; runId: string; format: "csv" | "print"; filename: string; contentType: string; content: string; checksum: string; createdAt: string; expiresAt: string }>;

export function createHpmReportExport(report: HpmReportResult, format: "csv" | "print", now = new Date()): HpmReportExport {
  if (!report.exportEligibility[format === "csv" ? "csv" : "print"]) throw new Error("HPM_EXPORT_NOT_ALLOWED");
  const content = format === "csv" ? csv(report) : printable(report);
  const checksum = createHash("sha256").update(content).digest("hex");
  const expires = new Date(now); expires.setUTCDate(expires.getUTCDate() + 7);
  return Object.freeze({ exportId: `hpm-export:${createHash("sha256").update(`${report.runId}:${format}`).digest("hex").slice(0, 24)}`, runId: report.runId, format, filename: `hpm-${report.reportKey}-${report.asOf.slice(0, 10)}.${format === "csv" ? "csv" : "html"}`, contentType: format === "csv" ? "text/csv; charset=utf-8" : "text/html; charset=utf-8", content, checksum, createdAt: now.toISOString(), expiresAt: expires.toISOString() });
}

function csv(report: HpmReportResult) {
  const rows: string[][] = [["Report", report.reportKey], ["Definition", `${report.definitionId}@${report.definitionVersion}`], ["Scope", report.scope.type], ["Property count", String(report.scope.propertyCount)], ["Period", `${report.from} to ${report.to}`], ["Time zone", report.timeZone], ["As of", report.asOf], ["Completeness", report.completeness], ["Result checksum", report.resultChecksum], [], ["Section", "Metric", "Metric version", "Value", "Unit", "State", "Explanation"]];
  for (const section of report.sections) {
    for (const metric of section.metrics) rows.push([section.title, metric.metricKey, metric.metricVersion, metric.value === null ? "Unavailable" : String(metric.value), metric.unit, metric.state, metric.explanation]);
    for (const row of section.rows) for (const metric of row.values) rows.push([`${section.title}: ${row.label}`, metric.metricKey, metric.metricVersion, metric.value === null ? "Unavailable" : String(metric.value), metric.unit, metric.state, metric.explanation]);
  }
  for (const limitation of report.limitations) rows.push(["Limitation", limitation]);
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n") + "\r\n";
}
function printable(report: HpmReportResult) { const sections = report.sections.map((section) => `<section><h2>${escapeHtml(section.title)}</h2><table><caption>${escapeHtml(section.title)} metrics</caption><thead><tr><th>Metric</th><th>Value</th><th>State</th></tr></thead><tbody>${section.metrics.map((metric) => `<tr><th>${escapeHtml(metric.metricKey)}</th><td>${metric.value ?? "Unavailable"}</td><td>${escapeHtml(metric.state)}</td></tr>`).join("")}</tbody></table></section>`).join(""); return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(report.reportKey)}</title></head><body><main><h1>${escapeHtml(report.reportKey)}</h1><p>Period ${escapeHtml(report.from)} to ${escapeHtml(report.to)} · ${escapeHtml(report.timeZone)}</p><p>As of ${escapeHtml(report.asOf)} · ${escapeHtml(report.completeness)}</p>${sections}<section><h2>Limitations</h2><ul>${report.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section><p>Result checksum ${escapeHtml(report.resultChecksum)}</p></main></body></html>`; }
function escapeCsv(value: string) { return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value; }
function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
