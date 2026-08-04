import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { ReportProjection, ReportTemplate } from "../domain";
import { reportMetricDisplay, reportMetricLabel } from "./metric-format";

const PAGE = { width: 612, height: 792, margin: 48 };
const COLORS = {
  ink: rgb(0.11, 0.1, 0.09),
  muted: rgb(0.36, 0.34, 0.32),
  line: rgb(0.86, 0.84, 0.81),
  paper: rgb(0.98, 0.97, 0.95),
  green: rgb(0.04, 0.35, 0.24),
};

/** Server-side editorial PDF renderer built directly from the immutable projection. */
export async function renderSimpleReportPdf(
  projection: ReportProjection,
  template: ReportTemplate,
  metadata: Readonly<{
    title: string;
    generatedAt: string;
    reportNumber?: string;
  }>,
) {
  const document = await PDFDocument.create();
  document.setTitle(metadata.title);
  document.setAuthor(template.brand.name);
  document.setProducer("Luxe Haven Reporting");
  document.setCreationDate(new Date(metadata.generatedAt));
  const regular = await document.embedFont(StandardFonts.Helvetica),
    bold = await document.embedFont(StandardFonts.HelveticaBold),
    serif = await document.embedFont(StandardFonts.TimesRomanBold);
  let page = document.addPage([PAGE.width, PAGE.height]),
    y = PAGE.height - PAGE.margin;
  const pages: PDFPage[] = [page];
  const newPage = () => {
    page = document.addPage([PAGE.width, PAGE.height]);
    pages.push(page);
    y = PAGE.height - PAGE.margin;
    drawRunningHeader(page, regular, template.brand.name);
  };
  const ensure = (height: number) => {
    if (y - height < PAGE.margin + 28) newPage();
  };
  const text = (
    value: string,
    options: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      width?: number;
      gap?: number;
    } = {},
  ) => {
    const font = options.font ?? regular,
      size = options.size ?? 10,
      width = options.width ?? PAGE.width - PAGE.margin * 2,
      lines = wrap(value, font, size, width),
      height = lines.length * (size * 1.35);
    ensure(height);
    for (const line of lines) {
      page.drawText(line, {
        x: PAGE.margin,
        y,
        font,
        size,
        color: options.color ?? COLORS.ink,
      });
      y -= size * 1.35;
    }
    y -= options.gap ?? 5;
  };
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
    color: COLORS.paper,
  });
  text(template.brand.name.toUpperCase(), {
    font: bold,
    size: 9,
    color: COLORS.green,
    gap: 28,
  });
  text(metadata.title, { font: serif, size: 30, width: 500, gap: 14 });
  if (projection.subtitle)
    text(projection.subtitle, { size: 13, color: COLORS.muted, gap: 26 });
  const meta = [
    ["Scope", projection.scope.label],
    [
      "Period",
      projection.period?.label ??
        `As of ${projection.evaluatedAt.slice(0, 10)}`,
    ],
    ["Confidence", title(projection.confidence)],
    ["Data freshness", title(projection.freshness)],
  ];
  meta.forEach(([label, value], index) => {
    const x = PAGE.margin + (index % 2) * 258,
      top = y - Math.floor(index / 2) * 48;
    page.drawText(label.toUpperCase(), {
      x,
      y: top,
      font: bold,
      size: 7,
      color: COLORS.muted,
    });
    page.drawText(value, {
      x,
      y: top - 15,
      font: regular,
      size: 10,
      color: COLORS.ink,
      maxWidth: 238,
    });
  });
  y -= 112;
  text("Executive Summary", { font: serif, size: 22, gap: 10 });
  text(projection.summary, { size: 11, color: COLORS.muted, gap: 18 });
  for (const section of projection.sections
    .filter((item) => item.status !== "omitted")
    .sort((a, b) => a.order - b.order)) {
    ensure(70);
    page.drawLine({
      start: { x: PAGE.margin, y },
      end: { x: PAGE.width - PAGE.margin, y },
      thickness: 0.7,
      color: COLORS.line,
    });
    y -= 22;
    text(section.title, { font: serif, size: 19, gap: 8 });
    if (section.narrative)
      text(section.narrative, { size: 10.5, color: COLORS.muted, gap: 13 });
    for (let index = 0; index < section.metrics.length; index += 2) {
      const pair = section.metrics.slice(index, index + 2);
      ensure(70);
      const top = y;
      pair.forEach((metric, column) => {
        const x = PAGE.margin + column * 258;
        page.drawRectangle({
          x,
          y: top - 58,
          width: 246,
          height: 62,
          borderColor: COLORS.line,
          borderWidth: 0.7,
          color: rgb(1, 1, 1),
        });
        page.drawText(reportMetricLabel(metric), {
          x: x + 12,
          y: top - 17,
          font: regular,
          size: 8,
          color: COLORS.muted,
          maxWidth: 220,
        });
        page.drawText(reportMetricDisplay(metric), {
          x: x + 12,
          y: top - 42,
          font: bold,
          size: 16,
          color: COLORS.ink,
          maxWidth: 220,
        });
      });
      y -= 74;
    }
    if (section.rows?.length) {
      const headers = Object.keys(section.rows[0] ?? {});
      text(headers.join("   |   "), { font: bold, size: 8, gap: 3 });
      for (const row of section.rows.slice(0, 40))
        text(headers.map((key) => row[key] ?? "").join("   |   "), {
          size: 8,
          color: COLORS.muted,
          gap: 2,
        });
    }
    text(
      `Confidence: ${title(section.confidence ?? "unavailable")}  ·  Freshness: ${title(section.freshness ?? "unknown")}`,
      { size: 7.5, color: COLORS.muted, gap: 14 },
    );
  }
  pages.forEach((item, index) => {
    item.drawLine({
      start: { x: PAGE.margin, y: 32 },
      end: { x: PAGE.width - PAGE.margin, y: 32 },
      thickness: 0.5,
      color: COLORS.line,
    });
    item.drawText(
      `${metadata.reportNumber ?? "Governed report"}  ·  ${index + 1} of ${pages.length}`,
      { x: PAGE.margin, y: 18, font: regular, size: 7, color: COLORS.muted },
    );
    item.drawText(new Date(metadata.generatedAt).toISOString(), {
      x: PAGE.width - PAGE.margin - 135,
      y: 18,
      font: regular,
      size: 7,
      color: COLORS.muted,
    });
  });
  return document.save({ useObjectStreams: false });
}
function drawRunningHeader(page: PDFPage, font: PDFFont, name: string) {
  page.drawText(name.toUpperCase(), {
    x: PAGE.margin,
    y: PAGE.height - 24,
    font,
    size: 7,
    color: COLORS.muted,
  });
}
function wrap(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of value.replace(/\s+/g, " ").trim().split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = `${line} ${word}`.trim();
      if (line && font.widthOfTextAtSize(candidate, size) > width) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}
function title(value: string) {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
