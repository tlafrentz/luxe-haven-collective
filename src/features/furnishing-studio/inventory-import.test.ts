import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  detectInventoryFile,
  escapeSpreadsheetCell,
  parseCsv,
  parseXlsx,
  proposeMapping,
  sanitizeFilename,
  validateMapping,
  validateRows,
} from "./inventory-import";

describe("FS-UX-003 inventory parsing", () => {
  it("validates extension, MIME, signature, size, and filename", () => {
    expect(
      detectInventoryFile(
        "stock.csv",
        "text/csv",
        new TextEncoder().encode("name,sku\nChair,C1"),
      ),
    ).toBe("csv");
    expect(
      detectInventoryFile(
        "stock.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1]),
      ),
    ).toBe("xlsx");
    expect(() =>
      detectInventoryFile(
        "stock.xlsx",
        "text/csv",
        new TextEncoder().encode("not zip"),
      ),
    ).toThrow("IMPORT_FILE_SIGNATURE_INVALID");
    expect(sanitizeFilename("../bad\u0000/name.csv")).toBe(".._bad__name.csv");
  });
  it("parses BOM, quoted delimiters, embedded lines, and escaped quotes", () => {
    const parsed = parseCsv(
      '\uFEFFProduct,Category,Retailer,SKU,URL\r\n"Chair, oak",Seating,Acme,C-1,"https://example.com/a"\r\n"Line\nBreak",Seating,Acme,C-2,https://example.com/b',
    );
    expect(parsed.sheets[0].rowCount).toBe(2);
    expect(parsed.sheets[0].rows[0][0]).toBe("Chair, oak");
    expect(parsed.sheets[0].rows[1][0]).toBe("Line\nBreak");
  });
  it("requires explicit selection from visible workbook sheets and ignores formula execution", async () => {
    const workbook = new ExcelJS.Workbook(),
      first = workbook.addWorksheet("Inventory"),
      second = workbook.addWorksheet("Archive", { state: "hidden" });
    first.addRow(["Product", "Category", "Retailer", "SKU", "URL"]);
    first.addRow([
      { formula: 'HYPERLINK("x")', result: "Lamp" },
      "Lighting",
      "Acme",
      "L1",
      "https://example.com/lamp",
    ]);
    second.addRow(["Hidden"]);
    second.addRow(["Value"]);
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer()),
      parsed = await parseXlsx(bytes);
    expect(parsed.sheets).toHaveLength(2);
    expect(parsed.sheets[0].rows[0][0]).toBe("Lamp");
    expect(parsed.sheets[1].hidden).toBe(true);
  });
});

describe("FS-UX-003 mapping and validation", () => {
  it("proposes aliases and rejects missing or duplicate canonical targets", () => {
    const mapping = proposeMapping([
      "Product Name",
      "Category",
      "Vendor",
      "SKU",
      "Price",
      "Currency",
      "URL",
    ]);
    expect(mapping["Product Name"]).toBe("name");
    expect(() => validateMapping({ ...mapping, Price: "name" })).toThrow(
      "IMPORT_MAPPING_TARGET_DUPLICATE",
    );
  });
  it("classifies valid, warning, and blocking rows with canonical priority", () => {
    const sheet = parseCsv(
        "Product,Category,Retailer,SKU,Price,Currency,URL,Priority\nChair,Seating,Acme,C1,129.99,USD,https://example.com/c,essential\nLamp,Lighting,Acme,L1,,USD,https://example.com/l,recommended\nBed,Beds,Acme,B1,bad,US, javascript:bad,required",
      ).sheets[0],
      rows = validateRows(sheet, proposeMapping(sheet.headers));
    expect(rows.map((x) => x.classification)).toEqual([
      "valid",
      "valid_with_warnings",
      "blocking_error",
    ]);
    expect(rows[2].issues.map((x) => x.code)).toEqual(
      expect.arrayContaining([
        "PRICE_INVALID",
        "CURRENCY_INVALID",
        "URL_INVALID",
        "PRIORITY_INVALID",
      ]),
    );
  });
  it("escapes spreadsheet formula prefixes in reports", () => {
    for (const value of ["=SUM(1,1)", "+cmd", "-2+3", "@link", "\tformula"])
      expect(escapeSpreadsheetCell(value)).toBe(`'${value}`);
    expect(escapeSpreadsheetCell("Chair")).toBe("Chair");
  });
});
