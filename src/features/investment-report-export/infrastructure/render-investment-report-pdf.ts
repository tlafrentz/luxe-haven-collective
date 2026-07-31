import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ExportMetric, ExportSection, InvestmentReportExportView } from "../domain/investment-report-export";

const PAGE = { width: 612, height: 792, marginX: 54, top: 62, bottom: 54 } as const;
const COLORS = { ink: rgb(.12, .105, .09), muted: rgb(.36, .33, .29), gold: rgb(.57, .40, .15), line: rgb(.84, .82, .78), wash: rgb(.965, .958, .94), risk: rgb(.52, .20, .13) };

export async function renderInvestmentReportPdf(view: InvestmentReportExportView): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(safe(view.title)); document.setAuthor("Luxe Haven Collective");
  document.setSubject(`Investment Report ${view.documentReference}`); document.setProducer(`Luxe Haven Investment Report Export ${view.templateVersion}`);
  document.setCreationDate(new Date(view.exportedAt)); document.setModificationDate(new Date(view.exportedAt));
  const regular = await document.embedFont(StandardFonts.Helvetica), bold = await document.embedFont(StandardFonts.HelveticaBold), serif = await document.embedFont(StandardFonts.TimesRomanBold);
  const context = new Layout(document, regular, bold, serif, view);
  context.cover();
  for (const section of view.sections) context.section(section);
  context.finish();
  return document.save({ useObjectStreams: false, addDefaultPage: false });
}

class Layout {
  private page!: PDFPage; private y = 0; private pageNumber = 0;
  constructor(private document: PDFDocument, private regular: PDFFont, private bold: PDFFont, private serif: PDFFont, private view: InvestmentReportExportView) {}
  cover() {
    this.addPage(false);
    this.page.drawRectangle({ x: 0, y: PAGE.height - 16, width: PAGE.width, height: 16, color: COLORS.gold });
    this.text("LUXE HAVEN COLLECTIVE", PAGE.marginX, 672, 11, this.bold, COLORS.gold, 500);
    this.text("INVESTMENT REPORT", PAGE.marginX, 624, 12, this.bold, COLORS.muted, 500);
    const afterTitle = this.paragraph(this.view.coverSubtitle, PAGE.marginX, 560, 30, this.serif, COLORS.ink, 500, 35);
    this.text(label(this.view.strategy), PAGE.marginX, afterTitle - 26, 12, this.bold, COLORS.muted, 500);
    this.page.drawLine({ start: { x: PAGE.marginX, y: afterTitle - 48 }, end: { x: PAGE.width - PAGE.marginX, y: afterTitle - 48 }, thickness: 1, color: COLORS.line });
    this.text("RECOMMENDATION", PAGE.marginX, afterTitle - 82, 9, this.bold, COLORS.gold, 200);
    this.paragraph(this.view.recommendation, PAGE.marginX, afterTitle - 111, 23, this.serif, COLORS.ink, 500, 27);
    const details = [
      ["Report generated", formatDate(this.view.generatedAt)], ["Analysis version", String(this.view.analysisVersion)],
      ["Document reference", this.view.documentReference], ["Classification", this.view.confidentiality],
    ];
    let y = 214;
    details.forEach(([key, value]) => { this.text(key.toUpperCase(), PAGE.marginX, y, 8, this.bold, COLORS.muted, 190); this.text(value, 224, y, 10, this.regular, COLORS.ink, 320); y -= 27; });
    this.y = 0;
  }
  section(section: ExportSection) {
    const estimate = 58 + (section.narrative ? 45 : 0) + Math.min(section.metrics?.length ?? 0, 4) * 27;
    this.ensure(Math.min(estimate, 190));
    this.text(section.title, PAGE.marginX, this.y, 20, this.serif, COLORS.ink, 500); this.y -= 12;
    this.page.drawLine({ start: { x: PAGE.marginX, y: this.y }, end: { x: PAGE.width - PAGE.marginX, y: this.y }, thickness: .8, color: COLORS.gold }); this.y -= 22;
    if (section.narrative) this.y = this.paragraph(section.narrative, PAGE.marginX, this.y, 10, this.regular, COLORS.muted, 504, 15) - 9;
    if (section.metrics?.length) this.metrics(section.metrics);
    if (section.bullets?.length) for (const bullet of section.bullets) this.bullet(bullet);
    if (section.table) this.table(section.table.headers, section.table.rows);
    this.y -= 20;
  }
  metrics(metrics: readonly ExportMetric[]) {
    for (let index = 0; index < metrics.length; index += 2) {
      this.ensure(54); const pair = metrics.slice(index, index + 2);
      pair.forEach((metric, column) => {
        const x = PAGE.marginX + column * 258, width = 246;
        this.page.drawRectangle({ x, y: this.y - 42, width, height: 48, color: COLORS.wash });
        this.text(metric.label.toUpperCase(), x + 10, this.y - 8, 7.5, this.bold, COLORS.muted, width - 20);
        this.text(metric.value, x + 10, this.y - 28, 11, this.bold, COLORS.ink, width - 20);
        if (metric.source) this.text(`Source: ${metric.source}`, x + 10, this.y - 39, 6.5, this.regular, COLORS.muted, width - 20);
      }); this.y -= 56;
    }
  }
  bullet(value: string) {
    const lines = wrap(safe(value), this.regular, 9.5, 485); this.ensure(lines.length * 14 + 6);
    this.text("•", PAGE.marginX + 2, this.y, 10, this.bold, COLORS.gold, 10);
    lines.forEach((line, index) => this.text(line, PAGE.marginX + 16, this.y - index * 14, 9.5, this.regular, COLORS.ink, 485));
    this.y -= lines.length * 14 + 6;
  }
  table(headers: readonly string[], rows: readonly (readonly string[])[]) {
    const widths = columns(headers.length), headerHeight = 27;
    const drawHeader = () => {
      this.ensure(headerHeight + 20);
      this.page.drawRectangle({ x: PAGE.marginX, y: this.y - headerHeight + 7, width: 504, height: headerHeight, color: COLORS.ink });
      let x = PAGE.marginX;
      headers.forEach((header, i) => { this.text(header.toUpperCase(), x + 5, this.y - 10, 6.5, this.bold, rgb(1, 1, 1), widths[i] - 10); x += widths[i]; });
      this.y -= headerHeight;
    };
    drawHeader();
    for (const row of rows) {
      const cellLines = headers.map((_, i) => wrap(safe(row[i] ?? "Unavailable"), this.regular, 7.4, widths[i] - 10));
      const height = Math.max(24, Math.max(...cellLines.map(lines => lines.length)) * 10 + 10);
      if (this.y - height < PAGE.bottom) { this.addPage(); drawHeader(); }
      let x = PAGE.marginX;
      cellLines.forEach((lines, i) => {
        lines.forEach((line, lineIndex) => this.text(line, x + 5, this.y - 9 - lineIndex * 10, 7.4, this.regular, COLORS.ink, widths[i] - 10));
        x += widths[i];
      });
      this.page.drawLine({ start: { x: PAGE.marginX, y: this.y - height + 4 }, end: { x: PAGE.width - PAGE.marginX, y: this.y - height + 4 }, thickness: .5, color: COLORS.line });
      this.y -= height;
    }
  }
  finish() {
    const pages = this.document.getPages(), count = pages.length;
    pages.forEach((page, index) => {
      page.drawLine({ start: { x: PAGE.marginX, y: 35 }, end: { x: PAGE.width - PAGE.marginX, y: 35 }, thickness: .5, color: COLORS.line });
      page.drawText(`CONFIDENTIAL  |  ${this.view.documentReference}  |  ${this.view.templateVersion}`, { x: PAGE.marginX, y: 21, size: 6.8, font: this.bold, color: COLORS.muted });
      const pageLabel = `Page ${index + 1} of ${count}`;
      page.drawText(pageLabel, { x: PAGE.width - PAGE.marginX - this.regular.widthOfTextAtSize(pageLabel, 7), y: 21, size: 7, font: this.regular, color: COLORS.muted });
    });
  }
  private addPage(content = true) { this.page = this.document.addPage([PAGE.width, PAGE.height]); this.pageNumber += 1; this.y = PAGE.height - PAGE.top; if (content && this.pageNumber > 1) { this.text("LUXE HAVEN  /  INVESTMENT REPORT", PAGE.marginX, PAGE.height - 38, 7, this.bold, COLORS.gold, 504); this.y = PAGE.height - PAGE.top; } }
  private ensure(height: number) { if (!this.page || this.y - height < PAGE.bottom) this.addPage(); }
  private paragraph(value: string, x: number, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>, width: number, leading: number) {
    const lines = wrap(safe(value), font, size, width); this.ensure(lines.length * leading);
    lines.forEach((line, index) => this.text(line, x, y - index * leading, size, font, color, width));
    return y - lines.length * leading;
  }
  private text(value: string, x: number, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>, width: number) {
    this.page.drawText(ellipsize(safe(value), font, size, width), { x, y, size, font, color });
  }
}

function columns(count: number) { if (count === 5) return [118, 92, 74, 92, 128]; if (count === 4) return [150, 118, 118, 118]; if (count === 3) return [100, 180, 224]; return Array.from({ length: count }, () => 504 / count); }
function wrap(value: string, font: PDFFont, size: number, width: number) { const output: string[] = []; for (const paragraph of value.split(/\n/)) { let line = ""; for (const word of paragraph.split(/\s+/)) { const candidate = `${line} ${word}`.trim(); if (line && font.widthOfTextAtSize(candidate, size) > width) { output.push(line); line = word; } else line = candidate; } output.push(line || " "); } return output; }
function ellipsize(value: string, font: PDFFont, size: number, width: number) { if (font.widthOfTextAtSize(value, size) <= width) return value; let result = value; while (result.length && font.widthOfTextAtSize(`${result}...`, size) > width) result = result.slice(0, -1); return `${result}...`; }
function safe(value: string) { return value.normalize("NFKD").replace(/[^\x20-\x7E\n]/g, character => character === "•" ? "*" : "-"); }
function label(value: string) { return value.replaceAll("-", " ").replace(/\b\w/g, character => character.toUpperCase()); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "Unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(date); }
