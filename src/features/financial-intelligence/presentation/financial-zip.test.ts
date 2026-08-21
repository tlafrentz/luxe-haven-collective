import { writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildZipArchive, crc32 } from "./financial-zip";

function readStoredZip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = new Map<string, string>();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const nameLength = view.getUint16(offset + 26, true);
    const size = view.getUint32(offset + 22, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength;
    const name = decoder.decode(bytes.subarray(nameStart, dataStart));
    const data = bytes.subarray(dataStart, dataStart + size);
    files.set(name, decoder.decode(data));
    offset = dataStart + size;
  }
  return files;
}

describe("financial-zip", () => {
  it("matches the standard CRC-32 test vector for the ASCII digits 1-9", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xCBF43926);
  });
  it("round-trips multiple files through a hand-parsed reader with exact content preserved", () => {
    const files = new Map([
      ["financial-summary.csv", "Scope,Full Workspace\r\nCurrency,USD\r\n"],
      ["expense-detail.csv", "Category,Amount\r\nCleaning,\"$842\"\r\n"],
    ]);
    const archive = buildZipArchive(files);
    expect(archive.length).toBeGreaterThan(0);
    const extracted = readStoredZip(archive);
    expect(extracted.get("financial-summary.csv")).toBe(files.get("financial-summary.csv"));
    expect(extracted.get("expense-detail.csv")).toBe(files.get("expense-detail.csv"));
    expect(extracted.size).toBe(2);
  });
  it("produces a real ZIP file that the system unzip utility accepts and extracts correctly", () => {
    const files = new Map([
      ["financial-summary.csv", "Scope,Full Workspace\r\nCurrency,USD\r\n"],
      ["expense-detail.csv", "Category,Amount\r\nCleaning,\"$842\"\r\n"],
    ]);
    const archive = buildZipArchive(files);
    const path = join(tmpdir(), `financial-zip-test-${crypto.randomUUID()}.zip`);
    writeFileSync(path, archive);
    try {
      const listing = execFileSync("unzip", ["-l", path], { encoding: "utf-8" });
      expect(listing).toContain("financial-summary.csv");
      expect(listing).toContain("expense-detail.csv");
      const extracted = execFileSync("unzip", ["-p", path, "expense-detail.csv"], { encoding: "utf-8" });
      expect(extracted).toBe(files.get("expense-detail.csv"));
    } finally {
      unlinkSync(path);
    }
  });
});
