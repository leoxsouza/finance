import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { base64ToUint8Array, stripFirstPage, uint8ArrayToBase64 } from "../../pdf/utils";

describe("pdf utils", () => {
  it("converts bytes to base64 and back", () => {
    const original = new TextEncoder().encode("sample-data");
    const base64 = uint8ArrayToBase64(original);
    const restored = base64ToUint8Array(base64);
    expect(restored).toEqual(original);
  });

  it("removes the first page when requested", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.addPage();
    const bytes = await doc.save();

    const stripped = await stripFirstPage(bytes);
    const strippedDoc = await PDFDocument.load(stripped);
    expect(strippedDoc.getPageCount()).toBe(1);
  });
});
