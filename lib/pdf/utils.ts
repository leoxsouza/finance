import { PDFDocument } from "pdf-lib";

const BASE64_PREFIX = "data:application/pdf;base64,";

export type StripPageOptions = {
  pageIndex?: number;
};

const hasBuffer = typeof Buffer !== "undefined";

export async function pdfFileToBase64(file: File): Promise<string> {
  if (file.type && file.type !== "application/pdf") {
    throw new Error("Only PDF files are supported");
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return uint8ArrayToBase64(bytes);
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return "";
  }

  if (hasBuffer) {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const normalized = base64.startsWith(BASE64_PREFIX) ? base64.slice(BASE64_PREFIX.length) : base64;

  if (hasBuffer) {
    return new Uint8Array(Buffer.from(normalized, "base64"));
  }

  const binary = atob(normalized);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bufferLikeToUint8Array(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

export async function stripFirstPage(buffer: Uint8Array | ArrayBuffer, options: StripPageOptions = {}): Promise<Uint8Array> {
  const bytes = bufferLikeToUint8Array(buffer);
  const pageIndex = Math.max(options.pageIndex ?? 0, 0);
  const sourceDoc = await PDFDocument.load(bytes);

  if (sourceDoc.getPageCount() <= 1) {
    return bytes;
  }

  const targetDoc = await PDFDocument.create();
  const indices = sourceDoc.getPageIndices().filter((index) => index !== pageIndex);
  const copiedPages = await targetDoc.copyPages(sourceDoc, indices);
  copiedPages.forEach((page) => targetDoc.addPage(page));

  return targetDoc.save();
}

export async function maybeStripFirstPage(base64: string, ignoreFirstPage?: boolean): Promise<string> {
  if (!ignoreFirstPage) {
    return base64;
  }

  const bytes = base64ToUint8Array(base64);
  const stripped = await stripFirstPage(bytes);
  return uint8ArrayToBase64(stripped);
}
