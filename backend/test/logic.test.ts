import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/auth";
import { analyzeExifGps, extractGps } from "../src/lib/exif";
import { extractOne, ratio, tokenSetRatio } from "../src/lib/fuzzy";
import { canonicalJson, haversineM, normalizeSha256, sniffMime } from "../src/lib/util";
import { calculateZscore, evaluateAnomaly, normalizeUnit } from "../src/services/store";
import { exifDate, makeExifJpeg } from "./exifJpeg";

const SITE = { siteLatitude: 20.03639, siteLongitude: 73.79959, fileName: "t.jpg" };
const buf = (u: Uint8Array) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

describe("exif analyzer", () => {
  it("passes a fresh on-site photo and flags editing software", async () => {
    const jpg = makeExifJpeg({ lat: [20, 2, 11], lon: [73, 47, 58.5], dateTime: exifDate(new Date(Date.now() - 3600_000)), software: "Snapseed" });
    const r = await analyzeExifGps(buf(jpg), { ...SITE, siteRadiusM: 500 });
    const by = Object.fromEntries(r.checks.map((c) => [c.name, c]));
    expect(by.gps_geofence.status).toBe("PASS");
    expect(by.capture_time.status).toBe("PASS");
    expect(by.editing_software.status).toBe("WARNING");
    expect(r.overall_status).toBe("REVIEW_REQUIRED");
  });

  it("fails off-site, stale and duplicate photos", async () => {
    const jpg = makeExifJpeg({ lat: [28, 37, 0], lon: [77, 21, 0], dateTime: "2020:01:01 00:00:00" });
    const first = await analyzeExifGps(buf(jpg), SITE);
    const r = await analyzeExifGps(buf(jpg), { ...SITE, knownHashes: new Set([first.file_sha256]) });
    const by = Object.fromEntries(r.checks.map((c) => [c.name, c.status]));
    expect(by).toMatchObject({ gps_geofence: "FAIL", capture_time: "FAIL", sha256_duplicate: "FAIL" });
    expect(r.overall_status).toBe("FLAGGED");
  });

  it("warns when metadata is absent and marks unreadable files NOT_CHECKED", async () => {
    const noExif = await analyzeExifGps(buf(makeExifJpeg({})), SITE);
    expect(noExif.checks.find((c) => c.name === "gps_geofence")!.status).toBe("WARNING");
    const garbage = await analyzeExifGps(new TextEncoder().encode("not an image").buffer as ArrayBuffer, SITE);
    expect(garbage.checks.find((c) => c.name === "gps_geofence")!.status).toBe("NOT_CHECKED");
  });

  it("applies hemisphere refs and rejects bad refs", () => {
    expect(extractGps({ GPSLatitude: [10, 30, 0], GPSLatitudeRef: "S", GPSLongitude: [5, 0, 0], GPSLongitudeRef: "W" })).toEqual({ latitude: -10.5, longitude: -5 });
    expect(extractGps({ GPSLatitude: [10, 0, 0], GPSLatitudeRef: "X", GPSLongitude: [5, 0, 0], GPSLongitudeRef: "E" })).toBeNull();
  });
});

describe("fuzzy matching (rapidfuzz parity)", () => {
  it("matches rapidfuzz reference scores", () => {
    expect(ratio("this is a test", "this is a test!")).toBeCloseTo(96.55, 1);
    expect(tokenSetRatio("fuzzy was a bear", "fuzzy fuzzy was a bear")).toBe(100);
    expect(tokenSetRatio("", "abc")).toBe(0);
  });
  it("picks the closest material", () => {
    expect(extractOne("opc cement 53", ["OPC 53 Cement", "TMT Steel Rebar 12mm"])).toEqual(["OPC 53 Cement", 100]);
  });
});

describe("anomaly detection", () => {
  const base = { tolerance: 0.15, zLimit: 2.5, planned: 15000, alreadyIssued: 0, progress: 0.4, dailyTotals: [] as number[] };
  it("is ok within expected usage", () => expect(evaluateAnomaly({ ...base, newQtyBase: 6000 }).level).toBe("ok"));
  it("warns slightly above tolerance and alerts far above", () => {
    expect(evaluateAnomaly({ ...base, newQtyBase: 7000 }).level).toBe("warn");
    expect(evaluateAnomaly({ ...base, newQtyBase: 9000 }).level).toBe("alert");
  });
  it("warns with no verified progress", () => expect(evaluateAnomaly({ ...base, progress: 0, newQtyBase: 1 }).reasons).toContain("No verified work yet for this stage"));
  it("alerts on z-score spikes", () => {
    expect(calculateZscore([10, 10, 10, 10], 50)).toEqual([0, 0, 0]);
    expect(evaluateAnomaly({ ...base, newQtyBase: 400, dailyTotals: [100, 110, 90, 105, 95] }).level).toBe("alert");
  });
});

describe("utilities", () => {
  it("normalizes sha256", () => {
    expect(normalizeSha256("0x" + "A".repeat(64))).toBe("a".repeat(64));
    expect(() => normalizeSha256("abc")).toThrow();
  });
  it("sniffs file types", () => {
    expect(sniffMime(buf(makeExifJpeg({})))).toBe("image/jpeg");
    expect(sniffMime(new TextEncoder().encode("%PDF-1.7").buffer as ArrayBuffer)).toBe("application/pdf");
    expect(sniffMime(new TextEncoder().encode("hello").buffer as ArrayBuffer)).toBeNull();
  });
  it("canonical JSON sorts keys", () => expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}'));
  it("haversine", () => expect(haversineM(0, 0, 0, 1)).toBeCloseTo(111195, -1));
  it("normalizes units", () => {
    expect(normalizeUnit("Bags")).toBe("bag");
    expect(normalizeUnit("MT")).toBe("tonne");
    expect(normalizeUnit("Pieces")).toBe("nos");
  });
  it("hashes and verifies passwords", async () => {
    const h = await hashPassword("s3cret");
    expect(await verifyPassword("s3cret", h)).toBe(true);
    expect(await verifyPassword("nope", h)).toBe(false);
    expect(await verifyPassword("s3cret", "legacy:hash")).toBe(false);
  });
});
