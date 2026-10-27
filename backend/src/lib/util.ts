import { fail } from "../errors";

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);

/** Detects image/PDF type from magic bytes (replaces Pillow's verify()). */
export function sniffMime(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf, 0, Math.min(buf.byteLength, 16));
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith(b, [0x42, 0x4d])) return "image/bmp";
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/bmp": ".bmp", "application/pdf": ".pdf",
};

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

/** Lowercases, strips 0x, and validates a 64-char hex SHA-256. Throws on invalid input. */
export function normalizeSha256(input: string): string {
  let h = String(input).trim().toLowerCase();
  if (h.startsWith("0x")) h = h.slice(2);
  if (!/^[0-9a-f]{64}$/.test(h)) throw new Error(`Invalid SHA-256 hash: must be 64 hex characters, got '${input}'`);
  return h;
}

export const randomHex = (bytes: number) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** JSON.stringify with recursively sorted keys (Python's json.dumps(sort_keys=True) equivalent, minus whitespace). */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((value as any)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Uploaded multipart file, or 400. */
export const formFile = (value: unknown, message: string): File => (value instanceof File ? value : fail(400, message));
