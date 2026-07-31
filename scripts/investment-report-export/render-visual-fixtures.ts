import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCanvas, type Canvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildInvestmentReportExportView } from "../../src/features/investment-report-export/domain/investment-report-export";
import { renderInvestmentReportPdf } from "../../src/features/investment-report-export/infrastructure/render-investment-report-pdf";
import { EXPORT_FIXTURE_NAMES, investmentReportExportFixture } from "../../src/features/investment-report-export/testing/export-fixtures";

async function main() {
 const output = process.argv[2] ?? "/tmp/investment-report-export-fixtures";
 await mkdir(output, { recursive: true });
 for (const name of EXPORT_FIXTURE_NAMES) {
  const report = investmentReportExportFixture(name);
  const view = buildInvestmentReportExportView({ reportId: report.id, title: report.title, strategy: report.strategy, generatedAt: report.generatedAt, snapshot: report.snapshot, exportedAt: new Date("2026-07-30T12:00:00Z") });
  const bytes = await renderInvestmentReportPdf(view);
  await writeFile(join(output, `${name}.pdf`), bytes);
  const pdf = await getDocument({ data: bytes.slice(), useSystemFonts: false, disableFontFace: true }).promise;
  const rendered: Canvas[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber), viewport = page.getViewport({ scale: 1.15 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvas: canvas as never, canvasContext: canvas.getContext("2d") as never, viewport }).promise;
    rendered.push(canvas);
    await writeFile(join(output, `${name}-page-${pageNumber}.png`), canvas.toBuffer("image/png"));
  }
  const thumbWidth = 260, gap = 18, columns = 3, thumbHeight = Math.round(thumbWidth * 792 / 612);
  const contact = createCanvas(columns * thumbWidth + (columns + 1) * gap, Math.ceil(rendered.length / columns) * thumbHeight + (Math.ceil(rendered.length / columns) + 1) * gap);
  const context = contact.getContext("2d"); context.fillStyle = "#d6d3d1"; context.fillRect(0, 0, contact.width, contact.height);
  rendered.forEach((canvas, index) => { const column = index % columns, row = Math.floor(index / columns); context.drawImage(canvas, gap + column * (thumbWidth + gap), gap + row * (thumbHeight + gap), thumbWidth, thumbHeight); });
  await writeFile(join(output, `${name}-contact-sheet.png`), contact.toBuffer("image/png"));
 }
 process.stdout.write(`${output}\n`);
}
void main();
