import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { canonicalizeRetailerUrl } from "./catalog";
import { normalizeOfferTarget } from "./catalog-offer-normalization";

const workbookPath = "docs/evidence/FS-008D/source/Catalog Review (1).xlsx";
const affected = new Map([
  [35, "Ironing Table"], [37, "Writing Desk"], [38, "Pillows Firm"],
  [39, "Pillows Soft"], [53, "Curved Shower Rod"], [54, "Wall art"],
  [56, "Plants"], [57, "Tray"], [104, "Bowls"], [109, "Batteries"],
  [110, "Lightbulbs"],
]);
const cellText = (value: ExcelJS.CellValue) => {
  if (value && typeof value === "object" && "hyperlink" in value) return String(value.hyperlink ?? value.text ?? "");
  if (value && typeof value === "object" && "result" in value) return String(value.result ?? "");
  return String(value ?? "").trim();
};

describe("FS-008G-C7 authoritative workbook offer normalization", () => {
  it("resolves all 11 affected amzn.to rows, including row 35, to one server-derived tuple", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(workbookPath);
    const sheet = workbook.getWorksheet("Catalog Review")!;
    const headers = (sheet.getRow(4).values as ExcelJS.CellValue[]).map((value) => cellText(value).toLowerCase());
    const itemColumn = headers.indexOf("item");
    const linkColumn = Math.max(headers.indexOf("link"), headers.indexOf("source url"));
    const targets = [{ retailerId: "amazon-id", hostname: "amzn.to", provenance: "allowlisted_alias" as const }];
    for (const [rowNumber, expectedName] of affected) {
      const row = sheet.getRow(rowNumber);
      const item = cellText(row.getCell(itemColumn).value);
      const cell = row.getCell(linkColumn).value;
      const url = cell && typeof cell === "object" && "hyperlink" in cell ? String(cell.hyperlink) : String(cell ?? "");
      expect(item.toLowerCase().replace(/[^a-z0-9]+/g, " ")).toContain(expectedName.toLowerCase().replace(/[^a-z0-9]+/g, " "));
      expect(normalizeOfferTarget(url, targets, canonicalizeRetailerUrl)).toMatchObject({
        status: "resolved", retailerId: "amazon-id", hostname: "amzn.to", provenance: "allowlisted_alias",
      });
    }
  });

  it("fails closed on absent, ambiguous, and spoofed hostname mappings", () => {
    const canonical = canonicalizeRetailerUrl;
    expect(normalizeOfferTarget("https://unknown.example/item", [], canonical).status).toBe("needs_review");
    expect(normalizeOfferTarget("https://notamazon.com/item", [{ retailerId: "a", hostname: "amazon.com", provenance: "retailer_domain" }], canonical).status).toBe("needs_review");
    expect(normalizeOfferTarget("https://shop.example/item", [
      { retailerId: "a", hostname: "shop.example", provenance: "allowlisted_alias" },
      { retailerId: "b", hostname: "shop.example", provenance: "allowlisted_alias" },
    ], canonical).status).toBe("needs_review");
  });
});
