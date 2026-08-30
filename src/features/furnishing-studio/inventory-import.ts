import ExcelJS from "exceljs";

export const INVENTORY_IMPORT_LIMITS = Object.freeze({
  fileBytes: 25 * 1024 * 1024,
  worksheets: 20,
  rows: 25_000,
  columns: 200,
  cellCharacters: 20_000,
  imageUrls: 20,
  issuesPerRow: 50,
});

export type SourceSheet = {
  name: string;
  hidden: boolean;
  rowCount: number;
  headers: string[];
  rows: string[][];
};
export type ParsedInventory = {
  type: "csv" | "xlsx";
  sheets: SourceSheet[];
  warnings: string[];
};
export type Mapping = Record<string, string | null>;
export type ValidationIssue = {
  field: string;
  sourceColumn?: string;
  severity: "warning" | "blocking";
  code: string;
  explanation: string;
};
export type ValidatedRow = {
  sourceRow: number;
  original: Record<string, string>;
  canonical: Record<string, string>;
  classification: "valid" | "valid_with_warnings" | "blocking_error";
  issues: ValidationIssue[];
};

const extension = (name: string) =>
  name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
export function sanitizeFilename(name: string) {
  return (
    name
      .normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f/\\]/g, "_")
      .replace(/\s+/g, " ")
      .slice(0, 180) || "inventory"
  );
}
export function detectInventoryFile(
  name: string,
  mime: string,
  bytes: Uint8Array,
): "csv" | "xlsx" {
  if (!bytes.length) throw new Error("IMPORT_FILE_EMPTY");
  if (bytes.length > INVENTORY_IMPORT_LIMITS.fileBytes)
    throw new Error("IMPORT_FILE_TOO_LARGE");
  const ext = extension(name),
    zip =
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04;
  if (
    ext === "xlsx" &&
    zip &&
    /spreadsheet|excel|octet-stream|zip/i.test(
      mime || "application/octet-stream",
    )
  )
    return "xlsx";
  if (ext === "csv" && !zip && (!mime || /csv|text|octet-stream/i.test(mime)))
    return "csv";
  throw new Error("IMPORT_FILE_SIGNATURE_INVALID");
}

export function detectDelimiter(text: string) {
  let quoted = false,
    end = text.length;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if ((text[i] === "\n" || text[i] === "\r") && !quoted) {
      end = i;
      break;
    }
  }
  const header = text.slice(0, end),
    candidates = [",", "\t", ";", "|"];
  const scored = candidates
    .map((delimiter) => ({
      delimiter,
      count: parseCsvLine(header, delimiter).length,
    }))
    .filter((x) => x.count > 1)
    .sort((a, b) => b.count - a.count);
  if (!scored.length || (scored[1] && scored[1].count === scored[0].count))
    throw new Error("IMPORT_CSV_DELIMITER_AMBIGUOUS");
  return scored[0].delimiter;
}
function parseCsvLine(line: string, delimiter: string) {
  let field = "",
    quoted = false;
  const out: string[] = [];
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      out.push(field);
      field = "";
    } else field += c;
  }
  out.push(field);
  return out;
}
export function parseCsv(
  text: string,
  suppliedDelimiter?: string,
): ParsedInventory {
  const clean = text.replace(/^\uFEFF/, "");
  if (clean.includes("\uFFFD")) throw new Error("IMPORT_CSV_ENCODING_INVALID");
  const delimiter = suppliedDelimiter ?? detectDelimiter(clean);
  let field = "",
    row: string[] = [];
  const rows: string[][] = [];
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '"') {
      if (quoted && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += c;
  }
  if (quoted) throw new Error("IMPORT_CSV_MALFORMED_QUOTE");
  if (field || row.length) {
    row.push(field);
    if (row.some(Boolean)) rows.push(row);
  }
  return parsedSheet("csv", "CSV", rows, false);
}
const safeCell = (value: ExcelJS.CellValue): string => {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("formula" in value) return String(value.result ?? "");
    if ("richText" in value) return value.richText.map((x) => x.text).join("");
    if ("text" in value) return String(value.text);
    if ("hyperlink" in value)
      return String((value as { text?: unknown }).text ?? "");
  }
  return String(value);
};
function parsedSheet(
  type: "csv" | "xlsx",
  name: string,
  rows: string[][],
  hidden: boolean,
): ParsedInventory {
  if (rows.length < 2) throw new Error("IMPORT_HEADER_OR_ROWS_REQUIRED");
  if (rows.length - 1 > INVENTORY_IMPORT_LIMITS.rows)
    throw new Error("IMPORT_ROW_LIMIT_EXCEEDED");
  const width = Math.max(...rows.map((r) => r.length));
  if (width > INVENTORY_IMPORT_LIMITS.columns)
    throw new Error("IMPORT_COLUMN_LIMIT_EXCEEDED");
  if (
    rows.some((r) =>
      r.some((c) => c.length > INVENTORY_IMPORT_LIMITS.cellCharacters),
    )
  )
    throw new Error("IMPORT_CELL_LIMIT_EXCEEDED");
  const headers = rows[0].map((x) => x.trim());
  if (headers.some((h, i) => !h || headers.indexOf(h) !== i))
    throw new Error("IMPORT_HEADERS_INVALID");
  return {
    type,
    sheets: [
      { name, hidden, rowCount: rows.length - 1, headers, rows: rows.slice(1) },
    ],
    warnings: [],
  };
}
export async function parseXlsx(bytes: Uint8Array): Promise<ParsedInventory> {
  const workbook = new ExcelJS.Workbook();
  workbook.calcProperties.fullCalcOnLoad = false;
  try {
    await workbook.xlsx.load(
      bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
      { ignoreNodes: ["drawing", "picture", "extLst"] },
    );
  } catch {
    throw new Error("IMPORT_XLSX_UNSAFE_OR_MALFORMED");
  }
  if (workbook.worksheets.length > INVENTORY_IMPORT_LIMITS.worksheets)
    throw new Error("IMPORT_WORKSHEET_LIMIT_EXCEEDED");
  const sheets = workbook.worksheets.map((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) =>
      rows.push(
        Array.from({ length: row.cellCount }, (_, i) =>
          safeCell(row.getCell(i + 1).value),
        ),
      ),
    );
    return parsedSheet("xlsx", sheet.name, rows, sheet.state !== "visible")
      .sheets[0];
  });
  if (!sheets.some((s) => !s.hidden))
    throw new Error("IMPORT_VISIBLE_WORKSHEET_REQUIRED");
  return { type: "xlsx", sheets, warnings: [] };
}

const aliases: Record<string, string[]> = {
  name: ["product", "product name", "item", "item name", "name"],
  retailer: ["retailer", "vendor", "store"],
  sku: ["sku", "retailer sku", "item number"],
  brand: ["brand", "manufacturer"],
  variant: ["variant", "option"],
  category: ["category", "product category"],
  price: ["price", "unit price", "cost"],
  currency: ["currency", "currency code"],
  product_url: ["product url", "url", "link"],
  availability: ["availability", "stock"],
  description: ["description", "details"],
  color: ["color", "colour"],
  finish: ["finish"],
  materials: ["material", "materials"],
  width: ["width"],
  height: ["height"],
  depth: ["depth"],
  weight: ["weight"],
  dimensions_unit: ["dimension unit", "dimensions unit"],
  weight_unit: ["weight unit"],
  room_type: ["room", "room type"],
  priority: ["priority"],
  primary_image_url: ["image", "image url", "primary image url"],
};
export function proposeMapping(headers: string[]): Mapping {
  const result: Mapping = {};
  for (const header of headers) {
    const normalized = header.trim().toLowerCase().replace(/[_-]+/g, " ");
    result[header] =
      Object.entries(aliases).find(([, values]) =>
        values.includes(normalized),
      )?.[0] ?? null;
  }
  return result;
}
export function validateMapping(mapping: Mapping) {
  const targets = Object.values(mapping).filter(Boolean) as string[];
  if (new Set(targets).size !== targets.length)
    throw new Error("IMPORT_MAPPING_TARGET_DUPLICATE");
  if (
    !targets.includes("name") ||
    !targets.includes("category") ||
    (!targets.includes("retailer") && !targets.includes("product_url")) ||
    (!targets.includes("sku") && !targets.includes("product_url"))
  )
    throw new Error("IMPORT_MAPPING_REQUIRED_FIELDS");
}
const safeUrl = (value: string) => {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
};
export function validateRows(
  sheet: SourceSheet,
  mapping: Mapping,
): ValidatedRow[] {
  validateMapping(mapping);
  const byTarget = new Map(
    Object.entries(mapping)
      .filter((x): x is [string, string] => Boolean(x[1]))
      .map(([source, target]) => [target, source]),
  );
  return sheet.rows.map((cells, index) => {
    const original = Object.fromEntries(
        sheet.headers.map((h, i) => [h, cells[i]?.trim() ?? ""]),
      ),
      canonical = Object.fromEntries(
        [...byTarget].map(([target, source]) => [
          target,
          original[source] ?? "",
        ]),
      ),
      issues: ValidationIssue[] = [];
    const block = (field: string, code: string, explanation: string) =>
      issues.push({ field, severity: "blocking", code, explanation });
    const warn = (field: string, code: string, explanation: string) =>
      issues.push({ field, severity: "warning", code, explanation });
    if (!canonical.name)
      block("name", "NAME_REQUIRED", "Product name is required.");
    if (!canonical.category)
      block("category", "CATEGORY_REQUIRED", "Category is required.");
    if (!canonical.retailer && !canonical.product_url)
      block(
        "retailer",
        "SOURCE_IDENTITY_REQUIRED",
        "Retailer or product URL is required.",
      );
    if (!canonical.sku && !canonical.product_url)
      block(
        "sku",
        "STABLE_IDENTITY_REQUIRED",
        "SKU or product URL is required.",
      );
    if (canonical.product_url && !safeUrl(canonical.product_url))
      block(
        "product_url",
        "URL_INVALID",
        "Only valid HTTP(S) product URLs are accepted.",
      );
    if (canonical.primary_image_url && !safeUrl(canonical.primary_image_url))
      block(
        "primary_image_url",
        "IMAGE_URL_INVALID",
        "Only valid HTTP(S) image URLs are accepted.",
      );
    if (canonical.price && !/^\d+(?:\.\d{1,2})?$/.test(canonical.price))
      block(
        "price",
        "PRICE_INVALID",
        "Price must be a non-negative number with at most two decimals.",
      );
    if (
      canonical.currency &&
      !/^[A-Z]{3}$/.test(canonical.currency.toUpperCase())
    )
      block(
        "currency",
        "CURRENCY_INVALID",
        "Currency must use a three-letter code.",
      );
    if (
      canonical.priority &&
      !["essential", "recommended", "optional"].includes(
        canonical.priority.toLowerCase(),
      )
    )
      block(
        "priority",
        "PRIORITY_INVALID",
        "Priority must be Essential, Recommended, or Optional.",
      );
    if (!canonical.price)
      warn(
        "price",
        "PRICE_MISSING",
        "Commercial products should include a price.",
      );
    return {
      sourceRow: index + 2,
      original,
      canonical,
      issues: issues.slice(0, INVENTORY_IMPORT_LIMITS.issuesPerRow),
      classification: issues.some((x) => x.severity === "blocking")
        ? "blocking_error"
        : issues.length
          ? "valid_with_warnings"
          : "valid",
    };
  });
}
export function escapeSpreadsheetCell(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
