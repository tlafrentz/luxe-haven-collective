import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import sharp from "sharp";
describe("Guidebook QR distribution", () => {
  it("decodes to the exact stable public destination", async () => {
    const destination =
        "https://luxe.example/g/aaaaaaaaaaaaaaaaaaaaaaaa?source=qr",
      svg = await QRCode.toString(destination, {
        type: "svg",
        width: 512,
        margin: 4,
      }),
      { data, info } = await sharp(Buffer.from(svg))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
      decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    expect(decoded?.data).toBe(destination);
    expect(svg).not.toMatch(/owner|workspace|credential/);
  });
});
