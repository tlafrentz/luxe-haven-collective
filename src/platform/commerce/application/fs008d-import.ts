import ExcelJS from "exceljs";
import { classifyFormulaCell, type FormulaEvidence } from "./fs008d-formula-policy";

export type Fs008dRowResult = Readonly<{ sheet: string; sourceRow: number; outcome: "valid" | "needs_review" | "invalid" | "rejected"; productId?: string; offerUrl?: string; canonicalExtendedCost?: number; formulaEvidence: FormulaEvidence[]; reasons: readonly string[] }>;

const text = (value: unknown) => typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
const number = (value: unknown) => typeof value === "number" ? value : Number(text(value));

export async function parseFs008dWorkbook(buffer: Buffer, correlationId: string): Promise<readonly Fs008dRowResult[]> {
  const workbook = new ExcelJS.Workbook();
  const workbookBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(workbookBuffer);
  const sheet = workbook.getWorksheet("Catalog Review");
  if (!sheet) throw new Error("FS008D_CATALOG_REVIEW_SHEET_REQUIRED");
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => headers.set(text(cell.value).toLowerCase(), column));
  const column = (...names: string[]) => names.map((name) => headers.get(name.toLowerCase())).find((value): value is number => value !== undefined);
  const productColumn = column("Product ID", "ProductId");
  const roomColumn = column("Room");
  const itemColumn = column("Item", "Product");
  const retailerColumn = column("Retailer");
  const quantityColumn = column("Quantity");
  const unitPriceColumn = column("Unit price", "Unit Price");
  const extendedColumn = column("Extended Cost", "Extended cost");
  if (!productColumn || !roomColumn || !itemColumn || !retailerColumn || !quantityColumn || !unitPriceColumn) throw new Error("FS008D_REQUIRED_HEADER_MISSING");
  const results: Fs008dRowResult[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const productId = text(row.getCell(productColumn).value), room = text(row.getCell(roomColumn).value), item = text(row.getCell(itemColumn).value), retailer = text(row.getCell(retailerColumn).value);
    if (![productId, room, item, retailer].some(Boolean)) return;
    const quantity = number(row.getCell(quantityColumn).value), unitPrice = number(row.getCell(unitPriceColumn).value);
    const evidence: FormulaEvidence[] = [];
    const extendedCell = extendedColumn ? row.getCell(extendedColumn) : undefined;
    if (extendedCell?.type === ExcelJS.ValueType.Formula) {
      const formula = extendedCell.value as ExcelJS.CellFormulaValue;
      evidence.push(classifyFormulaCell({ sheet: sheet.name, address: extendedCell.address, sourceRow: rowNumber, column: "Extended Cost", formula: formula.formula, cachedValue: formula.result, quantity, unitPrice, correlationId }));
    }
    const reasons: string[] = [];
    if (!Number.isFinite(quantity) || quantity <= 0) reasons.push("invalid_quantity");
    if (!Number.isFinite(unitPrice) || unitPrice < 0) reasons.push("invalid_unit_price");
    const canonical = Number.isFinite(quantity) && Number.isFinite(unitPrice) ? Math.round(quantity * unitPrice * 100) / 100 : undefined;
    if (evidence.some((entry) => entry.outcome === "needs_review")) reasons.push("extended_cost_cache_mismatch");
    if (evidence.some((entry) => entry.outcome === "rejected_formula_cell")) reasons.push("unsupported_formula");
    results.push({ sheet: sheet.name, sourceRow: rowNumber, outcome: reasons.some((reason) => reason === "unsupported_formula") ? "rejected" : reasons.length ? "needs_review" : "valid", productId, offerUrl: text(row.getCell(column("Source URL", "URL") ?? 0).value), canonicalExtendedCost: canonical, formulaEvidence: evidence, reasons });
  });
  return results;
}
