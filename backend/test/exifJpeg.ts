// Builds a tiny JPEG with an EXIF APP1 segment (IFD0 DateTime/Software + GPS IFD) for tests.
const TINY_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

type Entry = { tag: number; type: 2 | 4 | 5; count: number; value: Uint8Array };

const u16 = (n: number) => [n & 0xff, n >> 8];
const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24];
const ascii = (s: string) => new TextEncoder().encode(s + "\0");
const rationals = (vals: number[]) => new Uint8Array(vals.flatMap((v) => [...u32(Math.round(v * 1000)), ...u32(1000)]));

function ifd(entries: Entry[], start: number): { bytes: number[]; size: number } {
  const headerSize = 2 + entries.length * 12 + 4;
  let dataOffset = start + headerSize;
  const head: number[] = [...u16(entries.length)];
  const data: number[] = [];
  for (const e of entries) {
    head.push(...u16(e.tag), ...u16(e.type), ...u32(e.count));
    if (e.value.length <= 4) {
      head.push(...e.value, ...new Array(4 - e.value.length).fill(0));
    } else {
      head.push(...u32(dataOffset));
      data.push(...e.value);
      dataOffset += e.value.length;
    }
  }
  head.push(...u32(0));
  return { bytes: [...head, ...data], size: headerSize + data.length };
}

export function makeExifJpeg(opts: { lat?: [number, number, number]; latRef?: string; lon?: [number, number, number]; lonRef?: string; dateTime?: string; software?: string }) {
  const ifd0Entries: Entry[] = [];
  if (opts.software) ifd0Entries.push({ tag: 0x0131, type: 2, count: opts.software.length + 1, value: ascii(opts.software) });
  if (opts.dateTime) ifd0Entries.push({ tag: 0x0132, type: 2, count: 20, value: ascii(opts.dateTime) });
  const hasGps = !!opts.lat && !!opts.lon;
  if (hasGps) ifd0Entries.push({ tag: 0x8825, type: 4, count: 1, value: new Uint8Array(4) });

  // Pass 1 to size IFD0, then patch the GPS pointer.
  let ifd0 = ifd(ifd0Entries, 8);
  if (hasGps) {
    ifd0Entries[ifd0Entries.length - 1].value = new Uint8Array(u32(8 + ifd0.size));
    ifd0 = ifd(ifd0Entries, 8);
  }
  const gps = hasGps
    ? ifd([
        { tag: 1, type: 2, count: 2, value: ascii(opts.latRef ?? "N") },
        { tag: 2, type: 5, count: 3, value: rationals(opts.lat!) },
        { tag: 3, type: 2, count: 2, value: ascii(opts.lonRef ?? "E") },
        { tag: 4, type: 5, count: 3, value: rationals(opts.lon!) },
      ], 8 + ifd0.size).bytes
    : [];

  const tiff = [0x49, 0x49, 0x2a, 0x00, ...u32(8), ...ifd0.bytes, ...gps];
  const app1Payload = [...new TextEncoder().encode("Exif\0\0"), ...tiff];
  const app1 = [0xff, 0xe1, (app1Payload.length + 2) >> 8, (app1Payload.length + 2) & 0xff, ...app1Payload];
  const tiny = Uint8Array.from(atob(TINY_JPEG_B64), (ch) => ch.charCodeAt(0));
  return new Uint8Array([0xff, 0xd8, ...app1, ...tiny.slice(2)]);
}

export const exifDate = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ").replace(/-/g, ":");
