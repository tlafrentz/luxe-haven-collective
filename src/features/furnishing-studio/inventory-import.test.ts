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
  async function workbookBytes(
    sheets: Array<{
      name: string;
      rows: unknown[][];
      formatColumn?: number;
    }>,
  ) {
    const workbook = new ExcelJS.Workbook();
    for (const fixture of sheets) {
      const sheet = workbook.addWorksheet(fixture.name);
      fixture.rows.forEach((row) => sheet.addRow(row));
      if (fixture.formatColumn)
        sheet.getColumn(fixture.formatColumn).width = 24;
    }
    return new Uint8Array(await workbook.xlsx.writeBuffer());
  }

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

  it("ignores trailing formatted and internal wholly blank XLSX columns", async () => {
    const parsed = await parseXlsx(
      await workbookBytes([
        {
          name: "Inventory",
          rows: [
            ["Product", "", "Category", "Retailer", "SKU"],
            ["Chair", "", "Seating", "Acme", "C1"],
          ],
          formatColumn: 12,
        },
      ]),
    );
    expect(parsed.sheets[0].columns.map((column) => column.address)).toEqual([
      "A",
      "C",
      "D",
      "E",
    ]);
    expect(parsed.sheets[0].rows[0]).toEqual([
      "Chair",
      "Seating",
      "Acme",
      "C1",
    ]);
  });

  it("identifies a populated headerless XLSX column without exposing its values", async () => {
    await expect(
      parseXlsx(
        await workbookBytes([
          {
            name: "Inventory",
            rows: [
              ["Product", "", "Category"],
              ["Chair", "private value", "Seating"],
            ],
          },
        ]),
      ),
    ).rejects.toThrow("IMPORT_HEADER_REQUIRED:Inventory:B");
  });

  it("keeps duplicate XLSX headers as stable, disambiguated columns", async () => {
    const bytes = await workbookBytes([
        {
          name: "Inventory",
          rows: [
            ["Product", "Price", " price ", "Category"],
            ["Chair", "100", "125", "Seating"],
          ],
        },
      ]),
      first = await parseXlsx(bytes),
      replay = await parseXlsx(bytes),
      sheet = first.sheets[0];
    expect(sheet.columns.map((column) => column.id)).toEqual([
      "xlsx:A",
      "xlsx:B",
      "xlsx:C",
      "xlsx:D",
    ]);
    expect(sheet.columns[1].displayLabel).toContain("B, occurrence 1");
    expect(sheet.columns[2].displayLabel).toContain("C, occurrence 2");
    expect(sheet.rows[0].slice(1, 3)).toEqual(["100", "125"]);
    expect(replay).toEqual(first);
    expect(proposeMapping(sheet)["xlsx:B"]).toBeNull();
    expect(proposeMapping(sheet)["xlsx:C"]).toBeNull();
  });

  it("scopes duplicate identities to each worksheet", async () => {
    const parsed = await parseXlsx(
      await workbookBytes([
        {
          name: "One",
          rows: [
            ["Product", "Product"],
            ["Chair", "Lamp"],
          ],
        },
        {
          name: "Two",
          rows: [
            ["Product", "Product"],
            ["Sofa", "Desk"],
          ],
        },
      ]),
    );
    expect(parsed.sheets[0].columns.map((column) => column.id)).toEqual([
      "xlsx:A",
      "xlsx:B",
    ]);
    expect(parsed.sheets[1].columns.map((column) => column.id)).toEqual([
      "xlsx:A",
      "xlsx:B",
    ]);
    expect(parsed.sheets[0].rows[0]).not.toEqual(parsed.sheets[1].rows[0]);
  });

  it("detects a tabular header after harmless worksheet preamble rows", async () => {
    const parsed = await parseXlsx(
      await workbookBytes([
        {
          name: "Catalog Review",
          rows: [
            ["Controlled catalog review"],
            [],
            ["Prepared for governed import"],
            ["Product ID", "Item", "Category", "Retailer", "Source URL"],
            ["C-1", "Chair", "Seating", "Acme", "https://example.com/c"],
          ],
        },
      ]),
    );
    expect(parsed.sheets[0].headerRow).toBe(4);
    expect(parsed.sheets[0].columns.map((column) => column.address)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    expect(parsed.sheets[0].rows).toEqual([
      ["C-1", "Chair", "Seating", "Acme", "https://example.com/c"],
    ]);
    const mapping = proposeMapping(parsed.sheets[0]);
    mapping["xlsx:A"] = "sku";
    mapping["xlsx:E"] = "product_url";
    expect(validateRows(parsed.sheets[0], mapping)[0].sourceRow).toBe(5);
  });

  it("quarantines an invalid worksheet while preserving valid worksheet selection", async () => {
    const parsed = await parseXlsx(
      await workbookBytes([
        {
          name: "Dashboard",
          rows: [
            ["Metric", "", ""],
            ["Products", "", "private value"],
          ],
        },
        {
          name: "Catalog Review",
          rows: [
            ["Product", "Category", "Retailer", "SKU"],
            ["Chair", "Seating", "Acme", "C1"],
          ],
        },
      ]),
    );
    expect(parsed.sheets[0].structuralError).toBe(
      "IMPORT_HEADER_REQUIRED:Dashboard:C",
    );
    expect(parsed.sheets[0].rows).toEqual([]);
    expect(parsed.sheets[1].structuralError).toBeUndefined();
    expect(proposeMapping(parsed.sheets[1])["xlsx:A"]).toBe("name");
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
  it("persists duplicate-column mapping by internal identifier through validation", async () => {
    const workbook = new ExcelJS.Workbook(),
      worksheet = workbook.addWorksheet("Inventory");
    worksheet.addRow([
      "Product",
      "Category",
      "Retailer",
      "SKU",
      "Price",
      "Price",
    ]);
    worksheet.addRow(["Chair", "Seating", "Acme", "C1", "100", "125"]);
    const sheet = (
        await parseXlsx(new Uint8Array(await workbook.xlsx.writeBuffer()))
      ).sheets[0],
      mapping = proposeMapping(sheet);
    mapping["xlsx:E"] = "price";
    const serialized = JSON.parse(JSON.stringify(mapping));
    const rows = validateRows(sheet, serialized);
    expect(rows[0].original["xlsx:E"]).toBe("100");
    expect(rows[0].original["xlsx:F"]).toBe("125");
    expect(rows[0].canonical.price).toBe("100");
  });

  it("keeps CSV headers and mapping identifiers unchanged", () => {
    const sheet = parseCsv(
      "Product,Category,Retailer,SKU\nChair,Seating,Acme,C1",
    ).sheets[0];
    expect(sheet.headers).toEqual(["Product", "Category", "Retailer", "SKU"]);
    expect(sheet.columns.map((column) => column.id)).toEqual(sheet.headers);
    expect(proposeMapping(sheet)).toEqual(proposeMapping(sheet.headers));
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
