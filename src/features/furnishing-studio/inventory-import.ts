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

export type SourceColumn = {
  index: number;
  address: string;
  header: string;
  normalizedHeader: string;
  id: string;
  displayLabel: string;
};
export type SourceSheet = {
  name: string;
  hidden: boolean;
  headerRow: number;
  rowCount: number;
  headers: string[];
  columns: SourceColumn[];
  rows: string[][];
  structuralError?: string;
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
  const columns = headers.map((header, index) => ({
    index,
    address: String(index + 1),
    header,
    normalizedHeader: normalizeHeader(header),
    id: header,
    displayLabel: header,
  }));
  return {
    type,
    sheets: [
      {
        name,
        hidden,
        headerRow: 1,
        rowCount: rows.length - 1,
        headers,
        columns,
        rows: rows.slice(1),
      },
    ],
    warnings: [],
  };
}

const normalizeHeader = (header: string) =>
  header.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

function columnAddress(index: number) {
  let value = index + 1,
    result = "";
  while (value > 0) {
    value--;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function parsedXlsxSheet(
  name: string,
  rawRows: string[][],
  hidden: boolean,
): SourceSheet {
  if (rawRows.length < 2) throw new Error("IMPORT_HEADER_OR_ROWS_REQUIRED");
  const candidates = rawRows
    .slice(0, Math.min(25, rawRows.length - 1))
    .map((row, index) => {
      const populated = row.map((cell) => cell.trim()).filter(Boolean);
      return {
        index,
        populated: populated.length,
        unique: new Set(populated.map(normalizeHeader)).size,
      };
    })
    .filter((candidate) => candidate.populated > 0);
  const maximumPopulated = Math.max(
    0,
    ...candidates.map((candidate) => candidate.populated),
  );
  const headerIndex = candidates.find(
    (candidate) =>
      candidate.populated >= Math.max(1, Math.ceil(maximumPopulated * 0.75)) &&
      candidate.unique / candidate.populated >= 0.5,
  )?.index;
  if (headerIndex === undefined)
    throw new Error("IMPORT_HEADER_OR_ROWS_REQUIRED");
  const dataRows = rawRows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell.trim()));
  if (!dataRows.length) throw new Error("IMPORT_HEADER_OR_ROWS_REQUIRED");
  if (dataRows.length > INVENTORY_IMPORT_LIMITS.rows)
    throw new Error("IMPORT_ROW_LIMIT_EXCEEDED");
  const width = Math.max(...rawRows.map((row) => row.length));
  if (width > INVENTORY_IMPORT_LIMITS.columns)
    throw new Error("IMPORT_COLUMN_LIMIT_EXCEEDED");
  if (
    rawRows.some((row) =>
      row.some((cell) => cell.length > INVENTORY_IMPORT_LIMITS.cellCharacters),
    )
  )
    throw new Error("IMPORT_CELL_LIMIT_EXCEEDED");

  const kept: Array<{ index: number; header: string }> = [];
  for (let index = 0; index < width; index++) {
    const header = (rawRows[headerIndex][index] ?? "").trim();
    const populated = dataRows.some(
      (row) => (row[index] ?? "").trim().length > 0,
    );
    if (!header && !populated) continue;
    if (!header)
      throw new Error(`IMPORT_HEADER_REQUIRED:${name}:${columnAddress(index)}`);
    kept.push({ index, header });
  }
  if (!kept.length) throw new Error("IMPORT_HEADER_OR_ROWS_REQUIRED");

  const occurrences = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const { header } of kept) {
    const normalized = normalizeHeader(header);
    totals.set(normalized, (totals.get(normalized) ?? 0) + 1);
  }
  const columns = kept.map(({ index, header }) => {
    const normalizedHeader = normalizeHeader(header);
    const occurrence = (occurrences.get(normalizedHeader) ?? 0) + 1;
    occurrences.set(normalizedHeader, occurrence);
    const address = columnAddress(index);
    return {
      index,
      address,
      header,
      normalizedHeader,
      id: `xlsx:${address}`,
      displayLabel:
        (totals.get(normalizedHeader) ?? 0) > 1
          ? `${header} (${address}, occurrence ${occurrence})`
          : header,
    };
  });
  return {
    name,
    hidden,
    headerRow: headerIndex + 1,
    rowCount: dataRows.length,
    headers: columns.map((column) => column.id),
    columns,
    rows: dataRows.map((row) => kept.map(({ index }) => row[index] ?? "")),
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
    let meaningfulWidth = 0,
      meaningfulHeight = 0;
    sheet.eachRow({ includeEmpty: false }, (row) =>
      row.eachCell({ includeEmpty: false }, (cell, column) => {
        if (safeCell(cell.value).trim()) {
          meaningfulWidth = Math.max(meaningfulWidth, column);
          meaningfulHeight = Math.max(meaningfulHeight, row.number);
        }
      }),
    );
    const rows: string[][] = [];
    for (let rowNumber = 1; rowNumber <= meaningfulHeight; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      rows.push(
        Array.from({ length: meaningfulWidth }, (_, i) =>
          safeCell(row.getCell(i + 1).value),
        ),
      );
    }
    try {
      return parsedXlsxSheet(sheet.name, rows, sheet.state !== "visible");
    } catch (error) {
      const code =
        error instanceof Error ? error.message : "IMPORT_SHEET_INVALID";
      return {
        name: sheet.name,
        hidden: sheet.state !== "visible",
        headerRow: 1,
        rowCount: 0,
        headers: [],
        columns: [],
        rows: [],
        structuralError: code,
      } satisfies SourceSheet;
    }
  });
  const visible = sheets.filter((sheet) => !sheet.hidden);
  if (!visible.some((sheet) => !sheet.structuralError))
    throw new Error(
      visible[0]?.structuralError ?? "IMPORT_VISIBLE_WORKSHEET_REQUIRED",
    );
  if (!visible.length) throw new Error("IMPORT_VISIBLE_WORKSHEET_REQUIRED");
  return {
    type: "xlsx",
    sheets,
    warnings: visible.flatMap((sheet) =>
      sheet.structuralError ? [sheet.structuralError] : [],
    ),
  };
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
export function proposeMapping(
  source: string[] | SourceColumn[] | SourceSheet,
): Mapping {
  const columns = Array.isArray(source)
    ? source.map((value, index) =>
        typeof value === "string"
          ? {
              index,
              address: String(index + 1),
              header: value,
              normalizedHeader: normalizeHeader(value),
              id: value,
              displayLabel: value,
            }
          : value,
      )
    : source.columns;
  const duplicateHeaders = new Set(
    columns
      .map((column) => column.normalizedHeader)
      .filter(
        (header, index, all) =>
          all.indexOf(header) !== index || all.lastIndexOf(header) !== index,
      ),
  );
  const result: Mapping = {};
  for (const column of columns) {
    result[column.id] = duplicateHeaders.has(column.normalizedHeader)
      ? null
      : (Object.entries(aliases).find(([, values]) =>
          values.includes(column.normalizedHeader),
        )?.[0] ?? null);
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
      sourceRow: index + sheet.headerRow + 1,
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
